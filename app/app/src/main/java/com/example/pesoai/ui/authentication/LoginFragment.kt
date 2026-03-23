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
import com.example.pesoai.databinding.FragmentLoginBinding
import com.example.pesoai.ui.onboarding.OnboardingActivity
import com.example.pesoai.MainActivity

class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AuthViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        observeViewModel()
        setupClickListeners()
    }

    private fun setupClickListeners() {
        binding.btnLogin.setOnClickListener { attemptLogin() }

        binding.btnCreateAccount.setOnClickListener {
            findNavController().navigate(R.id.action_loginFragment_to_signupFragment)
        }

        // FIX: Use NavController — ForgotPasswordFragment is now registered in auth_nav_graph.xml
        binding.tvForgotPassword.setOnClickListener {
            findNavController().navigate(R.id.action_loginFragment_to_forgotPassword)
        }
    }

    private fun attemptLogin() {
        val usernameOrEmail = binding.etUsername.text.toString().trim()
        val password        = binding.etPassword.text.toString()

        if (usernameOrEmail.isEmpty()) {
            binding.tilUsername.error = getString(R.string.error_username_email_required)
            return
        }
        if (password.isEmpty()) {
            binding.tilPassword.error = getString(R.string.error_password_required)
            return
        }

        binding.tilUsername.error = null
        binding.tilPassword.error = null

        // REMOVED: Remember Me — login no longer passes rememberMe flag
        viewModel.login(usernameOrEmail, password)
    }

    private fun observeViewModel() {
        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            binding.btnLogin.isEnabled     = !loading
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }

        viewModel.authResult.observe(viewLifecycleOwner) { result ->
            result ?: return@observe
            when (result) {
                is AuthResult.Success -> {
                    // REMOVED: Remember Me — saveSession no longer takes rememberMe param
                    viewModel.saveSession(result)
                    viewModel.clearResult()
                    routeAfterLogin(result.onboardingCompleted)
                }
                is AuthResult.Error -> {
                    viewModel.clearResult()
                    Toast.makeText(requireContext(), result.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun routeAfterLogin(onboardingCompleted: Boolean) {
        val target = if (onboardingCompleted) MainActivity::class.java
        else OnboardingActivity::class.java
        startActivity(Intent(requireContext(), target))
        requireActivity().finish()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}