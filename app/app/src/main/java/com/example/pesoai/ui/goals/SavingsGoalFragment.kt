package com.example.pesoai.ui.goals

import android.app.DatePickerDialog
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.TextView
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.pesoai.R
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.SavingsGoal
import com.example.pesoai.databinding.FragmentSavingsGoalBinding
import com.example.pesoai.ui.settings.CategoryViewModel
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class SavingsGoalFragment : Fragment() {

    private var currentFilter: String? = null  // null = all, "active", "completed"
    private var _binding: FragmentSavingsGoalBinding? = null
    private val binding get() = _binding!!
    private val viewModel: SavingsGoalViewModel by viewModels()
    private val categoryViewModel: CategoryViewModel by activityViewModels()
    private lateinit var adapter: SavingsGoalAdapter

    // ── Pagination state ──────────────────────────────────────────────────────
    private var allGoals: List<SavingsGoal> = emptyList()
    private var currentPage = 1
    private val pageSize    = 10
    // ─────────────────────────────────────────────────────────────────────────

    private fun getPrefs() =
        requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    private fun getToken(): String = "Bearer ${getPrefs().getString("jwt_token", "") ?: ""}"
    private fun getUserId(): String = getPrefs().getString("user_id", "") ?: ""

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSavingsGoalBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        categoryViewModel.loadCategories()
        setupRecyclerView()
        setupObservers()
        setupClickListeners()
        setupTabs()
        setupGoalPaginationButtons()
        loadGoals()
        loadTotalSavings()
    }

    override fun onResume() {
        super.onResume()
        if (_binding != null) {
            loadGoals()
            loadTotalSavings()
        }
    }

    private fun setupRecyclerView() {
        adapter = SavingsGoalAdapter(
            onGoalClick  = { goal -> showGoalDetailsDialog(goal) },
            onContribute = { goal -> showContributeDialog(goal) }
        )
        binding.rvSavingsGoals.apply {
            layoutManager            = LinearLayoutManager(requireContext())
            adapter                  = this@SavingsGoalFragment.adapter
            isNestedScrollingEnabled = false
        }
    }

    private fun setupObservers() {
        viewModel.goals.observe(viewLifecycleOwner) { goals ->
            allGoals = goals
            applyGoalPage(1)

            binding.tvGoalCount.text = when (currentFilter) {
                "active"    -> getString(R.string.goals_active_count, goals.size)
                "completed" -> "Completed: ${goals.size}"
                else        -> "All: ${goals.size}"
            }
        }
        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }
        viewModel.error.observe(viewLifecycleOwner) { error ->
            if (!error.isNullOrEmpty()) Toast.makeText(requireContext(), error, Toast.LENGTH_LONG).show()
        }
        viewModel.contributeSuccess.observe(viewLifecycleOwner) { amount ->
            val fmt = NumberFormat.getNumberInstance(Locale.US)
            Toast.makeText(requireContext(), getString(R.string.contribution_success, fmt.format(amount.toInt())), Toast.LENGTH_SHORT).show()
        }
        viewModel.budgetBlocked.observe(viewLifecycleOwner) { data -> data?.let { showBudgetBlockedDialog(it) } }
        viewModel.budgetWarning.observe(viewLifecycleOwner) { data -> data?.let { showBudgetWarningDialog(it) } }
    }

    private fun loadTotalSavings() {
        lifecycleScope.launch {
            try {
                val allGoalsResp = ApiClient.authApi.getGoalsFiltered(getToken(), getUserId(), null)
                if (allGoalsResp.isSuccessful) {
                    val total = allGoalsResp.body()?.goals?.sumOf { it.currentAmount } ?: 0.0
                    val formatter = NumberFormat.getNumberInstance(Locale.US)
                    binding.tvTotalSavings.text = "₱${formatter.format(total.toInt())}"
                }
            } catch (_: Exception) { }
        }
    }

    private fun setupClickListeners() {
        binding.fabAddGoal.setOnClickListener { showAddGoalDialog() }
    }

    private fun setupTabs() {
        binding.chipAll.setOnClickListener {
            currentFilter = null; currentPage = 1; loadGoals()
        }
        binding.chipActive.setOnClickListener {
            currentFilter = "active"; currentPage = 1; loadGoals()
        }
        binding.chipCompleted.setOnClickListener {
            currentFilter = "completed"; currentPage = 1; loadGoals()
        }
    }

    private fun loadGoals() {
        viewModel.loadGoals(getToken(), getUserId(), currentFilter)
    }

    // ── Pagination ────────────────────────────────────────────────────────────

    private fun applyGoalPage(page: Int) {
        currentPage = page
        val total      = allGoals.size
        val totalPages = maxOf(1, Math.ceil(total.toDouble() / pageSize).toInt())
        val start      = (page - 1) * pageSize
        val end        = minOf(start + pageSize, total)
        val pageItems  = if (start < total) allGoals.subList(start, end) else emptyList()

        adapter.submitList(pageItems)

        if (allGoals.isEmpty()) {
            binding.rvSavingsGoals.visibility = View.GONE
            binding.tvEmptyState.visibility   = View.VISIBLE
        } else {
            binding.rvSavingsGoals.visibility = View.VISIBLE
            binding.tvEmptyState.visibility   = View.GONE
        }

        if (totalPages > 1) {
            binding.layoutGoalPagination.visibility = View.VISIBLE
            binding.tvGoalPageIndicator.text         = "Page $currentPage of $totalPages"
            binding.btnGoalPrevPage.isEnabled        = currentPage > 1
            binding.btnGoalPrevPage.alpha            = if (currentPage > 1) 1f else 0.3f
            binding.btnGoalNextPage.isEnabled        = currentPage < totalPages
            binding.btnGoalNextPage.alpha            = if (currentPage < totalPages) 1f else 0.3f
        } else {
            binding.layoutGoalPagination.visibility = View.GONE
        }
    }

    private fun setupGoalPaginationButtons() {
        binding.btnGoalPrevPage.setOnClickListener {
            if (currentPage > 1) applyGoalPage(currentPage - 1)
        }
        binding.btnGoalNextPage.setOnClickListener {
            val totalPages = maxOf(1, Math.ceil(allGoals.size.toDouble() / pageSize).toInt())
            if (currentPage < totalPages) applyGoalPage(currentPage + 1)
        }
    }

    // ── Category helper ───────────────────────────────────────────────────────

    private fun getCategoryNames(): List<String> =
        categoryViewModel.categories.value?.map { it.name } ?: emptyList()

    // ==================== ADD GOAL DIALOG ====================

    private fun showAddGoalDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_add_goal, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilGoalName     = dialogView.findViewById<TextInputLayout>(R.id.tilGoalName)
        val etGoalName      = dialogView.findViewById<TextInputEditText>(R.id.etGoalName)
        val tilTargetAmount = dialogView.findViewById<TextInputLayout>(R.id.tilTargetAmount)
        val etTargetAmount  = dialogView.findViewById<TextInputEditText>(R.id.etTargetAmount)
        val etCurrentAmount = dialogView.findViewById<TextInputEditText>(R.id.etCurrentAmount)
        val etDeadline      = dialogView.findViewById<TextInputEditText>(R.id.etDeadline)
        val actvCategory    = dialogView.findViewById<AutoCompleteTextView>(R.id.actvCategory)
        val btnCancel       = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnAdd          = dialogView.findViewById<MaterialButton>(R.id.btnAdd)

        actvCategory.setAdapter(ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, getCategoryNames()))
        actvCategory.inputType  = android.text.InputType.TYPE_NULL
        actvCategory.keyListener = null

        val calendar   = Calendar.getInstance()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        etDeadline.setOnClickListener {
            DatePickerDialog(requireContext(), { _, year, month, day ->
                calendar.set(year, month, day)
                etDeadline.setText(dateFormat.format(calendar.time))
            }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH),
                calendar.get(Calendar.DAY_OF_MONTH)).show()
        }

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnAdd.setOnClickListener {
            val name          = etGoalName.text.toString().trim()
            val targetAmount  = etTargetAmount.text.toString().toDoubleOrNull()
            val currentAmount = etCurrentAmount.text.toString().toDoubleOrNull() ?: 0.0
            val deadline      = etDeadline.text.toString().ifEmpty { null }
            val category      = actvCategory.text.toString().ifEmpty { null }

            if (name.isEmpty()) { tilGoalName.error = getString(R.string.error_goal_name_required); return@setOnClickListener } else tilGoalName.error = null
            if (targetAmount == null || targetAmount <= 0) { tilTargetAmount.error = getString(R.string.error_target_amount_required); return@setOnClickListener } else tilTargetAmount.error = null

            viewModel.addGoal(token = getToken(), userId = getUserId(), name = name, targetAmount = targetAmount, currentAmount = currentAmount, deadline = deadline, category = category)
            dialog.dismiss()
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ==================== GOAL DETAILS DIALOG ====================

    private fun showGoalDetailsDialog(goal: SavingsGoal) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_goal_details, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val formatter = NumberFormat.getNumberInstance(Locale.US)

        dialogView.findViewById<TextView>(R.id.tvGoalName).text  = goal.goalName
        dialogView.findViewById<TextView>(R.id.tvCategory).text  = goal.category ?: "General"

        val progress = if (goal.targetAmount > 0)
            ((goal.currentAmount / goal.targetAmount) * 100).toInt().coerceIn(0, 100) else 0
        dialogView.findViewById<android.widget.ProgressBar>(R.id.pbGoalProgress).progress = progress
        dialogView.findViewById<TextView>(R.id.tvProgress).text  = "$progress%"
        dialogView.findViewById<TextView>(R.id.tvSaved).text     = "₱${formatter.format(goal.currentAmount.toInt())}"
        dialogView.findViewById<TextView>(R.id.tvTarget).text    = "₱${formatter.format(goal.targetAmount.toInt())}"
        dialogView.findViewById<TextView>(R.id.tvDeadline).text  = goal.deadline?.substring(0, 10) ?: "No deadline"

        val rvContributions   = dialogView.findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rvContributionHistory)
        val tvNoContributions = dialogView.findViewById<TextView>(R.id.tvNoContributions)
        val layoutPagination  = dialogView.findViewById<android.view.View>(R.id.layoutPagination)
        val tvPageIndicator   = dialogView.findViewById<TextView>(R.id.tvPageIndicator)
        val btnPrevPage       = dialogView.findViewById<android.widget.ImageButton>(R.id.btnPrevPage)
        val btnNextPage       = dialogView.findViewById<android.widget.ImageButton>(R.id.btnNextPage)

        rvContributions.layoutManager = androidx.recyclerview.widget.LinearLayoutManager(requireContext())

        val contribPageSize = 4
        var contribPage     = 1
        var contribTotal    = 1

        fun loadContribPage(page: Int) {
            lifecycleScope.launch {
                try {
                    val response = viewModel.repository.getGoalContributions(token = getToken(), userId = getUserId(), goalId = goal.id, page = page, limit = contribPageSize)
                    if (response.contributions.isEmpty() && page == 1) {
                        rvContributions.visibility   = View.GONE
                        tvNoContributions.visibility = View.VISIBLE
                        layoutPagination.visibility  = View.GONE
                    } else {
                        contribTotal = if (response.total > 0) Math.ceil(response.total.toDouble() / contribPageSize).toInt() else 1
                        contribPage  = page
                        rvContributions.visibility   = View.VISIBLE
                        tvNoContributions.visibility = View.GONE
                        rvContributions.adapter      = ContributionAdapter(response.contributions)
                        if (contribTotal > 1) {
                            layoutPagination.visibility = View.VISIBLE
                            tvPageIndicator.text        = "Page $contribPage of $contribTotal"
                            btnPrevPage.isEnabled       = contribPage > 1
                            btnPrevPage.alpha           = if (contribPage > 1) 1f else 0.3f
                            btnNextPage.isEnabled       = contribPage < contribTotal
                            btnNextPage.alpha           = if (contribPage < contribTotal) 1f else 0.3f
                        } else {
                            layoutPagination.visibility = View.GONE
                        }
                    }
                } catch (_: Exception) {
                    tvNoContributions.text       = "Failed to load contributions"
                    tvNoContributions.visibility = View.VISIBLE
                    rvContributions.visibility   = View.GONE
                    layoutPagination.visibility  = View.GONE
                }
            }
        }

        btnPrevPage.setOnClickListener { if (contribPage > 1) loadContribPage(contribPage - 1) }
        btnNextPage.setOnClickListener { if (contribPage < contribTotal) loadContribPage(contribPage + 1) }
        loadContribPage(1)

        // ── Completed On ─────────────────────────────────────────────────────
        val isCompleted = goal.status == "completed"
        val btnContribute = dialogView.findViewById<MaterialButton>(R.id.btnContribute)
        val btnEdit       = dialogView.findViewById<MaterialButton>(R.id.btnEdit)

        btnContribute.visibility = if (isCompleted) View.GONE else View.VISIBLE
        btnEdit.visibility       = if (isCompleted) View.GONE else View.VISIBLE

        if (isCompleted) {
            val layoutCompletedAt = dialogView.findViewById<android.view.View>(R.id.layoutCompletedAt)
            val tvCompletedAt     = dialogView.findViewById<TextView>(R.id.tvCompletedAt)
            layoutCompletedAt.visibility = View.VISIBLE
            tvCompletedAt.text = if (!goal.completedAt.isNullOrBlank()) {
                try {
                    val inFmt  = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                    val outFmt = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                    outFmt.format(inFmt.parse(goal.completedAt.take(10))!!)
                } catch (_: Exception) { goal.completedAt.take(10) }
            } else "—"
        }

        btnContribute.setOnClickListener { dialog.dismiss(); showContributeDialog(goal) }
        btnEdit.setOnClickListener       { dialog.dismiss(); showEditGoalDialog(goal) }
        dialogView.findViewById<MaterialButton>(R.id.btnDelete).setOnClickListener { dialog.dismiss(); showDeleteGoalDialog(goal) }
        dialogView.findViewById<MaterialButton>(R.id.btnClose).setOnClickListener  { dialog.dismiss() }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ==================== EDIT GOAL DIALOG ====================

    private fun showEditGoalDialog(goal: SavingsGoal) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_add_goal, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilGoalName     = dialogView.findViewById<TextInputLayout>(R.id.tilGoalName)
        val etGoalName      = dialogView.findViewById<TextInputEditText>(R.id.etGoalName)
        val tilTargetAmount = dialogView.findViewById<TextInputLayout>(R.id.tilTargetAmount)
        val etTargetAmount  = dialogView.findViewById<TextInputEditText>(R.id.etTargetAmount)
        val etCurrentAmount = dialogView.findViewById<TextInputEditText>(R.id.etCurrentAmount)
        val etDeadline      = dialogView.findViewById<TextInputEditText>(R.id.etDeadline)
        val actvCategory    = dialogView.findViewById<AutoCompleteTextView>(R.id.actvCategory)
        val btnCancel       = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnAdd          = dialogView.findViewById<MaterialButton>(R.id.btnAdd)

        etGoalName.setText(goal.goalName)
        etTargetAmount.setText(goal.targetAmount.toInt().toString())
        etCurrentAmount.setText(goal.currentAmount.toInt().toString())
        etDeadline.setText(goal.deadline?.substring(0, 10) ?: "")
        actvCategory.setText(goal.category ?: "")

        actvCategory.setAdapter(ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, getCategoryNames()))
        actvCategory.inputType  = android.text.InputType.TYPE_NULL
        actvCategory.keyListener = null

        val calendar   = Calendar.getInstance()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        etDeadline.setOnClickListener {
            DatePickerDialog(requireContext(), { _, year, month, day ->
                calendar.set(year, month, day)
                etDeadline.setText(dateFormat.format(calendar.time))
            }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH),
                calendar.get(Calendar.DAY_OF_MONTH)).show()
        }

        btnAdd.text = getString(R.string.btn_save_changes)
        btnCancel.setOnClickListener { dialog.dismiss() }

        btnAdd.setOnClickListener {
            val name          = etGoalName.text.toString().trim()
            val targetAmount  = etTargetAmount.text.toString().toDoubleOrNull()
            val currentAmount = etCurrentAmount.text.toString().toDoubleOrNull() ?: 0.0
            val deadline      = etDeadline.text.toString().ifEmpty { null }
            val category      = actvCategory.text.toString().ifEmpty { null }

            if (name.isEmpty()) { tilGoalName.error = getString(R.string.error_goal_name_required); return@setOnClickListener } else tilGoalName.error = null
            if (targetAmount == null || targetAmount <= 0) { tilTargetAmount.error = getString(R.string.error_target_amount_required); return@setOnClickListener } else tilTargetAmount.error = null

            viewModel.updateGoal(token = getToken(), goalId = goal.id.toString(), name = name, targetAmount = targetAmount, currentAmount = currentAmount, deadline = deadline, category = category)
            dialog.dismiss()
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ==================== CONTRIBUTE DIALOG ====================

    private fun showContributeDialog(goal: SavingsGoal) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_contribute_goal, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val formatter = NumberFormat.getNumberInstance(Locale.US)
        val prefs     = getPrefs()

        dialogView.findViewById<TextView>(R.id.tvGoalName).text = goal.goalName
        dialogView.findViewById<TextView>(R.id.tvCurrentAmount).text =
            "₱${formatter.format(goal.currentAmount.toInt())}"
        dialogView.findViewById<TextView>(R.id.tvTargetAmount).text =
            " / ₱${formatter.format(goal.targetAmount.toInt())}"

        val progress = if (goal.targetAmount > 0)
            ((goal.currentAmount / goal.targetAmount) * 100).toInt().coerceIn(0, 100) else 0
        dialogView.findViewById<android.widget.ProgressBar>(R.id.progressGoal).progress = progress
        dialogView.findViewById<TextView>(R.id.tvProgressPercentage).text = "$progress%"

        val remaining = prefs.getFloat("cached_remaining", 0f)
        dialogView.findViewById<TextView>(R.id.tvRemainingBudget).text =
            getString(R.string.contribute_remaining_hint, formatter.format(remaining.toInt()))

        val tilAmount = dialogView.findViewById<TextInputLayout>(R.id.tilAmount)
        val etAmount  = dialogView.findViewById<TextInputEditText>(R.id.etAmount)

        dialogView.findViewById<MaterialButton>(R.id.btnCancel).setOnClickListener { dialog.dismiss() }
        dialogView.findViewById<MaterialButton>(R.id.btnContribute).setOnClickListener {
            val amount = etAmount.text.toString().toDoubleOrNull()
            if (amount == null || amount <= 0) { tilAmount.error = getString(R.string.error_invalid_amount); return@setOnClickListener }
            tilAmount.error = null
            viewModel.contributeToGoal(token = getToken(), goalId = goal.id.toString(), amount = amount)
            dialog.dismiss()
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ==================== DELETE GOAL DIALOG ====================

    private fun showDeleteGoalDialog(goal: SavingsGoal) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_delete_confirm, null)
        val dialog = AlertDialog.Builder(requireContext()).setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        dialogView.findViewById<TextView>(R.id.tvDialogTitle).text    = getString(R.string.dialog_title_delete_goal)
        dialogView.findViewById<TextView>(R.id.tvDialogSubtitle).text = getString(R.string.dialog_subtitle_cannot_undo)
        dialogView.findViewById<TextView>(R.id.tvDialogItemName).text = goal.goalName
        dialogView.findViewById<TextView>(R.id.tvDialogMessage).text  = getString(R.string.dialog_msg_delete_goal)

        dialogView.findViewById<MaterialButton>(R.id.btnCancel).setOnClickListener { dialog.dismiss() }
        dialogView.findViewById<MaterialButton>(R.id.btnDelete).setOnClickListener {
            viewModel.deleteGoal(token = getToken(), goalId = goal.id.toString())
            Toast.makeText(requireContext(), getString(R.string.goal_deleted), Toast.LENGTH_SHORT).show()
            dialog.dismiss()
        }
        dialog.show()
    }

    // ── Budget validation dialogs ─────────────────────────────────────────────

    private fun showBudgetBlockedDialog(data: SavingsGoalViewModel.BudgetWarningData) {
        if (!isAdded) return
        val fmt      = NumberFormat.getNumberInstance(Locale.US)
        val spentPct = if (data.budget > 0) (data.spent / data.budget * 100).toInt() else 0
        val dialogView = layoutInflater.inflate(R.layout.dialog_budget_blocked, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme).setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        val limitLabel = if (data.isHardBlock) getString(R.string.budget_label_hard_limit) else getString(R.string.budget_label_monthly)
        val limitValue = if (data.isHardBlock) data.blockLimit else data.budget
        dialogView.findViewById<TextView>(R.id.tvBlockedLimitLabel).text = limitLabel
        dialogView.findViewById<TextView>(R.id.tvBlockedBudget).text = "₱${fmt.format(limitValue.toInt())}"
        dialogView.findViewById<TextView>(R.id.tvBlockedSpent).text  = "₱${fmt.format(data.spent.toInt())} ($spentPct%)"
        dialogView.findViewById<MaterialButton>(R.id.btnBlockedOk).setOnClickListener { dialog.dismiss() }
        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun showBudgetWarningDialog(data: SavingsGoalViewModel.BudgetWarningData) {
        if (!isAdded) return
        val fmt         = NumberFormat.getNumberInstance(Locale.US)
        val spentPct    = if (data.budget > 0) (data.spent    / data.budget * 100).toInt() else 0
        val newTotalPct = if (data.budget > 0) (data.newTotal / data.budget * 100).toInt() else 0
        val dialogView = layoutInflater.inflate(R.layout.dialog_budget_warning, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme).setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        dialogView.findViewById<TextView>(R.id.tvWarnBudget).text    = "₱${fmt.format(data.budget.toInt())}"
        dialogView.findViewById<TextView>(R.id.tvWarnSpent).text     = "₱${fmt.format(data.spent.toInt())} ($spentPct%)"
        dialogView.findViewById<TextView>(R.id.tvWarnThreshold).text = "₱${fmt.format(data.threshold.toInt())}"
        dialogView.findViewById<TextView>(R.id.tvWarnNewAmount).text = "₱${fmt.format(data.newAmount.toInt())}"
        dialogView.findViewById<TextView>(R.id.tvWarnNewTotal).text  = "₱${fmt.format(data.newTotal.toInt())} ($newTotalPct%)"
        dialogView.findViewById<MaterialButton>(R.id.btnWarnCancel).setOnClickListener  { viewModel.cancelPendingContribution(); dialog.dismiss() }
        dialogView.findViewById<MaterialButton>(R.id.btnWarnProceed).setOnClickListener { viewModel.forceContributeToGoal(); dialog.dismiss() }
        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    override fun onDestroyView() {
        viewModel.cancelPendingContribution()
        super.onDestroyView()
        _binding = null
    }
}