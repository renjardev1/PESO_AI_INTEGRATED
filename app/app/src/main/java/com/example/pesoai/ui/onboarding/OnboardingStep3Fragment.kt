package com.example.pesoai.ui.onboarding

import android.app.AlertDialog
import android.content.Context
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.example.pesoai.R
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.OnboardingRequest
import com.example.pesoai.databinding.FragmentOnboardingStep3Binding
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.chip.Chip
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch

// Step 3 of 3 — Category Selection + Custom Categories (with emoji picker) + API Submit
// XML: fragment_onboarding_step3.xml
// Fields: tvProgress, gridCategories, chipGroupCustom, btnAddCategory, btnBack, btnFinish
class OnboardingStep3Fragment : Fragment() {

    private var _binding: FragmentOnboardingStep3Binding? = null
    private val binding get() = _binding!!
    private val viewModel: OnboardingSharedViewModel by activityViewModels()

    // 8 default category display names (mapped to lowercase for backend)
    private val defaultCategories = listOf(
        "Food & Dining", "Transportation",
        "Shopping",      "Entertainment",
        "Bills",         "Healthcare",
        "Education",     "Others"
    )

    // Emoji palette for custom category dialog
    private val suggestedEmojis = listOf(
        "🏋️", "🐾", "✈️", "🎵", "💼", "🎁", "🏠", "📱",
        "💊", "🧴", "🍷", "☕", "🎓", "⚽", "🧘", "🚿",
        "🌿", "🎨", "🛠️", "📦", "💰", "🎭", "🚗", "🌍"
    )

    private val selectedDefaultIndices = mutableSetOf<Int>()
    private val customCategoryList     = mutableListOf<Pair<String, String>>() // (name, emoji)

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOnboardingStep3Binding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.tvProgress.text     = getString(R.string.onboarding_step_3_of_3)
        binding.btnFinish.text      = getString(R.string.onboarding_finish_setup)
        binding.btnFinish.isEnabled = true

        setupDefaultCategoryListeners()
        restoreState()

