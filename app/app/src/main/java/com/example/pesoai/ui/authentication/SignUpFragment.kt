package com.example.pesoai.ui.authentication

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.example.pesoai.R
import com.example.pesoai.databinding.FragmentSignUpBinding
import com.example.pesoai.ui.onboarding.OnboardingActivity

class SignUpFragment : Fragment() {

    private var _binding: FragmentSignUpBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AuthViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSignUpBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        observeViewModel()
        setupClickListeners()
    }

    private fun setupClickListeners() {
        binding.btnSignUp.setOnClickListener { attemptSignup() }
        binding.tvLogin.setOnClickListener   { findNavController().navigateUp() }
    }

    private fun attemptSignup() {
        val firstName = binding.etFirstName.text.toString().trim()
        val lastName  = binding.etLastName.text.toString().trim()
        val username  = binding.etUsername.text.toString().trim()
        val email     = binding.etEmail.text.toString().trim()
        val password  = binding.etPassword.text.toString()
        val confirm   = binding.etConfirmPassword.text.toString()

        var hasError = false

        if (firstName.isEmpty()) {
            binding.tilFirstName.error = getString(R.string.error_first_name_required); hasError = true
        } else { binding.tilFirstName.error = null }

        if (lastName.isEmpty()) {
            binding.tilLastName.error = getString(R.string.error_last_name_required); hasError = true
        } else { binding.tilLastName.error = null }

        if (username.isEmpty()) {
            binding.tilUsername.error = getString(R.string.error_username_required); hasError = true
        } else { binding.tilUsername.error = null }

        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            binding.tilEmail.error = getString(R.string.error_invalid_email); hasError = true
        } else { binding.tilEmail.error = null }

        if (password.length < 6) {
            binding.tilPassword.error = getString(R.string.error_password_min_length); hasError = true
        } else { binding.tilPassword.error = null }

        if (password != confirm) {
            binding.tilConfirmPassword.error = getString(R.string.error_passwords_do_not_match); hasError = true
        } else { binding.tilConfirmPassword.error = null }

        if (hasError) return

        viewModel.signup(firstName, lastName, username, email, password)
    }

    private fun observeViewModel() {

        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            binding.btnSignUp.isEnabled    = !loading
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }

        viewModel.authResult.observe(viewLifecycleOwner) { result ->
            result ?: return@observe

            when (result) {
                is AuthResult.Success -> {
                    viewModel.saveSession(result)
                    viewModel.clearResult()
                    startActivity(Intent(requireContext(), OnboardingActivity::class.java))
                    requireActivity().finish()
                }
                is AuthResult.Error -> {
                    viewModel.clearResult()
                    Toast.makeText(requireContext(), result.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}