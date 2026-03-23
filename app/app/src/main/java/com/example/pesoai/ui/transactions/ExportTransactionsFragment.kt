package com.example.pesoai.ui.transactions

import android.app.DatePickerDialog
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.example.pesoai.R
import com.example.pesoai.api.ApiClient
import com.example.pesoai.databinding.FragmentExportTransactionsBinding
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class ExportTransactionsFragment : Fragment() {

    private var _binding: FragmentExportTransactionsBinding? = null
    private val binding get() = _binding!!

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

    private val periodLabels = listOf("Last 7 Days", "Last 30 Days", "Last 60 Days", "Custom Range")
    private val periodValues = listOf("7d", "30d", "60d", "custom")

    private fun getPrefs() =
        requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
    private fun getUserId() = getPrefs().getString("user_id", "") ?: ""
    private fun getToken()  = "Bearer ${getPrefs().getString("jwt_token", "") ?: ""}"

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentExportTransactionsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupHeader()
        setupSpinner()
        setupDatePickers()
        setupSubmitButton()
    }

    private fun setupHeader() {
        binding.btnBack.setOnClickListener { findNavController().navigateUp() }

        // Show email address truncated
        val email = getPrefs().getString("email", "") ?: ""
        if (email.isNotEmpty()) {
            val truncated = if (email.length > 22) "${email.take(22)}..." else email
            binding.tvEmailDestination.text = "Will be sent to: $truncated"
        }
    }

    private fun setupSpinner() {
        val adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_item,
            periodLabels
        ).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        binding.spinnerPeriod.adapter = adapter
        binding.spinnerPeriod.setSelection(1) // Default: Last 30 Days

        binding.spinnerPeriod.onItemSelectedListener =
            object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onItemSelected(
                    parent: android.widget.AdapterView<*>, view: View?,
                    position: Int, id: Long
                ) {
                    binding.layoutCustomDates.visibility =
                        if (periodValues[position] == "custom") View.VISIBLE else View.GONE
                }
                override fun onNothingSelected(parent: android.widget.AdapterView<*>) {}
            }
    }

    private fun setupDatePickers() {
        val calendar = Calendar.getInstance()

        // Default: start = 30 days ago, end = today
        val endCal   = Calendar.getInstance()
        val startCal = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -30) }

        binding.etStartDate.setText(dateFormat.format(startCal.time))
        binding.etEndDate.setText(dateFormat.format(endCal.time))

        binding.etStartDate.setOnClickListener {
            DatePickerDialog(requireContext(), { _, year, month, day ->
                startCal.set(year, month, day)
                binding.etStartDate.setText(
                    String.format("%04d-%02d-%02d", year, month + 1, day)
                )
            }, startCal.get(Calendar.YEAR),
                startCal.get(Calendar.MONTH),
                startCal.get(Calendar.DAY_OF_MONTH)
            ).show()
        }

        binding.etEndDate.setOnClickListener {
            DatePickerDialog(requireContext(), { _, year, month, day ->
                endCal.set(year, month, day)
                binding.etEndDate.setText(
                    String.format("%04d-%02d-%02d", year, month + 1, day)
                )
            }, endCal.get(Calendar.YEAR),
                endCal.get(Calendar.MONTH),
                endCal.get(Calendar.DAY_OF_MONTH)
            ).show()
        }
    }

    private fun setupSubmitButton() {
        binding.btnSubmitExport.setOnClickListener {
            val selectedIndex  = binding.spinnerPeriod.selectedItemPosition
            val selectedPeriod = periodValues[selectedIndex]

            // Validate custom dates
            if (selectedPeriod == "custom") {
                val start = binding.etStartDate.text.toString().trim()
                val end   = binding.etEndDate.text.toString().trim()
                if (start.isEmpty() || end.isEmpty()) {
                    Toast.makeText(requireContext(), "Please select both start and end dates.", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                if (start > end) {
                    Toast.makeText(requireContext(), "Start date must be before end date.", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                sendReport(selectedPeriod, start, end)
            } else {
                sendReport(selectedPeriod, null, null)
            }
        }
    }

    private fun sendReport(period: String, startDate: String?, endDate: String?) {
        val userId = getUserId()
        if (userId.isEmpty()) return

        binding.layoutLoading.visibility  = View.VISIBLE
        binding.btnSubmitExport.isEnabled = false

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val resp = ApiClient.authApi.exportTransactionsPDF(
                    token     = getToken(),
                    userId    = userId,
                    period    = period,
                    startDate = startDate,
                    endDate   = endDate
                )

                binding.layoutLoading.visibility  = View.GONE
                binding.btnSubmitExport.isEnabled = true

                if (resp.isSuccessful && resp.body()?.success == true) {
                    showSuccessState()
                } else {
                    Toast.makeText(requireContext(), "Failed to send report. Please try again.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                binding.layoutLoading.visibility  = View.GONE
                binding.btnSubmitExport.isEnabled = true
                Toast.makeText(requireContext(), "Something went wrong.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showSuccessState() {
        androidx.appcompat.app.AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setTitle("Report Sent ✓")
            .setMessage("Your transaction report has been sent to your registered email. Check your inbox.")
            .setPositiveButton("Done") { _, _ -> findNavController().navigateUp() }
            .setCancelable(false)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}