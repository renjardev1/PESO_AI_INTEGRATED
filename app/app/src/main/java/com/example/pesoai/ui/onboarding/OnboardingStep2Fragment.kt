package com.example.pesoai.ui.onboarding

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.example.pesoai.R
import com.example.pesoai.databinding.FragmentOnboardingStep2Binding

// Step 2 of 3 — Financial Info + Monthly Budget + Savings Target
// XML: fragment_onboarding_step2.xml
// Fields: tvProgress, btnBack (ImageButton),
//         tilMonthlyIncome / etMonthlyIncome,
//         tilMonthlyExpenses / etMonthlyExpenses  ← XML label = "Monthly Budget"
//         tilSavingsTarget / etSavingsTarget       ← optional
//         cbSavings, cbInvestment, cbRetirement, cbDebtPayoff, cbHomeOwnership,
//         rgRiskTolerance (rbConservative, rbModerate, rbAggressive),
//         btnFinish (acts as "Next" button here)
class OnboardingStep2Fragment : Fragment() {

    private var _binding: FragmentOnboardingStep2Binding? = null
    private val binding get() = _binding!!
    private val viewModel: OnboardingSharedViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOnboardingStep2Binding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.tvProgress.text = getString(R.string.onboarding_step_2_of_3)
        binding.btnFinish.text  = getString(R.string.onboarding_next)

        restoreState()
        setupInputValidation()

        binding.btnBack.setOnClickListener   { findNavController().navigateUp() }
        binding.btnFinish.setOnClickListener { saveAndProceed() }
    }

    // ── Restore previously entered values on back-navigation ──────────────────

    private fun restoreState() {
        if (viewModel.monthlyIncome > 0)
            binding.etMonthlyIncome.setText(viewModel.monthlyIncome.toInt().toString())
        // Note: Monthly budget field removed - only monthlyIncome is used
        if (viewModel.savingsGoal > 0)
            binding.etSavingsTarget.setText(viewModel.savingsGoal.toInt().toString())

        binding.cbSavings.isChecked       = viewModel.financialGoals.contains("Emergency Savings")
        binding.cbInvestment.isChecked    = viewModel.financialGoals.contains("Investment")
        binding.cbRetirement.isChecked    = viewModel.financialGoals.contains("Retirement")
        binding.cbDebtPayoff.isChecked    = viewModel.financialGoals.contains("Debt Payoff")
        binding.cbHomeOwnership.isChecked = viewModel.financialGoals.contains("Home Ownership")

        when (viewModel.riskTolerance) {
            "strict"   -> binding.rgRiskTolerance.check(R.id.rbConservative)
            "balanced" -> binding.rgRiskTolerance.check(R.id.rbModerate)
            "flexible" -> binding.rgRiskTolerance.check(R.id.rbAggressive)
        }
        validateForm()
    }

    // ── Enable Next only when required fields are filled ───────────────────────

    private fun setupInputValidation() {
        val watcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { validateForm() }
            override fun afterTextChanged(s: Editable?) {}
        }
        binding.etMonthlyIncome.addTextChangedListener(watcher)
        binding.etSavingsTarget.addTextChangedListener(watcher)
        binding.rgRiskTolerance.setOnCheckedChangeListener { _, _ -> validateForm() }
    }

    private fun validateForm() {
        val income       = binding.etMonthlyIncome.text.toString()
        val riskSelected = binding.rgRiskTolerance.checkedRadioButtonId != -1
        // Savings target is optional — not required to enable Next
        binding.btnFinish.isEnabled = income.isNotEmpty() && riskSelected
    }

    // ── Validate → save to ViewModel → navigate forward ───────────────────────

    private fun saveAndProceed() {
        val monthlyIncome = binding.etMonthlyIncome.text.toString().toDoubleOrNull()
        if (monthlyIncome == null || monthlyIncome <= 0) {
            binding.tilMonthlyIncome.error = getString(R.string.onboarding_income_error)
            return
        }
        binding.tilMonthlyIncome.error = null

        // Savings target is optional
        val savingsTarget = binding.etSavingsTarget.text?.toString()?.toDoubleOrNull() ?: 0.0
        if (savingsTarget < 0) {
            binding.tilSavingsTarget.error = getString(R.string.onboarding_savings_negative_error)
            return
        }
        binding.tilSavingsTarget.error = null

        val goals = mutableListOf<String>()
        if (binding.cbSavings.isChecked)       goals.add("Emergency Savings")
        if (binding.cbInvestment.isChecked)    goals.add("Investment")
        if (binding.cbRetirement.isChecked)    goals.add("Retirement")
        if (binding.cbDebtPayoff.isChecked)    goals.add("Debt Payoff")
        if (binding.cbHomeOwnership.isChecked) goals.add("Home Ownership")

        val riskTolerance = when (binding.rgRiskTolerance.checkedRadioButtonId) {
            R.id.rbConservative -> "strict"
            R.id.rbModerate     -> "balanced"
            R.id.rbAggressive   -> "flexible"
            else                -> "balanced"
        }

        // Only monthlyIncome is stored - no separate budget/expenses field
        viewModel.monthlyIncome   = monthlyIncome
        viewModel.savingsGoal     = savingsTarget
        viewModel.financialGoals  = goals
        viewModel.riskTolerance   = riskTolerance

        findNavController().navigate(R.id.action_onboardingStep2_to_onboardingStep3)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}