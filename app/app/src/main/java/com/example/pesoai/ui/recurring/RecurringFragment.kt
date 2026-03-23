package com.example.pesoai.ui.recurring

import android.app.DatePickerDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.content.Context
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.pesoai.api.ApiClient
import kotlinx.coroutines.launch
import androidx.lifecycle.lifecycleScope
import com.example.pesoai.R
import com.example.pesoai.api.models.RecurringRequest
import com.example.pesoai.api.models.RecurringTransaction
import com.example.pesoai.databinding.FragmentRecurringBinding
import com.google.android.material.button.MaterialButton
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import java.text.SimpleDateFormat
import java.util.*

class RecurringFragment : Fragment() {

    private var _binding: FragmentRecurringBinding? = null
    private val binding get() = _binding!!
    private val viewModel: RecurringViewModel by viewModels()
    private lateinit var adapter: RecurringAdapter

    private val frequencies = listOf("Daily", "Weekly", "Biweekly", "Monthly", "Yearly")
    private val frequencyValues = listOf("daily", "weekly", "biweekly", "monthly", "yearly")

    private val allCategories = mutableListOf<String>()

    private var currentFilter: String? = null  // null = active only, "active", "cancelled", "completed", "all"

    // ── Pagination state ──────────────────────────────────────────────────────
    private var allRecurring: List<RecurringTransaction> = emptyList()
    private var currentPage = 1
    private val pageSize = 10
    // ─────────────────────────────────────────────────────────────────────────

