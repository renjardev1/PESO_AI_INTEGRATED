package com.example.pesoai.ui.dashboard

import android.util.Log
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.pesoai.MainActivity
import com.example.pesoai.R
import com.example.pesoai.api.models.DashboardData
import com.example.pesoai.databinding.FragmentDashboardBinding
import com.example.pesoai.utils.BudgetUtils
import java.text.NumberFormat
import java.util.*

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!
    private val viewModel: DashboardViewModel by viewModels()
    private lateinit var goalsAdapter: DashboardGoalAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupClickListeners()
        setupObservers()
        loadData()
    }

    override fun onResume() {
        super.onResume()
        loadData()
    }

    private fun setupRecyclerView() {
        goalsAdapter = DashboardGoalAdapter()
        binding.rvSavingsGoals.apply {
            layoutManager         = LinearLayoutManager(requireContext())
            adapter               = goalsAdapter
            isNestedScrollingEnabled = false
        }
    }

    private fun setupClickListeners() {
        binding.btnViewTransactions.setOnClickListener {
            (requireActivity() as MainActivity).selectBottomNavItem(R.id.TransactionsFragment)
        }
        binding.tvViewAllGoals.setOnClickListener {
            findNavController().navigate(R.id.GoalsFragment)
        }
        binding.btnAddExpense.setOnClickListener {
            (requireActivity() as MainActivity).selectBottomNavItem(R.id.TransactionsFragment)
        }
        binding.btnAddGoal.setOnClickListener {
            findNavController().navigate(R.id.GoalsFragment)
        }
    }

    private fun setupObservers() {
        viewModel.dashboardData.observe(viewLifecycleOwner) { data ->
            if (data == null) return@observe
            val prefs        = requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
            val budgetPeriod = prefs.getString("budget_period", "Monthly") ?: "Monthly"
            // ✅ budgetPeriod is the only arg — effectiveBudget computed inside using API data
            updateDashboardWithPeriod(data, budgetPeriod)
        }

        viewModel.savingsGoals.observe(viewLifecycleOwner) { goals ->
            if (goals.isEmpty()) {
                binding.rvSavingsGoals.visibility  = View.GONE
                binding.emptyGoalsState.visibility = View.VISIBLE
            } else {
                binding.rvSavingsGoals.visibility  = View.VISIBLE
                binding.emptyGoalsState.visibility = View.GONE
                goalsAdapter.submitList(goals)
            }
        }

        viewModel.error.observe(viewLifecycleOwner) { error ->
            if (!error.isNullOrEmpty())
                Toast.makeText(requireContext(), error, Toast.LENGTH_LONG).show()
        }
    }

    private fun loadData() {
        val prefs = requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

        // ✅ user_id is String (UUID)
        val userId = prefs.getString("user_id", null) ?: run {
            Toast.makeText(requireContext(), getString(R.string.error_user_not_found), Toast.LENGTH_SHORT).show()
            return
        }

        val monthlyIncome = prefs.getFloat("monthly_income", 10000f).toDouble()
        val budgetPeriod  = prefs.getString("budget_period", "Monthly") ?: "Monthly"
        val periodLabel   = BudgetUtils.getShortPeriodLabel(budgetPeriod)
        val periodRange   = BudgetUtils.formatPeriodRange(budgetPeriod)

        binding.tvBudgetPeriod.text = getString(R.string.dashboard_budget_period_label, periodLabel)
        binding.tvBudgetRange.text  = periodRange

        // Show placeholder budget until API returns; overwritten in updateDashboardWithPeriod
        val formatter = NumberFormat.getNumberInstance(Locale.US)
        binding.tvMonthlyBudget.text = formatter.format(
            BudgetUtils.calculatePeriodBudget(monthlyIncome, budgetPeriod).toInt()
        )

        viewModel.loadDashboardData()
        viewModel.loadSavingsGoals()
    }

    private fun updateDashboardWithPeriod(data: DashboardData, budgetPeriod: String) {
        val totalSpent = data.totalSpent
        val formatter  = NumberFormat.getNumberInstance(Locale.US)
        val prefs      = requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

        // ALWAYS use SharedPreferences as source of truth for budget
        // (Settings updates this immediately, API may lag)
        val cachedIncome = prefs.getFloat("monthly_income", 0f).toDouble()
        val monthlyIncome = if (cachedIncome > 0) cachedIncome
        else if (data.monthlyIncome > 0) data.monthlyIncome
        else 10000.0
        val effectiveBudget = BudgetUtils.calculatePeriodBudget(monthlyIncome, budgetPeriod)

        val remaining  = (effectiveBudget - totalSpent).coerceAtLeast(0.0)
        val percentage = BudgetUtils.calculateBudgetPercentage(totalSpent, effectiveBudget)

        // Cache for SavingsGoalFragment contribute dialog + Settings
        prefs.edit()
            .putFloat("cached_remaining",   remaining.toFloat())
            .putFloat("cached_total_spent", totalSpent.toFloat())
            .putFloat("user_monthly_budget", monthlyIncome.toFloat())
            .apply()

        // Budget card values
        binding.tvMonthlyBudget.text       = formatter.format(effectiveBudget.toInt())
        binding.tvSpent.text               = "₱ ${formatter.format(totalSpent.toInt())}"
        binding.tvSpentPercentage.text     = getString(R.string.dashboard_spent_percentage, percentage)
        binding.tvRemaining.text           = "₱ ${formatter.format(remaining.toInt())}"
        binding.tvRemainingPercentage.text = getString(R.string.dashboard_remaining_percentage, 100 - percentage)

        // ✅ Color via R.color token — no hex strings
        val statusColor = ContextCompat.getColor(
            requireContext(), BudgetUtils.getBudgetStatusColorRes(percentage)
        )
        binding.tvSpentPercentage.setTextColor(statusColor)

        // Over-budget warning
        if (totalSpent > effectiveBudget) {
            binding.tvBudgetWarning.visibility = View.VISIBLE
            val overBy = formatter.format((totalSpent - effectiveBudget).toInt())
            binding.tvBudgetWarning.text = getString(R.string.dashboard_over_budget_warning, overBy)
        } else {
            binding.tvBudgetWarning.visibility = View.GONE
        }

        binding.tvDaysRemaining.text = BudgetUtils.getDaysRemainingInPeriod(budgetPeriod).toString()

        val daysElapsed = when (budgetPeriod) {
            "Daily"      -> 1
            "Weekly"     -> (Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 1).coerceAtLeast(1)
            "Bi-monthly" -> {
                val d = Calendar.getInstance().get(Calendar.DAY_OF_MONTH)
                if (d <= 15) d else d - 15
            }
            "Monthly"    -> Calendar.getInstance().get(Calendar.DAY_OF_MONTH)
            else         -> 1
        }.coerceAtLeast(1)

        val avgDailySpending = totalSpent / daysElapsed
        binding.tvAvgDaily.text = "₱${formatter.format(avgDailySpending.toInt())}"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}