        binding.btnAddCategory.setOnClickListener { showCustomCategoryDialog() }
        binding.btnBack.setOnClickListener        { findNavController().navigateUp() }
        binding.btnFinish.setOnClickListener      { completeOnboarding() }
    }

    // ── Default 8 category cards ───────────────────────────────────────────────

    private fun setupDefaultCategoryListeners() {
        for (i in defaultCategories.indices) {
            getDefaultCard(i)?.setOnClickListener { toggleDefaultCategory(i) }
        }
    }

    private fun toggleDefaultCategory(index: Int) {
        val card  = getDefaultCard(index) ?: return
        val dp    = resources.displayMetrics.density
        if (selectedDefaultIndices.contains(index)) {
            selectedDefaultIndices.remove(index)
            card.strokeWidth = 0
            card.setCardBackgroundColor(
                ContextCompat.getColor(requireContext(), R.color.background_gray)
            )
        } else {
            selectedDefaultIndices.add(index)
            card.strokeWidth = (2 * dp).toInt()
            card.setCardBackgroundColor(
                ContextCompat.getColor(requireContext(), R.color.primary_blue_light)
            )
        }
    }

    private fun getDefaultCard(index: Int): MaterialCardView? =
        binding.gridCategories.getChildAt(index) as? MaterialCardView

    // ── Custom Category Dialog (with emoji picker) ─────────────────────────────

    private fun showCustomCategoryDialog() {
        val ctx    = requireContext()
        val dp     = resources.displayMetrics.density.toInt()
        val layout = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24 * dp, 16 * dp, 24 * dp, 8 * dp)
        }

        // Emoji label
        val tvEmojiLabel = TextView(ctx).apply {
            text      = getString(R.string.onboarding_choose_icon)
            textSize  = 13f
            setTextColor(ContextCompat.getColor(ctx, R.color.text_primary))
            setPadding(0, 0, 0, 6 * dp)
        }

        var selectedEmoji = suggestedEmojis[0]

        val btnSelectedEmoji = MaterialButton(ctx).apply {
            text      = selectedEmoji
            textSize  = 28f
            setPadding(0, 0, 0, 0)
            minWidth  = 56 * dp
            minimumWidth = 56 * dp
            backgroundTintList = ColorStateList.valueOf(
                ContextCompat.getColor(ctx, R.color.primary_blue_light)
            )
            cornerRadius = 12 * dp
        }

        // Emoji grid
        val emojiGrid = GridLayout(ctx).apply {
            columnCount = 8
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 8 * dp; bottomMargin = 8 * dp }
        }

        suggestedEmojis.forEachIndexed { _, emoji ->
            val cell = TextView(ctx).apply {
                text     = emoji
                textSize = 24f
                gravity  = android.view.Gravity.CENTER
                val size = 40 * dp
                layoutParams = GridLayout.LayoutParams().apply {
                    width  = size; height = size
                    setMargins(2 * dp, 2 * dp, 2 * dp, 2 * dp)
                }
                setOnClickListener {
                    selectedEmoji         = emoji
                    btnSelectedEmoji.text = emoji
                }
            }
            emojiGrid.addView(cell)
        }

        // Category name input
        val tilName = TextInputLayout(ctx, null,
            com.google.android.material.R.attr.textInputOutlinedStyle).apply {
            hint = getString(R.string.onboarding_category_name_hint)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 12 * dp }
            setBoxCornerRadii(10f, 10f, 10f, 10f)
        }
        val etName = TextInputEditText(ctx).apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                    android.text.InputType.TYPE_TEXT_FLAG_CAP_WORDS
        }
        tilName.addView(etName)

        layout.addView(tvEmojiLabel)
        layout.addView(btnSelectedEmoji)
        layout.addView(emojiGrid)
        layout.addView(tilName)

        AlertDialog.Builder(ctx)
            .setTitle(getString(R.string.onboarding_add_custom_category))
            .setView(layout)
            .setPositiveButton(getString(R.string.onboarding_add)) { _, _ ->
                val name = etName.text.toString().trim()
                when {
                    name.isEmpty() ->
                        Toast.makeText(ctx, getString(R.string.onboarding_category_name_required), Toast.LENGTH_SHORT).show()
                    customCategoryList.any { it.first.equals(name, true) } ->
                        Toast.makeText(ctx, getString(R.string.onboarding_category_already_added, name), Toast.LENGTH_SHORT).show()
                    defaultCategories.any { it.equals(name, true) } ->
                        Toast.makeText(ctx, getString(R.string.onboarding_category_is_default, name), Toast.LENGTH_SHORT).show()
                    else -> {
                        customCategoryList.add(Pair(name, selectedEmoji))
                        addCustomChip(name, selectedEmoji)
                    }
                }
            }
            .setNegativeButton(getString(R.string.cancel), null)
            .show()

        etName.requestFocus()
    }

    private fun addCustomChip(name: String, emoji: String) {
        val chip = Chip(requireContext()).apply {
            text               = "$emoji  $name"
            isCloseIconVisible = true
            isClickable        = false
            chipBackgroundColor = ColorStateList.valueOf(
                ContextCompat.getColor(requireContext(), R.color.primary_blue_light)
            )
            setOnCloseIconClickListener {
                customCategoryList.removeAll { it.first == name }
                binding.chipGroupCustom.removeView(this)
            }
        }
        binding.chipGroupCustom.addView(chip)
    }

    // ── Restore state on back navigation ──────────────────────────────────────

    private fun restoreState() {
        if (viewModel.selectedCategories.isEmpty()) return
        val dp = resources.displayMetrics.density
        viewModel.selectedCategories.forEach { name ->
            val idx = defaultCategories.indexOf(name)
            if (idx >= 0) {
                selectedDefaultIndices.add(idx)
                getDefaultCard(idx)?.apply {
                    strokeWidth = (2 * dp).toInt()
                    setCardBackgroundColor(
                        ContextCompat.getColor(requireContext(), R.color.primary_blue_light)
                    )
                }
            } else {
                // Restore custom — emoji not preserved across back-nav, use placeholder
                if (customCategoryList.none { it.first == name }) {
                    customCategoryList.add(Pair(name, "📦"))
                    addCustomChip(name, "📦")
                }
            }
        }
    }

    // ── API Submit ─────────────────────────────────────────────────────────────

    private fun completeOnboarding() {
        val prefs  = requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        val userId = viewModel.getUserId()

        if (userId.isEmpty()) {
            Toast.makeText(
                requireContext(),
                getString(R.string.onboarding_session_expired),
                Toast.LENGTH_LONG
            ).show()
            requireActivity().finish()
            return
        }

        // Collect categories in selection order, then custom names
        val defaultSelected = selectedDefaultIndices.sorted().map { defaultCategories[it] }
        val customNames     = customCategoryList.map { (name, _) -> name }
        val allCategories   = defaultSelected + customNames
        viewModel.selectedCategories = allCategories.toMutableList()

        val request = OnboardingRequest(
            userId            = userId,
            age               = viewModel.age,
            gender            = viewModel.gender,
            occupation        = viewModel.occupation,
            monthlyIncome     = viewModel.monthlyIncome,
            financialGoals    = viewModel.financialGoals,
            riskTolerance     = viewModel.riskTolerance,
            savingsGoalAmount = viewModel.savingsGoal,
            categories        = allCategories
        )

        binding.btnFinish.isEnabled = false

        lifecycleScope.launch {
            try {
                val response = ApiClient.authApi.completeOnboarding(viewModel.getToken(), request)

                if (response.isSuccessful && response.body()?.success == true) {
                    prefs.edit()
                        .putFloat("monthly_income",        viewModel.monthlyIncome.toFloat())
                        .putFloat("monthly_savings_goal",  viewModel.savingsGoal.toFloat())
                        .putBoolean("onboarding_completed", true)
                        .apply()

                    Toast.makeText(
                        requireContext(),
                        getString(R.string.onboarding_complete_success),
                        Toast.LENGTH_SHORT
                    ).show()
                    (activity as? OnboardingActivity)?.navigateToMain()

                } else {
                    val raw      = response.errorBody()?.string() ?: ""
                    android.util.Log.e("ONBOARDING", "HTTP ${response.code()}: $raw")
                    val errorMsg = try {
                        org.json.JSONObject(raw).optString("message",
                            getString(R.string.onboarding_setup_failed, response.code()))
                    } catch (_: Exception) {
                        getString(R.string.onboarding_setup_failed, response.code())
                    }
                    Toast.makeText(requireContext(), errorMsg, Toast.LENGTH_LONG).show()
                    binding.btnFinish.isEnabled = true
                }

            } catch (e: Exception) {
                Toast.makeText(
                    requireContext(),
                    getString(R.string.error_generic, e.message),
                    Toast.LENGTH_LONG
                ).show()
                binding.btnFinish.isEnabled = true
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}