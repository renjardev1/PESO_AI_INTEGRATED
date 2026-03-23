package com.example.pesoai.ui.transactions

import android.app.DatePickerDialog
import android.content.Context
import android.content.res.ColorStateList
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.pesoai.R
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.Transaction
import com.example.pesoai.api.models.RecurringTransaction
import com.example.pesoai.databinding.FragmentTransactionBinding
import com.example.pesoai.ui.recurring.RecurringPreviewAdapter
import com.example.pesoai.ui.settings.CategoryViewModel
import com.example.pesoai.utils.BudgetNotificationHelper
import com.example.pesoai.utils.BudgetUtils
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class TransactionFragment : Fragment() {

    private var _binding: FragmentTransactionBinding? = null
    private val binding get() = _binding!!
    private val viewModel: TransactionViewModel by viewModels()
    private val categoryViewModel: CategoryViewModel by activityViewModels()
    private lateinit var adapter: TransactionAdapter
    private lateinit var upcomingAdapter: RecurringPreviewAdapter
    private var allTransactions: List<Transaction> = emptyList()
    private var recurringDirty = true

    // ── Date formatters ──────────────────────────────────────────────────────
    private val storedDateFmt  = SimpleDateFormat("yyyy-MM-dd",               Locale.getDefault())
    private val isoDateFmt     = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss",   Locale.US)
    private val displayDateFmt = SimpleDateFormat("MMMM dd, yyyy",            Locale.getDefault())
    private val displayTimeFmt = SimpleDateFormat("MMM dd, yyyy 'at' h:mm a", Locale.getDefault())

    // ── Filter state ─────────────────────────────────────────────────────────
    private var activeTypeFilter: String?     = null
    private var activeCategoryFilter: String? = null
    private var filterStartDate: String?      = null
    private var filterEndDate: String?        = null

    private fun getPrefs() =
        requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTransactionBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        categoryViewModel.loadCategories()
        setupRecyclerView()
        setupUpcomingRecurring()
        setupObservers()
        setupClickListeners()
        setupSearchBar()
        setupStaticChips()
        loadTransactionsWithPeriod()
        loadUpcomingRecurring()

        // ── FIX: load monthly summary from API on every visit ────────────────
        val now = Calendar.getInstance()
        viewModel.loadMonthlySummary(
            now.get(Calendar.YEAR),
            now.get(Calendar.MONTH) + 1
        )
    }

    override fun onResume() {
        super.onResume()
        if (_binding != null) {
            loadTransactionsWithPeriod()
            // ── FIX: refresh summary on resume so income is always current ───
            val now = Calendar.getInstance()
            viewModel.loadMonthlySummary(
                now.get(Calendar.YEAR),
                now.get(Calendar.MONTH) + 1
            )
            if (recurringDirty) {
                loadUpcomingRecurring()
                recurringDirty = false
            }
        }
    }

    private fun setupRecyclerView() {
        adapter = TransactionAdapter(
            onItemClick   = { showTransactionDetails(it) },
            onDeleteClick = { deleteTransaction(it) }
        )
        adapter.categories = categoryViewModel.categories.value ?: emptyList()
        binding.rvTransactions.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter       = this@TransactionFragment.adapter
        }
    }

    private fun setupObservers() {
        viewModel.transactions.observe(viewLifecycleOwner) { transactions ->
            allTransactions = transactions
            updateSummaryCards(transactions)
            applyFilters()
        }

        // ── FIX: observe monthlySummary so cards refresh when API responds ───
        // This is the key fix — previously there was no observer here, so even
        // though loadMonthlySummary() was called, the cards never updated.
        viewModel.monthlySummary.observe(viewLifecycleOwner) {
            // Re-run updateSummaryCards with the current transaction list
            // so income is immediately reflected without waiting for a reload
            updateSummaryCards(allTransactions)
        }

        categoryViewModel.categories.observe(viewLifecycleOwner) { cats ->
            adapter.categories = cats
            adapter.notifyDataSetChanged()
            populateDynamicCategoryChips()
        }
        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        }
        viewModel.error.observe(viewLifecycleOwner) { error ->
            if (!error.isNullOrEmpty())
                Toast.makeText(requireContext(), error, Toast.LENGTH_LONG).show()
        }
        viewModel.budgetBlocked.observe(viewLifecycleOwner) { data ->
            data?.let { showBudgetBlockedDialog(it) }
        }
        viewModel.budgetWarning.observe(viewLifecycleOwner) { data ->
            data?.let { showBudgetWarningDialog(it) }
        }
    }

    private fun setupClickListeners() {
        binding.fabAddTransaction.setOnClickListener { showAddTransactionDialog() }
        binding.btnDownloadTransactions.setOnClickListener {
            findNavController().navigate(R.id.action_transactions_to_export)
        }
    }

    private fun setupSearchBar() {
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { applyFilters() }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    // ── Chip wiring ──────────────────────────────────────────────────────────

    private fun setupStaticChips() {
        binding.chipFilterAll.setOnClickListener {
            activeTypeFilter     = null
            activeCategoryFilter = null
            filterStartDate      = null
            filterEndDate        = null
            syncChipState(null, null)
            applyFilters()
        }
        binding.chipFilterExpense.setOnClickListener {
            activeTypeFilter     = if (activeTypeFilter == "expense") null else "expense"
            activeCategoryFilter = null
            syncChipState(activeTypeFilter, null)
            applyFilters()
        }
        binding.chipFilterSavings.setOnClickListener {
            activeTypeFilter     = if (activeTypeFilter == "savings") null else "savings"
            activeCategoryFilter = null
            syncChipState(activeTypeFilter, null)
            applyFilters()
        }
        binding.chipMoreCategories.setOnClickListener { showMoreCategoriesDialog() }
        binding.chipDateRange.setOnClickListener { showDateRangeDialog() }
    }

    private fun populateDynamicCategoryChips() {
        val cats = categoryViewModel.categories.value ?: return
        val top2 = cats.take(2)
        listOf(binding.chipCat1, binding.chipCat2).forEachIndexed { i, chip ->
            val cat = top2.getOrNull(i)
            if (cat != null) {
                chip.text       = cat.name.capitalizeWords()
                chip.visibility = View.VISIBLE
                chip.setOnClickListener {
                    activeCategoryFilter = if (activeCategoryFilter.equals(cat.name, ignoreCase = true))
                        null else cat.name
                    activeTypeFilter = null
                    syncChipState(null, activeCategoryFilter)
                    applyFilters()
                }
            } else {
                chip.visibility = View.GONE
            }
        }
    }

    private fun syncChipState(typeFilter: String?, catFilter: String?) {
        binding.chipFilterAll.isChecked     = typeFilter == null && catFilter == null && filterStartDate == null
        binding.chipFilterExpense.isChecked = typeFilter == "expense"
        binding.chipFilterSavings.isChecked = typeFilter == "savings"

        val cats = categoryViewModel.categories.value?.take(2) ?: emptyList()
        listOf(binding.chipCat1, binding.chipCat2).forEachIndexed { i, chip ->
            chip.isChecked = cats.getOrNull(i)?.name?.equals(catFilter, ignoreCase = true) == true
        }

        val top2Names = cats.map { it.name.lowercase() }
        if (catFilter != null && !top2Names.contains(catFilter.lowercase())) {
            binding.chipMoreCategories.text      = catFilter.capitalizeWords()
            binding.chipMoreCategories.isChecked = true
        } else {
            binding.chipMoreCategories.text      = "More ▾"
            binding.chipMoreCategories.isChecked = false
        }

        binding.chipDateRange.isChecked = filterStartDate != null
        binding.chipDateRange.text =
            if (filterStartDate != null) "📅 $filterStartDate → $filterEndDate"
            else "📅 Date Range"
    }

    private fun showMoreCategoriesDialog() {
        val cats = categoryViewModel.categories.value ?: return
        val names = cats.map { it.name.capitalizeWords() }.toTypedArray()
        val currentIdx = cats.indexOfFirst {
            it.name.equals(activeCategoryFilter, ignoreCase = true)
        }.takeIf { it >= 0 }

        AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setTitle("Select Category")
            .setSingleChoiceItems(names, currentIdx ?: -1) { dialog, which ->
                activeCategoryFilter = cats[which].name
                activeTypeFilter     = null
                syncChipState(null, activeCategoryFilter)
                applyFilters()
                dialog.dismiss()
            }
            .setNegativeButton("Clear") { _, _ ->
                activeCategoryFilter = null
                syncChipState(activeTypeFilter, null)
                applyFilters()
            }
            .show()
    }

    private fun showDateRangeDialog() {
        val cal = Calendar.getInstance()
        DatePickerDialog(requireContext(), { _, sy, sm, sd ->
            val start = String.format("%04d-%02d-%02d", sy, sm + 1, sd)
            DatePickerDialog(requireContext(), { _, ey, em, ed ->
                filterStartDate = start
                filterEndDate   = String.format("%04d-%02d-%02d", ey, em + 1, ed)
                syncChipState(activeTypeFilter, activeCategoryFilter)
                applyFilters()
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH),
                cal.get(Calendar.DAY_OF_MONTH)).apply { setTitle("Select End Date") }.show()
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH),
            cal.get(Calendar.DAY_OF_MONTH)).apply { setTitle("Select Start Date") }.show()
    }

    // ── Filter + grouping ────────────────────────────────────────────────────

    private fun applyFilters() {
        val query = binding.etSearch.text?.toString() ?: ""
        val filtered = allTransactions.filter { tx ->
            val typeMatch = when (activeTypeFilter) {
                "expense" -> tx.transactionType == "expense" && tx.category.lowercase() != "savings"
                "savings" -> tx.category.lowercase() == "savings"
                else      -> true
            }
            val catMatch  = activeCategoryFilter == null ||
                    tx.category.equals(activeCategoryFilter, ignoreCase = true)
            val dateMatch = if (filterStartDate != null && filterEndDate != null)
                tx.transactionDate.take(10) in filterStartDate!!..filterEndDate!!
            else true
            val search = query.isEmpty() ||
                    tx.category.contains(query, ignoreCase = true) ||
                    tx.description?.contains(query, ignoreCase = true) == true ||
                    tx.amount.toString().contains(query)
            typeMatch && catMatch && dateMatch && search
        }

        val grouped = groupTransactionsByPeriod(filtered)
        adapter.submitList(grouped)
        binding.tvEmptyState.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    // ── Data loading ─────────────────────────────────────────────────────────

    private fun loadTransactionsWithPeriod() {
        val prefs  = getPrefs()
        val userId = prefs.getString("user_id", "") ?: ""
        val token  = "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
        val period = prefs.getString("budget_period", "Monthly") ?: "Monthly"
        val (startDate, endDate) = BudgetUtils.getPeriodDates(period)
        if (userId.isNotEmpty()) viewModel.loadTransactions(token, userId, startDate, endDate)
    }

    private fun updateSummaryCards(transactions: List<Transaction>) {
        val prefs = getPrefs()
        val fmt   = NumberFormat.getNumberInstance(Locale.US)

        // ── FIX: priority order for income ───────────────────────────────────
        // 1. API monthlySummary response (most accurate, from user_profiles)
        // 2. SharedPreferences cache written by Dashboard (fallback)
        // 3. Zero (last resort)
        val summaryIncome = viewModel.monthlySummary.value?.income ?: 0.0
        val monthlyIncome = when {
            summaryIncome > 0 -> summaryIncome
            else -> prefs.getFloat("monthly_income", 0f).toDouble()
        }

        val totalExpenses = transactions.sumOf { it.amount }
        val netBalance    = monthlyIncome - totalExpenses

        prefs.edit().putFloat("cached_total_spent", totalExpenses.toFloat()).apply()

        binding.tvTotalIncome.text   = "₱${fmt.format(monthlyIncome.toInt())}"
        binding.tvTotalExpenses.text = "₱${fmt.format(totalExpenses.toInt())}"
        binding.tvNetBalance.text    = "₱${fmt.format(netBalance.toInt())}"
        binding.tvNetBalance.setTextColor(
            ContextCompat.getColor(requireContext(),
                if (netBalance >= 0) R.color.green_success else R.color.red_error)
        )
        BudgetNotificationHelper.checkAndNotify(requireContext(), totalExpenses)
    }

    private fun refreshCategoryAdapter(actv: AutoCompleteTextView) {
        val names = categoryViewModel.categories.value?.map { it.name } ?: emptyList()
        actv.setAdapter(ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, names))
        actv.inputType  = android.text.InputType.TYPE_NULL
        actv.keyListener = null
    }

    // ==================== ADD TRANSACTION DIALOG ====================

    private fun showAddTransactionDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_add_transaction, null)
        val dialog     = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilAmount             = dialogView.findViewById<TextInputLayout>(R.id.tilAmount)
        val etAmount              = dialogView.findViewById<TextInputEditText>(R.id.etAmount)
        val tilCategory           = dialogView.findViewById<TextInputLayout>(R.id.tilCategory)
        val actvCategory          = dialogView.findViewById<AutoCompleteTextView>(R.id.actvCategory)
        val etDescription         = dialogView.findViewById<TextInputEditText>(R.id.etDescription)
        val etDate                = dialogView.findViewById<TextInputEditText>(R.id.etDate)
        val btnCancel             = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnAdd                = dialogView.findViewById<MaterialButton>(R.id.btnAdd)
        val switchRecurring       = dialogView.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.switchRecurring)
        val layoutRecurringFields = dialogView.findViewById<android.view.ViewGroup>(R.id.layoutRecurringFields)
        val actvFrequency         = dialogView.findViewById<AutoCompleteTextView>(R.id.actvFrequency)
        val etRepeatInterval      = dialogView.findViewById<TextInputEditText>(R.id.etRepeatInterval)
        val switchReminder        = dialogView.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.switchReminder)
        val tvReminderNote        = dialogView.findViewById<android.widget.TextView>(R.id.tvReminderNote)
        val etEndDate             = dialogView.findViewById<TextInputEditText>(R.id.etEndDate)

        refreshCategoryAdapter(actvCategory)

        val calendar   = Calendar.getInstance()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        etDate.setText(dateFormat.format(calendar.time))
        etDate.setOnClickListener {
            DatePickerDialog(requireContext(), { _, y, m, d ->
                etDate.setText(String.format("%04d-%02d-%02d", y, m + 1, d))
            }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH),
                calendar.get(Calendar.DAY_OF_MONTH)).show()
        }
        etEndDate.setOnClickListener {
            val c = Calendar.getInstance()
            DatePickerDialog(requireContext(), { _, y, m, d ->
                etEndDate.setText(String.format("%04d-%02d-%02d", y, m + 1, d))
            }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show()
        }

        val frequencyOptions = listOf("Daily", "Weekly", "Biweekly", "Monthly", "Yearly")
        val frequencyValues  = listOf("daily", "weekly", "biweekly", "monthly", "yearly")
        actvFrequency.setAdapter(ArrayAdapter(requireContext(), android.R.layout.simple_dropdown_item_1line, frequencyOptions))
        actvFrequency.setText("Monthly", false)

        switchRecurring.setOnCheckedChangeListener { _, isChecked ->
            layoutRecurringFields.visibility = if (isChecked) View.VISIBLE else View.GONE
        }
        switchReminder.setOnCheckedChangeListener { _, checked ->
            tvReminderNote.visibility = if (checked) View.VISIBLE else View.GONE
        }

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnAdd.setOnClickListener {
            val amount      = etAmount.text.toString().toDoubleOrNull()
            val category    = actvCategory.text.toString().trim().lowercase()
            val description = etDescription.text.toString()
            val date        = etDate.text.toString()

            if (amount == null || amount <= 0) { tilAmount.error = getString(R.string.error_invalid_amount); return@setOnClickListener } else tilAmount.error = null
            if (category.isEmpty()) { tilCategory.error = getString(R.string.error_select_category); return@setOnClickListener } else tilCategory.error = null

            if (switchRecurring.isChecked) {
                val freqIdx = frequencyOptions.indexOfFirst { it.equals(actvFrequency.text.toString().trim(), ignoreCase = true) }
                val prefs  = getPrefs()
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        val resp = ApiClient.authApi.createRecurring(
                            "Bearer ${prefs.getString("jwt_token", "") ?: ""}",
                            prefs.getString("user_id", "") ?: "",
                            com.example.pesoai.api.models.RecurringRequest(
                                amount          = amount,
                                category        = category,
                                description     = description.ifEmpty { null },
                                transactionType = "expense",
                                frequency       = if (freqIdx >= 0) frequencyValues[freqIdx] else "monthly",
                                repeatInterval  = etRepeatInterval.text.toString().toIntOrNull() ?: 1,
                                startDate       = date,
                                endDate         = etEndDate.text.toString().ifEmpty { null },
                                reminderEnabled = switchReminder.isChecked
                            )
                        )
                        if (resp.isSuccessful && resp.body()?.success == true) {
                            recurringDirty = true
                            Toast.makeText(requireContext(), getString(R.string.recurring_created_toast), Toast.LENGTH_LONG).show()
                            loadUpcomingRecurring()
                        } else {
                            Toast.makeText(requireContext(), "Failed to create recurring transaction.", Toast.LENGTH_SHORT).show()
                        }
                    } catch (e: Exception) {
                        Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            } else {
                viewModel.addTransaction(amount = amount, category = category, description = description.ifEmpty { null }, transactionType = "expense", transactionDate = date)
                invalidateDashboardCache()
            }
            dialog.dismiss()
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ==================== TRANSACTION DETAILS DIALOG ====================

    private fun showTransactionDetails(transaction: Transaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_transaction_details, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme).setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val (icon, colorOrRes) = getCategoryIconAndBackground(transaction.category)
        val formatter          = NumberFormat.getNumberInstance(Locale.US)

        dialogView.findViewById<android.widget.TextView>(R.id.tvCategoryIcon).apply {
            text = icon
            try {
                val drawable = ContextCompat.getDrawable(requireContext(), R.drawable.circle_background_gray)?.mutate()
                drawable?.setTint(android.graphics.Color.parseColor(colorOrRes as String))
                background = drawable
            } catch (_: Exception) { setBackgroundResource(R.drawable.circle_background_gray) }
        }
        dialogView.findViewById<android.widget.TextView>(R.id.tvCategory).text        = transaction.category.capitalizeWords()
        dialogView.findViewById<android.widget.TextView>(R.id.tvAmount).text          = "₱${formatter.format(transaction.amount.toInt())}"
        dialogView.findViewById<android.widget.TextView>(R.id.tvTransactionType).text = transaction.transactionType.capitalizeWords()
        dialogView.findViewById<android.widget.TextView>(R.id.tvDescription).text     = transaction.description ?: "—"
        dialogView.findViewById<android.widget.TextView>(R.id.tvDate).text = try {
            displayDateFmt.format(storedDateFmt.parse(transaction.transactionDate.take(10))!!)
        } catch (e: Exception) { transaction.transactionDate }
        dialogView.findViewById<android.widget.TextView>(R.id.tvCreatedAt).text = try {
            displayTimeFmt.format(isoDateFmt.parse(transaction.createdAt?.take(19) ?: "")!!)
        } catch (e: Exception) { transaction.createdAt ?: "" }

        dialogView.findViewById<MaterialButton>(R.id.btnClose).setOnClickListener  { dialog.dismiss() }
        dialogView.findViewById<MaterialButton>(R.id.btnEdit).setOnClickListener   { dialog.dismiss(); showEditTransactionDialog(transaction) }
        dialogView.findViewById<MaterialButton>(R.id.btnDelete).setOnClickListener { dialog.dismiss(); showDeleteTransactionDialog(transaction) }
        dialog.show()
    }

    // ==================== RECURRING ACTION DIALOG ====================

    private fun showRecurringActionDialog(rec: RecurringTransaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_recurring_action, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme).setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val fmt = NumberFormat.getNumberInstance(Locale.US)
        dialogView.findViewById<android.widget.TextView>(R.id.tvActionIcon).text =
            when (rec.category.lowercase()) {
                "food & dining" -> "🍔"; "transport", "transportation" -> "🚗"
                "shopping" -> "🛍️"; "bills & utilities" -> "💡"
                "health" -> "❤️"; "entertainment" -> "🎬"; "savings" -> "💰"; else -> "🔁"
            }
        dialogView.findViewById<android.widget.TextView>(R.id.tvActionTitle).text =
            "${rec.description?.takeIf { it.isNotBlank() } ?: rec.category.capitalizeWords()} · ₱${fmt.format(rec.amount.toInt())}"
        dialogView.findViewById<android.widget.TextView>(R.id.tvActionSubtitle).text = "Due ${rec.nextRunDate.take(10)}"

        val prefs  = getPrefs()
        val token  = "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
        val userId = prefs.getString("user_id", "") ?: ""

        dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnActionMarkPaid).setOnClickListener {
            dialog.dismiss()
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    val resp = ApiClient.authApi.markRecurringAsPaid(token, userId, rec.id)
                    if (resp.isSuccessful && resp.body()?.success == true) {
                        recurringDirty = true
                        Toast.makeText(requireContext(), "Marked as paid.", Toast.LENGTH_SHORT).show()
                        loadUpcomingRecurring(); loadTransactionsWithPeriod(); invalidateDashboardCache()
                    } else Toast.makeText(requireContext(), "Failed to mark as paid.", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) { Toast.makeText(requireContext(), "Something went wrong.", Toast.LENGTH_SHORT).show() }
            }
        }
        dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnActionDismiss).setOnClickListener {
            dialog.dismiss()
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    val resp = ApiClient.authApi.dismissRecurring(token, userId, rec.id)
                    if (resp.isSuccessful && resp.body()?.success == true) {
                        recurringDirty = true
                        Toast.makeText(requireContext(), "Dismissed for this period.", Toast.LENGTH_SHORT).show()
                        loadUpcomingRecurring()
                    } else Toast.makeText(requireContext(), "Failed to dismiss.", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) { Toast.makeText(requireContext(), "Something went wrong.", Toast.LENGTH_SHORT).show() }
            }
        }
        dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnActionEdit).setOnClickListener { dialog.dismiss(); findNavController().navigate(R.id.action_transactions_to_recurring) }
        dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnActionDelete).setOnClickListener { dialog.dismiss(); findNavController().navigate(R.id.action_transactions_to_recurring) }
        dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnActionCancel).setOnClickListener { dialog.dismiss() }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ==================== EDIT TRANSACTION DIALOG ====================

    private fun showEditTransactionDialog(transaction: Transaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_add_transaction, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme).setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilAmount     = dialogView.findViewById<TextInputLayout>(R.id.tilAmount)
        val etAmount      = dialogView.findViewById<TextInputEditText>(R.id.etAmount)
        val tilCategory   = dialogView.findViewById<TextInputLayout>(R.id.tilCategory)
        val actvCategory  = dialogView.findViewById<AutoCompleteTextView>(R.id.actvCategory)
        val etDescription = dialogView.findViewById<TextInputEditText>(R.id.etDescription)
        val etDate        = dialogView.findViewById<TextInputEditText>(R.id.etDate)
        val btnCancel     = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnAdd        = dialogView.findViewById<MaterialButton>(R.id.btnAdd)

        btnAdd.text = getString(R.string.btn_save_changes)
        dialogView.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.switchRecurring).visibility = View.GONE
        dialogView.findViewById<View>(R.id.layoutRecurringFields).visibility = View.GONE

        refreshCategoryAdapter(actvCategory)
        etAmount.setText(transaction.amount.toInt().toString())
        actvCategory.setText(transaction.category.capitalizeWords())
        etDescription.setText(transaction.description ?: "")
        etDate.setText(transaction.transactionDate.take(10))

        val calendar = Calendar.getInstance()
        etDate.setOnClickListener {
            DatePickerDialog(requireContext(), { _, y, m, d ->
                etDate.setText(String.format("%04d-%02d-%02d", y, m + 1, d))
            }, calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH), calendar.get(Calendar.DAY_OF_MONTH)).show()
        }

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnAdd.setOnClickListener {
            val amount   = etAmount.text.toString().toDoubleOrNull()
            val category = actvCategory.text.toString().trim().lowercase()
            val desc     = etDescription.text.toString()
            val date     = etDate.text.toString()
            if (amount == null || amount <= 0) { tilAmount.error = getString(R.string.error_invalid_amount); return@setOnClickListener } else tilAmount.error = null
            if (category.isEmpty()) { tilCategory.error = getString(R.string.error_select_category); return@setOnClickListener } else tilCategory.error = null
            viewModel.updateTransaction(transactionId = transaction.id, amount = amount, category = category, description = desc.ifEmpty { null }, transactionType = "expense", transactionDate = date)
            invalidateDashboardCache()
            dialog.dismiss()
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ==================== DELETE DIALOG ====================

    private fun deleteTransaction(transaction: Transaction) = showDeleteTransactionDialog(transaction)

    private fun showDeleteTransactionDialog(transaction: Transaction) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_delete_confirm, null)
        val dialog = AlertDialog.Builder(requireContext()).setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val formatter = NumberFormat.getNumberInstance(Locale.US)
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogTitle).text    = getString(R.string.dialog_title_delete_transaction)
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogSubtitle).text = getString(R.string.dialog_subtitle_cannot_undo)
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogItemName).text = "${transaction.category.capitalizeWords()} – ₱${formatter.format(transaction.amount.toInt())}"
        dialogView.findViewById<android.widget.TextView>(R.id.tvDialogMessage).text  = getString(R.string.dialog_msg_delete_transaction)

        dialogView.findViewById<MaterialButton>(R.id.btnCancel).setOnClickListener { dialog.dismiss() }
        dialogView.findViewById<MaterialButton>(R.id.btnDelete).setOnClickListener {
            viewModel.deleteTransaction(transaction.id)
            invalidateDashboardCache()
            Toast.makeText(requireContext(), getString(R.string.transaction_deleted), Toast.LENGTH_SHORT).show()
            dialog.dismiss()
        }
        dialog.show()
    }

    // ==================== HELPERS ====================

    private fun getCategoryIconAndBackground(category: String): Pair<String, Any> {
        val userCat = categoryViewModel.categories.value?.firstOrNull { it.name.lowercase() == category.lowercase() }
        if (userCat != null) return Pair(userCat.icon, userCat.color)
        return when (category.lowercase()) {
            "food & dining", "food" -> Pair("🍔", "#FF5722"); "groceries" -> Pair("🛒", "#4CAF50")
            "transportation", "transport" -> Pair("🚗", "#2196F3"); "shopping" -> Pair("🛍️", "#9C27B0")
            "entertainment" -> Pair("🎮", "#3F51B5"); "health", "healthcare" -> Pair("💊", "#F44336")
            "bills & utilities", "bills" -> Pair("💡", "#FF9800"); "savings" -> Pair("🏦", "#4CAF50")
            "education" -> Pair("📚", "#2196F3"); else -> Pair("📦", "#607D8B")
        }
    }

    private fun showBudgetBlockedDialog(data: TransactionViewModel.BudgetWarningData) {
        if (!isAdded) return
        val fmt      = NumberFormat.getNumberInstance(Locale.US)
        val spentPct = if (data.budget > 0) (data.spent / data.budget * 100).toInt() else 0
        val dialogView = layoutInflater.inflate(R.layout.dialog_budget_blocked, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme).setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        val limitLabel = if (data.isHardBlock) getString(R.string.budget_label_hard_limit) else getString(R.string.budget_label_monthly)
        val limitValue = if (data.isHardBlock) data.blockLimit else data.budget
        dialogView.findViewById<android.widget.TextView>(R.id.tvBlockedLimitLabel).text = limitLabel
        dialogView.findViewById<android.widget.TextView>(R.id.tvBlockedBudget).text = "₱${fmt.format(limitValue.toInt())}"
        dialogView.findViewById<android.widget.TextView>(R.id.tvBlockedSpent).text  = "₱${fmt.format(data.spent.toInt())} ($spentPct%)"
        dialogView.findViewById<MaterialButton>(R.id.btnBlockedOk).setOnClickListener { dialog.dismiss() }
        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun showBudgetWarningDialog(data: TransactionViewModel.BudgetWarningData) {
        if (!isAdded) return
        val fmt         = NumberFormat.getNumberInstance(Locale.US)
        val spentPct    = if (data.budget > 0) (data.spent    / data.budget * 100).toInt() else 0
        val newTotalPct = if (data.budget > 0) (data.newTotal / data.budget * 100).toInt() else 0
        val dialogView = layoutInflater.inflate(R.layout.dialog_budget_warning, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme).setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        dialogView.findViewById<android.widget.TextView>(R.id.tvWarnBudget).text    = "₱${fmt.format(data.budget.toInt())}"
        dialogView.findViewById<android.widget.TextView>(R.id.tvWarnSpent).text     = "₱${fmt.format(data.spent.toInt())} ($spentPct%)"
        dialogView.findViewById<android.widget.TextView>(R.id.tvWarnThreshold).text = "₱${fmt.format(data.threshold.toInt())}"
        dialogView.findViewById<android.widget.TextView>(R.id.tvWarnNewAmount).text = "₱${fmt.format(data.newAmount.toInt())}"
        dialogView.findViewById<android.widget.TextView>(R.id.tvWarnNewTotal).text  = "₱${fmt.format(data.newTotal.toInt())} ($newTotalPct%)"
        dialogView.findViewById<MaterialButton>(R.id.btnWarnCancel).setOnClickListener  { viewModel.cancelPendingTransaction(); dialog.dismiss() }
        dialogView.findViewById<MaterialButton>(R.id.btnWarnProceed).setOnClickListener { viewModel.forceAddTransaction(); invalidateDashboardCache(); dialog.dismiss() }
        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    // ── Upcoming Recurring Preview ────────────────────────────────────────────

    private fun setupUpcomingRecurring() {
        upcomingAdapter = RecurringPreviewAdapter { rec -> showRecurringActionDialog(rec) }
        binding.rvUpcomingRecurring.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvUpcomingRecurring.adapter = upcomingAdapter
        binding.tvManageRecurring.setOnClickListener {
            findNavController().navigate(R.id.action_transactions_to_recurring)
        }
    }

    private fun loadUpcomingRecurring() {
        val prefs  = getPrefs()
        val token  = "Bearer ${prefs.getString("jwt_token", "") ?: ""}"
        val userId = prefs.getString("user_id", "") ?: ""
        if (userId.isEmpty()) return
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val response = ApiClient.authApi.getRecurring(token, userId)
                if (response.isSuccessful && response.body()?.success == true) {
                    val sdf          = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                    val today        = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.time
                    val sevenDaysOut = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 23); set(Calendar.MINUTE, 59); set(Calendar.SECOND, 59); add(Calendar.DAY_OF_YEAR, 7) }.time
                    val upcoming = response.body()!!.data
                        .filter { it.status == "active" }
                        .filter { try { val d = sdf.parse(it.nextRunDate.take(10)); d != null && !d.before(today) && !d.after(sevenDaysOut) } catch (_: Exception) { false } }
                        .sortedBy { it.nextRunDate }.take(5)
                    if (upcoming.isNotEmpty()) {
                        upcomingAdapter.submitList(upcoming)
                        binding.rvUpcomingRecurring.visibility = View.VISIBLE
                        binding.tvEmptyRecurring.visibility    = View.GONE
                    } else {
                        binding.rvUpcomingRecurring.visibility = View.GONE
                        binding.tvEmptyRecurring.visibility    = View.VISIBLE
                    }
                } else { binding.rvUpcomingRecurring.visibility = View.GONE; binding.tvEmptyRecurring.visibility = View.VISIBLE }
            } catch (_: Exception) { binding.rvUpcomingRecurring.visibility = View.GONE; binding.tvEmptyRecurring.visibility = View.VISIBLE }
        }
    }

    private fun invalidateDashboardCache() {
        getPrefs().edit()
            .remove("cached_remaining").remove("cached_total_spent")
            .remove("cached_total_income").remove("cached_adjusted_budget").apply()
    }

    override fun onDestroyView() {
        viewModel.cancelPendingTransaction()
        super.onDestroyView()
        _binding = null
    }

    private fun String.capitalizeWords(): String =
        split(" ").joinToString(" ") { w -> w.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() } }
}