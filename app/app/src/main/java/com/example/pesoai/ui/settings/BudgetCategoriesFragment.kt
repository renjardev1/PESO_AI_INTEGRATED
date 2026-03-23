package com.example.pesoai.ui.settings

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.pesoai.R
import com.example.pesoai.api.models.Category
import com.example.pesoai.databinding.FragmentBudgetCategoriesBinding
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.textfield.TextInputEditText

class BudgetCategoriesFragment : Fragment() {

    private var _binding: FragmentBudgetCategoriesBinding? = null
    private val binding get() = _binding!!

    private val viewModel: CategoryViewModel by activityViewModels()
    private lateinit var adapter: CategoryAdapter

    private val ICONS = listOf(
        "🍔", "🚗", "🛍️", "💡", "❤️", "🎬", "💰", "📦",
        "🏠", "🐾", "✈️", "📚", "🎮", "🏋️", "💼", "🎁",
        "☕", "🌿", "🔧", "🎵"
    )

    private val COLOR_NAMES = listOf(
        "Deep Orange", "Blue", "Purple", "Orange", "Red",
        "Indigo", "Green", "Gray", "Teal", "Pink",
        "Brown", "Cyan", "Light Green", "Amber", "Deep Purple"
    )
    private val COLOR_VALUES = listOf(
        "#FF5722", "#2196F3", "#9C27B0", "#FF9800", "#F44336",
        "#3F51B5", "#4CAF50", "#607D8B", "#009688", "#E91E63",
        "#795548", "#00BCD4", "#8BC34A", "#FFC107", "#673AB7"
    )

    private var selectedIcon  = "📦"
    private var selectedColor = "#607D8B"

    // ── Lifecycle ────────────────────────────────────────────────────────────

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentBudgetCategoriesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        observeViewModel()
        binding.btnAddCategory.setOnClickListener { showAddDialog() }
        binding.toolbarCategories.setNavigationOnClickListener {
            findNavController().popBackStack()
        }
        viewModel.loadCategories()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    // ── Setup ────────────────────────────────────────────────────────────────

    private fun setupRecyclerView() {
        adapter = CategoryAdapter(
            onEdit   = { cat -> showEditDialog(cat) },
            onDelete = { cat -> confirmDelete(cat) }
        )
        binding.rvCategories.layoutManager = LinearLayoutManager(requireContext())
        binding.rvCategories.adapter = adapter
    }

    private fun observeViewModel() {
        viewModel.categories.observe(viewLifecycleOwner) { list ->
            adapter.submitList(list)
            binding.tvEmptyCategories.visibility =
                if (list.isEmpty()) View.VISIBLE else View.GONE
        }
        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            binding.progressCategories.visibility = if (loading) View.VISIBLE else View.GONE
        }
        viewModel.errorMessage.observe(viewLifecycleOwner) { msg ->
            if (!msg.isNullOrBlank()) {
                Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
                viewModel.clearMessages()
            }
        }
        viewModel.successMessage.observe(viewLifecycleOwner) { msg ->
            if (!msg.isNullOrBlank()) {
                Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
                viewModel.clearMessages()
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun colorNameFromValue(hex: String): String {
        val idx = COLOR_VALUES.indexOf(hex)
        return if (idx >= 0) COLOR_NAMES[idx] else "Gray"
    }

    private fun applyColorToView(view: View, hex: String) {
        try {
            view.setBackgroundColor(android.graphics.Color.parseColor(hex))
        } catch (_: IllegalArgumentException) {}
    }

    // ── Dialogs ──────────────────────────────────────────────────────────────

    private fun showAddDialog() {
        selectedIcon  = "📦"
        selectedColor = "#607D8B"
        showCategoryDialog(
            title        = getString(R.string.dialog_title_add_category),
            prefillName  = "",
            prefillIcon  = selectedIcon,
            prefillColor = selectedColor,
            isDefault    = false
        ) { name, icon, color ->
            viewModel.addCategory(name, icon, color)
        }
    }

    private fun showEditDialog(cat: Category) {
        selectedIcon  = cat.icon
        selectedColor = cat.color
        showCategoryDialog(
            title        = getString(R.string.dialog_title_edit_category),
            prefillName  = cat.name,
            prefillIcon  = cat.icon,
            prefillColor = cat.color,
            isDefault    = cat.isDefault
        ) { name, icon, color ->
            viewModel.updateCategory(cat.id, name, icon, color)
        }
    }

    private fun showCategoryDialog(
        title: String,
        prefillName: String,
        prefillIcon: String,
        prefillColor: String,
        isDefault: Boolean,
        onConfirm: (String, String, String) -> Unit
    ) {
        val dialogView = LayoutInflater.from(requireContext())
            .inflate(R.layout.dialog_category, null)

        val etName         = dialogView.findViewById<TextInputEditText>(R.id.etCategoryName)
        val tvIconPreview  = dialogView.findViewById<android.widget.TextView>(R.id.tvIconPreview)
        val viewColorPreview = dialogView.findViewById<View>(R.id.viewColorPreview)
        val btnPickIcon    = dialogView.findViewById<MaterialButton>(R.id.btnPickIcon)
        val btnPickColor   = dialogView.findViewById<MaterialButton>(R.id.btnPickColor)

        // Pre-fill
        etName.setText(prefillName)
        etName.isEnabled    = !isDefault
        tvIconPreview.text  = prefillIcon
        selectedIcon        = prefillIcon
        selectedColor       = prefillColor

        // Show color name on button, apply color to preview circle
        btnPickColor.text   = colorNameFromValue(prefillColor)
        applyColorToView(viewColorPreview, prefillColor)

        // Icon picker
        btnPickIcon.setOnClickListener {
            showPickerDialog(getString(R.string.dialog_title_pick_icon), ICONS) { picked ->
                selectedIcon       = picked
                tvIconPreview.text = picked
            }
        }

        // Color picker — shows names, stores hex value
        btnPickColor.setOnClickListener {
            showPickerDialog(getString(R.string.dialog_title_pick_color), COLOR_NAMES) { pickedName ->
                val idx       = COLOR_NAMES.indexOf(pickedName)
                selectedColor = if (idx >= 0) COLOR_VALUES[idx] else "#607D8B"
                btnPickColor.text = pickedName
                applyColorToView(viewColorPreview, selectedColor)
            }
        }

        MaterialAlertDialogBuilder(requireContext())
            .setTitle(title)
            .setView(dialogView)
            .setPositiveButton(getString(R.string.btn_save)) { _, _ ->
                val name = etName.text.toString().trim()
                    .ifBlank { if (isDefault) prefillName else "" }
                if (name.isNotBlank()) {
                    onConfirm(name, selectedIcon, selectedColor)
                } else {
                    Toast.makeText(
                        requireContext(),
                        getString(R.string.error_category_name_empty),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
            .setNegativeButton(getString(R.string.btn_cancel), null)
            .show()
    }

    private fun showPickerDialog(title: String, items: List<String>, onPick: (String) -> Unit) {
        val arr = items.toTypedArray()
        AlertDialog.Builder(requireContext())
            .setTitle(title)
            .setItems(arr) { _, idx -> onPick(arr[idx]) }
            .show()
    }

    private fun confirmDelete(cat: Category) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle(getString(R.string.dialog_title_delete_category))
            .setMessage(getString(R.string.dialog_msg_delete_category, cat.name))
            .setPositiveButton(getString(R.string.btn_delete)) { _, _ ->
                viewModel.deleteCategory(cat.id, cat.name)
            }
            .setNegativeButton(getString(R.string.btn_cancel), null)
            .show()
    }
}