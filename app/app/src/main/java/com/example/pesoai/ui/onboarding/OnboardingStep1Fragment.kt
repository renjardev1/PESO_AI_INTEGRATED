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
import com.example.pesoai.databinding.FragmentOnboardingStep1Binding

// Step 1 of 3 — Personal Info
// XML: fragment_onboarding_step1.xml
// Fields: tvProgress, etAge, tilAge, rgGender (rbMale, rbFemale, rbOther),
//         etOccupation, tilOccupation, btnNext
class OnboardingStep1Fragment : Fragment() {

    private var _binding: FragmentOnboardingStep1Binding? = null
    private val binding get() = _binding!!
    private val viewModel: OnboardingSharedViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOnboardingStep1Binding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.tvProgress.text = getString(R.string.onboarding_step_1_of_3)

        restoreState()
        setupInputValidation()

        binding.btnNext.setOnClickListener { saveAndProceed() }
    }

    // ── Restore previously entered values on back-navigation ──────────────────

    private fun restoreState() {
        if (viewModel.age > 0)               binding.etAge.setText(viewModel.age.toString())
        if (viewModel.occupation.isNotEmpty()) binding.etOccupation.setText(viewModel.occupation)
        when (viewModel.gender) {
            "male"   -> binding.rgGender.check(R.id.rbMale)
            "female" -> binding.rgGender.check(R.id.rbFemale)
            "other"  -> binding.rgGender.check(R.id.rbOther)
        }
        validateForm()
    }

    // ── Enable Next button only when all required fields are filled ────────────

    private fun setupInputValidation() {
        val watcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { validateForm() }
            override fun afterTextChanged(s: Editable?) {}
        }
        binding.etAge.addTextChangedListener(watcher)
        binding.etOccupation.addTextChangedListener(watcher)
        binding.rgGender.setOnCheckedChangeListener { _, _ -> validateForm() }
    }

    private fun validateForm() {
        val age            = binding.etAge.text.toString()
        val occupation     = binding.etOccupation.text.toString()
        val genderSelected = binding.rgGender.checkedRadioButtonId != -1
        binding.btnNext.isEnabled = age.isNotEmpty() && occupation.isNotEmpty() && genderSelected
    }

    // ── Validate → save to ViewModel → navigate forward ───────────────────────

    private fun saveAndProceed() {
        val age = binding.etAge.text.toString().toIntOrNull()
        if (age == null || age < 18 || age > 120) {
            binding.tilAge.error = getString(R.string.onboarding_age_error)
            return
        }
        binding.tilAge.error = null

        val occupation = binding.etOccupation.text.toString().trim()
        if (occupation.isEmpty()) {
            binding.tilOccupation.error = getString(R.string.onboarding_occupation_error)
            return
        }
        binding.tilOccupation.error = null

        val gender = when (binding.rgGender.checkedRadioButtonId) {
            R.id.rbMale   -> "male"
            R.id.rbFemale -> "female"
            R.id.rbOther  -> "other"
            else          -> ""
        }

        viewModel.age        = age
        viewModel.gender     = gender
        viewModel.occupation = occupation

        findNavController().navigate(R.id.action_onboardingStep1_to_onboardingStep2)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}