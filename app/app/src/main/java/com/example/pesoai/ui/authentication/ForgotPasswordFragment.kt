package com.example.pesoai.ui.authentication

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.example.pesoai.R
import com.example.pesoai.databinding.FragmentForgotPasswordBinding

class ForgotPasswordFragment : Fragment() {

    private var _binding: FragmentForgotPasswordBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AuthViewModel by activityViewModels()

    // Stores the email used in Step 1 so Step 2 can reference it
    private var pendingEmail = ""

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentForgotPasswordBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        showStep1()
        observeViewModel()

        // FIX: Use NavController popBackStack — fragment is NavController-managed
        binding.btnBack.setOnClickListener {
            findNavController().popBackStack()
        }
    }

    // ── Step 1: Enter email → request OTP ────────────────────────────────────

    private fun showStep1() {
        binding.layoutStep1.visibility = View.VISIBLE
        binding.layoutStep2.visibility = View.GONE

        binding.btnSendCode.setOnClickListener {
            val email = binding.etForgotEmail.text.toString().trim()
            if (email.isEmpty() || !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                binding.tilForgotEmail.error = getString(R.string.error_valid_email_required)
                return@setOnClickListener
            }
            binding.tilForgotEmail.error = null
            pendingEmail = email
            viewModel.requestPasswordReset(email)
        }
    }

    // ── Step 2: Enter OTP + new password → reset ──────────────────────────────

    private fun showStep2() {
        binding.layoutStep1.visibility = View.GONE
        binding.layoutStep2.visibility = View.VISIBLE

        binding.tvStep2Subtitle.text =
            getString(R.string.forgot_password_step2_subtitle, pendingEmail)

        binding.btnResetPassword.setOnClickListener {
            val otp         = binding.etOtp.text.toString().trim()
            val newPassword = binding.etNewPassword.text.toString()
            val confirmPass = binding.etConfirmNewPassword.text.toString()
            var hasError    = false

            if (otp.length != 6) {
                binding.tilOtp.error = getString(R.string.error_otp_invalid)
                hasError = true
            } else binding.tilOtp.error = null

            if (newPassword.length < 6) {
                binding.tilNewPassword.error = getString(R.string.error_password_min_length)
                hasError = true
            } else binding.tilNewPassword.error = null

            if (newPassword != confirmPass) {
                binding.tilConfirmNewPassword.error = getString(R.string.error_passwords_no_match)
                hasError = true
            } else binding.tilConfirmNewPassword.error = null

            if (!hasError) viewModel.resetPassword(pendingEmail, otp, newPassword)
        }

        binding.tvResendCode.setOnClickListener {
            viewModel.requestPasswordReset(pendingEmail)
            Toast.makeText(
                requireContext(),
                getString(R.string.forgot_password_resent),
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    // ── Observers ─────────────────────────────────────────────────────────────

    private fun observeViewModel() {
        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            binding.btnSendCode.isEnabled      = !loading
            binding.btnResetPassword.isEnabled = !loading
            binding.progressForgot.visibility  =
                if (loading) View.VISIBLE else View.GONE
        }

        viewModel.forgotPasswordResult.observe(viewLifecycleOwner) { msg ->
            if (!msg.isNullOrBlank()) {
                showStep2()
                viewModel.clearForgotPasswordState()
            }
        }

        viewModel.forgotPasswordError.observe(viewLifecycleOwner) { err ->
            if (!err.isNullOrBlank()) {
                Toast.makeText(requireContext(), err, Toast.LENGTH_LONG).show()
                viewModel.clearForgotPasswordState()
            }
        }

        // Step 2 success → navigate back to log in
        viewModel.resetPasswordResult.observe(viewLifecycleOwner) { msg ->
            if (!msg.isNullOrBlank()) {
                Toast.makeText(requireContext(), msg, Toast.LENGTH_LONG).show()
                viewModel.clearForgotPasswordState()
                // FIX: Use NavController popBackStack — fragment is NavController-managed
                findNavController().popBackStack()
            }
        }

        viewModel.resetPasswordError.observe(viewLifecycleOwner) { err ->
            if (!err.isNullOrBlank()) {
                binding.tilOtp.error = err
                viewModel.clearForgotPasswordState()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}