    private fun loadCategories() {
        val prefs  = requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        val token  = "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
        val userId = prefs.getString("user_id", "") ?: ""
        if (userId.isEmpty()) return

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val resp = ApiClient.authApi.getCategories(token, userId)
                if (resp.isSuccessful && resp.body()?.success == true) {
                    allCategories.clear()
                    allCategories.addAll(resp.body()!!.categories.map { it.name })
                }
            } catch (_: Exception) { }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRecurringBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupObservers()
        setupClickListeners()
        setupTabs()
        setupRecPaginationButtons()
        loadCategories()
        viewModel.loadRecurring(currentFilter)
    }

    private fun setupRecyclerView() {
        adapter = RecurringAdapter(
            onEditClick   = { showActionDialog(it) },
            onDeleteClick = { showActionDialog(it) }
        )
        binding.rvRecurring.layoutManager = LinearLayoutManager(requireContext())
        binding.rvRecurring.adapter = adapter
    }

    private fun setupObservers() {
        viewModel.recurring.observe(viewLifecycleOwner) { list ->
            allRecurring = list
            applyRecPage(1)
        }
        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }
        viewModel.error.observe(viewLifecycleOwner) { err ->
            if (!err.isNullOrBlank())
                Toast.makeText(requireContext(), err, Toast.LENGTH_LONG).show()
        }
        viewModel.success.observe(viewLifecycleOwner) { msg ->
            Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupClickListeners() {
        binding.btnBack.setOnClickListener { findNavController().navigateUp() }
    }

    private fun setupTabs() {
        binding.chipAll.setOnClickListener {
            currentFilter = "all"; currentPage = 1
            viewModel.loadRecurring(currentFilter)
        }
        binding.chipActive.setOnClickListener {
            currentFilter = "active"; currentPage = 1
            viewModel.loadRecurring(currentFilter)
        }
        binding.chipCompleted.setOnClickListener {
            currentFilter = "completed"; currentPage = 1
            viewModel.loadRecurring(currentFilter)
        }
        binding.chipCancelled.setOnClickListener {
            currentFilter = "cancelled"; currentPage = 1
            viewModel.loadRecurring(currentFilter)
        }
    }

    // ── Pagination ────────────────────────────────────────────────────────────

    private fun applyRecPage(page: Int) {
        currentPage = page
        val total      = allRecurring.size
        val totalPages = maxOf(1, Math.ceil(total.toDouble() / pageSize).toInt())
        val start      = (page - 1) * pageSize
        val end        = minOf(start + pageSize, total)
        val pageItems  = if (start < total) allRecurring.subList(start, end) else emptyList()

        adapter.submitList(pageItems)
        binding.layoutEmpty.visibility =
            if (allRecurring.isEmpty()) View.VISIBLE else View.GONE

        if (totalPages > 1) {
            binding.layoutRecPagination.visibility = View.VISIBLE
            binding.tvRecPageIndicator.text         = "Page $currentPage of $totalPages"
            binding.btnRecPrevPage.isEnabled        = currentPage > 1
            binding.btnRecPrevPage.alpha            = if (currentPage > 1) 1f else 0.3f
            binding.btnRecNextPage.isEnabled        = currentPage < totalPages
            binding.btnRecNextPage.alpha            = if (currentPage < totalPages) 1f else 0.3f
        } else {
            binding.layoutRecPagination.visibility = View.GONE
        }
    }

    private fun setupRecPaginationButtons() {
        binding.btnRecPrevPage.setOnClickListener {
            if (currentPage > 1) applyRecPage(currentPage - 1)
        }
        binding.btnRecNextPage.setOnClickListener {
            val totalPages = maxOf(1, Math.ceil(allRecurring.size.toDouble() / pageSize).toInt())
            if (currentPage < totalPages) applyRecPage(currentPage + 1)
        }
    }

    // ── Action Menu ───────────────────────────────────────────────────────────

    private fun showActionDialog(rec: RecurringTransaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_recurring_action, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        dialogView.findViewById<android.widget.TextView>(R.id.tvActionTitle).text =
            "${(rec.description?.takeIf { it.isNotBlank() }
                ?: rec.category.replaceFirstChar { it.uppercase() })} — ₱${rec.amount.toInt()}"

        val subtitle = when (rec.status) {
            "completed" -> if (!rec.completedAt.isNullOrBlank())
                "✓ Fully paid on ${formatNextDue(rec.completedAt)}"
            else "✓ Completed"
            "cancelled" -> "✗ Cancelled"
            else        -> "Next due: ${formatNextDue(rec.nextRunDate)}"
        }
        dialogView.findViewById<android.widget.TextView>(R.id.tvActionSubtitle).text = subtitle

        val isActive    = rec.status == "active"
        val btnEdit     = dialogView.findViewById<MaterialButton>(R.id.btnActionEdit)
        val btnMarkPaid = dialogView.findViewById<MaterialButton>(R.id.btnActionMarkPaid)
        val btnDismiss  = dialogView.findViewById<MaterialButton>(R.id.btnActionDismiss)

        btnEdit.visibility     = if (isActive) View.VISIBLE else View.GONE
        btnMarkPaid.visibility = if (isActive) View.VISIBLE else View.GONE
        btnDismiss.visibility  = if (isActive) View.VISIBLE else View.GONE

        btnEdit.setOnClickListener     { dialog.dismiss(); showEditRecurringDialog(rec) }
        btnMarkPaid.setOnClickListener { dialog.dismiss(); confirmMarkAsPaid(rec) }
        btnDismiss.setOnClickListener  { dialog.dismiss(); confirmDismiss(rec) }
        dialogView.findViewById<MaterialButton>(R.id.btnActionDelete)
            .setOnClickListener { dialog.dismiss(); confirmDelete(rec) }
        dialogView.findViewById<MaterialButton>(R.id.btnActionCancel)
            .setOnClickListener { dialog.dismiss() }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun formatNextDue(dateStr: String): String {
        return try {
            val deviceTz = TimeZone.getDefault()
            val parsedDate: java.util.Date? = when {
                dateStr.length > 10 -> {
                    val formats = listOf(
                        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                        "yyyy-MM-dd'T'HH:mm:ss'Z'",
                        "yyyy-MM-dd'T'HH:mm:ssXXX"
                    )
                    formats.firstNotNullOfOrNull { fmt ->
                        try {
                            SimpleDateFormat(fmt, Locale.US)
                                .also { it.timeZone = TimeZone.getTimeZone("UTC") }
                                .parse(dateStr)
                        } catch (_: Exception) { null }
                    }
                }
                else -> {
                    SimpleDateFormat("yyyy-MM-dd", Locale.US)
                        .also { it.timeZone = deviceTz }
                        .parse(dateStr.take(10))
                }
            } ?: return dateStr

            val dateCal = Calendar.getInstance(deviceTz).also { it.time = parsedDate!! }
            dateCal.set(Calendar.HOUR_OF_DAY, 0)
            dateCal.set(Calendar.MINUTE, 0)
            dateCal.set(Calendar.SECOND, 0)
            dateCal.set(Calendar.MILLISECOND, 0)

            val todayCal = Calendar.getInstance(deviceTz).apply {
                set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0);      set(Calendar.MILLISECOND, 0)
            }
            val tomorrowCal = Calendar.getInstance(deviceTz).apply {
                set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0);      set(Calendar.MILLISECOND, 0)
                add(Calendar.DAY_OF_YEAR, 1)
            }

            fun isSameDay(c1: Calendar, c2: Calendar) =
                c1.get(Calendar.YEAR)        == c2.get(Calendar.YEAR) &&
                        c1.get(Calendar.DAY_OF_YEAR) == c2.get(Calendar.DAY_OF_YEAR)

            val day  = dateCal.get(Calendar.DAY_OF_MONTH)
            val year = dateCal.get(Calendar.YEAR)

            when {
                isSameDay(dateCal, todayCal)    -> "Today"
                isSameDay(dateCal, tomorrowCal) -> "Tomorrow"
                else -> String.format("%s %02d, %d",
                    dateCal.getDisplayName(Calendar.MONTH, Calendar.SHORT, Locale.getDefault()),
                    day, year)
            }
        } catch (_: Exception) { dateStr }
    }

    // ── Edit Dialog ───────────────────────────────────────────────────────────

    private fun showEditRecurringDialog(existing: RecurringTransaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_edit_recurring, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilAmount        = dialogView.findViewById<TextInputLayout>(R.id.tilAmount)
        val etAmount         = dialogView.findViewById<TextInputEditText>(R.id.etAmount)
        val tilCategory      = dialogView.findViewById<TextInputLayout>(R.id.tilCategory)
        val actvCategory     = dialogView.findViewById<AutoCompleteTextView>(R.id.actvCategory)
        val etDescription    = dialogView.findViewById<TextInputEditText>(R.id.etDescription)
        val actvFrequency    = dialogView.findViewById<AutoCompleteTextView>(R.id.actvFrequency)
        val etRepeatInterval = dialogView.findViewById<TextInputEditText>(R.id.etRepeatInterval)
        val etStartDate      = dialogView.findViewById<TextInputEditText>(R.id.etStartDate)
        val etEndDate        = dialogView.findViewById<TextInputEditText>(R.id.etEndDate)
        val switchReminder   = dialogView.findViewById<SwitchMaterial>(R.id.switchReminder)
        val tvReminderNote   = dialogView.findViewById<android.widget.TextView>(R.id.tvReminderNote)
        val btnCancel        = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnSave          = dialogView.findViewById<MaterialButton>(R.id.btnSave)

        actvCategory.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, allCategories)
        )
        actvCategory.inputType = android.text.InputType.TYPE_NULL
        actvFrequency.setAdapter(
            ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, frequencies)
        )

        val existingStartParts = existing.startDate.take(10).split("-")
        val startYear  = existingStartParts.getOrNull(0)?.toIntOrNull() ?: Calendar.getInstance().get(Calendar.YEAR)
        val startMonth = (existingStartParts.getOrNull(1)?.toIntOrNull() ?: 1) - 1
        val startDay   = existingStartParts.getOrNull(2)?.toIntOrNull() ?: 1

        etStartDate.setOnClickListener {
            DatePickerDialog(requireContext(), { _, y, m, d ->
                etStartDate.setText(String.format("%04d-%02d-%02d", y, m + 1, d))
            }, startYear, startMonth, startDay).show()
        }

        etEndDate.setOnClickListener {
            val c = Calendar.getInstance()
            val endParts = existing.endDate?.take(10)?.split("-")
            val ey = endParts?.getOrNull(0)?.toIntOrNull() ?: c.get(Calendar.YEAR)
            val em = (endParts?.getOrNull(1)?.toIntOrNull() ?: 1) - 1
            val ed = endParts?.getOrNull(2)?.toIntOrNull() ?: c.get(Calendar.DAY_OF_MONTH)
            DatePickerDialog(requireContext(), { _, y, m, d ->
                etEndDate.setText(String.format("%04d-%02d-%02d", y, m + 1, d))
            }, ey, em, ed).show()
        }

        switchReminder.setOnCheckedChangeListener { _, checked ->
            tvReminderNote.visibility = if (checked) View.VISIBLE else View.GONE
        }

        etAmount.setText(existing.amount.toInt().toString())
        actvCategory.setText(
            allCategories.firstOrNull { it.lowercase() == existing.category.lowercase() }
                ?: existing.category, false
        )
        etDescription.setText(existing.description ?: "")
        actvFrequency.setText(
            frequencies.getOrNull(frequencyValues.indexOf(existing.frequency)) ?: "Monthly", false
        )
        etRepeatInterval.setText(existing.repeatInterval.toString())
        etStartDate.setText(existing.startDate.take(10))
        existing.endDate?.let { etEndDate.setText(it.take(10)) }
        switchReminder.isChecked = existing.reminderEnabled
        tvReminderNote.visibility = if (existing.reminderEnabled) View.VISIBLE else View.GONE

        btnCancel.setOnClickListener { dialog.dismiss() }

        btnSave.setOnClickListener {
            val amount   = etAmount.text.toString().toDoubleOrNull()
            val category = actvCategory.text.toString().trim().lowercase()
            val freqIdx  = frequencies.indexOfFirst {
                it.equals(actvFrequency.text.toString().trim(), ignoreCase = true)
            }
            val interval = etRepeatInterval.text.toString().toIntOrNull()?.coerceAtLeast(1) ?: 1

            if (amount == null || amount <= 0) {
                tilAmount.error = getString(R.string.error_invalid_amount)
                return@setOnClickListener
            } else tilAmount.error = null

            if (category.isEmpty()) {
                tilCategory.error = getString(R.string.error_select_category)
                return@setOnClickListener
            } else tilCategory.error = null

            val descriptionValue = etDescription.text.toString().trim()

            val request = RecurringRequest(
                amount          = amount,
                category        = category,
                description     = descriptionValue.ifEmpty { null },
                transactionType = "expense",
                frequency       = if (freqIdx >= 0) frequencyValues[freqIdx] else "monthly",
                repeatInterval  = interval,
                startDate       = etStartDate.text.toString(),
                endDate         = etEndDate.text.toString().ifEmpty { null },
                reminderEnabled = switchReminder.isChecked
            )
            viewModel.updateRecurring(existing.id, request)
            dialog.dismiss()
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ── Confirm Dialogs ───────────────────────────────────────────────────────

    private fun confirmMarkAsPaid(rec: RecurringTransaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_confirm_action, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogIcon).apply {
            text = "💸"
            setBackgroundResource(R.drawable.circle_background_green)
        }
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogTitle).text =
            getString(R.string.recurring_action_mark_paid)
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogSubtitle).text =
            "This will deduct from your balance"
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogMessage).text =
            "${rec.category.replaceFirstChar { it.uppercase() }} — ₱${rec.amount.toInt()}\n\n" +
                    "Record this payment and advance the next due date?"

        val btnConfirm = dialogView.findViewById<MaterialButton>(R.id.btnConfirm)
        btnConfirm.text = getString(R.string.btn_confirm)
        btnConfirm.backgroundTintList = android.content.res.ColorStateList.valueOf(
            androidx.core.content.ContextCompat.getColor(requireContext(), R.color.green_success)
        )

        dialogView.findViewById<MaterialButton>(R.id.btnCancel)
            .setOnClickListener { dialog.dismiss() }
        btnConfirm.setOnClickListener {
            viewModel.markAsPaid(rec.id)
            dialog.dismiss()
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun confirmDismiss(rec: RecurringTransaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_confirm_action, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogIcon).apply {
            text = "⏭️"
            setBackgroundResource(R.drawable.circle_background_orange)
        }
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogTitle).text =
            getString(R.string.recurring_action_dismiss)
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogSubtitle).text =
            "Balance will not be affected"
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogMessage).text =
            "${rec.category.replaceFirstChar { it.uppercase() }} — ₱${rec.amount.toInt()}\n\n" +
                    "Skip this occurrence and advance the next due date?"

        val btnConfirm = dialogView.findViewById<MaterialButton>(R.id.btnConfirm)
        btnConfirm.text = getString(R.string.btn_confirm)
        btnConfirm.backgroundTintList = android.content.res.ColorStateList.valueOf(
            androidx.core.content.ContextCompat.getColor(requireContext(), R.color.orange_warning)
        )

        dialogView.findViewById<MaterialButton>(R.id.btnCancel)
            .setOnClickListener { dialog.dismiss() }
        btnConfirm.setOnClickListener {
            viewModel.dismissForMonth(rec.id)
            dialog.dismiss()
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun confirmDelete(rec: RecurringTransaction) {
        when (rec.status) {
            "completed", "cancelled" -> showHardDeleteDialog(rec)
            else                     -> showCancelDialog(rec)
        }
    }

    private fun showCancelDialog(rec: RecurringTransaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_delete_confirm, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogTitle).text =
            "Cancel Recurring Transaction?"
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogSubtitle).text =
            "This will stop future payments"
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogItemName).text =
            "${rec.category.replaceFirstChar { it.uppercase() }} — ${
                rec.frequency.replaceFirstChar { it.uppercase() }
            }"
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogMessage).text =
            "This will mark the recurring transaction as cancelled. You can still see it in the Completed tab and permanently delete it later."

        dialogView.findViewById<MaterialButton>(R.id.btnCancel)
            .setOnClickListener { dialog.dismiss() }

        val btnDelete = dialogView.findViewById<MaterialButton>(R.id.btnDelete)
        btnDelete.text = "Cancel Transaction"
        btnDelete.setOnClickListener {
            viewModel.cancelRecurring(rec.id)
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun showHardDeleteDialog(rec: RecurringTransaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_delete_confirm, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogTitle).text =
            getString(R.string.recurring_delete_title)
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogSubtitle).text =
            "⚠️ This cannot be undone!"
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogItemName).text =
            "${rec.category.replaceFirstChar { it.uppercase() }} — ${
                rec.frequency.replaceFirstChar { it.uppercase() }
            }"
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogMessage).text =
            "This will PERMANENTLY delete this recurring transaction from the database. All history will be lost."

        dialogView.findViewById<MaterialButton>(R.id.btnCancel)
            .setOnClickListener { dialog.dismiss() }

        val btnDelete = dialogView.findViewById<MaterialButton>(R.id.btnDelete)
        btnDelete.backgroundTintList = android.content.res.ColorStateList.valueOf(
            androidx.core.content.ContextCompat.getColor(requireContext(), R.color.red_error)
        )
        btnDelete.setOnClickListener {
            viewModel.deleteRecurring(rec.id)
            dialog.dismiss()
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}