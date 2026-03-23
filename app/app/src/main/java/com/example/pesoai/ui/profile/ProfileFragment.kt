package com.example.pesoai.ui.profile

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.example.pesoai.R
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.UpdateProfileRequest
import com.example.pesoai.api.models.UploadProfilePictureRequest
import com.example.pesoai.databinding.FragmentProfileBinding
import com.example.pesoai.utils.AppLockManager
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Locale

class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!
    private val viewModel: UserProfileViewModel by viewModels()
    private var currentProfilePictureBase64: String? = null

    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        AppLockManager.suppressForNextResume(requireContext())
        uri?.let { processAndUpload(it) }
    }

    private fun processAndUpload(uri: Uri) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val stream   = requireContext().contentResolver.openInputStream(uri)
                val original = BitmapFactory.decodeStream(stream)
                stream?.close()

                val size   = minOf(original.width, original.height)
                val x      = (original.width  - size) / 2
                val y      = (original.height - size) / 2
                val square = Bitmap.createBitmap(original, x, y, size, size)
                val scaled = Bitmap.createScaledBitmap(square, 256, 256, true)

                val baos   = java.io.ByteArrayOutputStream()
                scaled.compress(Bitmap.CompressFormat.JPEG, 75, baos)
                val base64 = "data:image/jpeg;base64,${Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)}"

                val userId = getUserId()
                val resp   = ApiClient.authApi.uploadProfilePicture(
                    getToken(), userId, UploadProfilePictureRequest(profilePicture = base64)
                )

                withContext(Dispatchers.Main) {
                    if (resp.isSuccessful && resp.body()?.success == true) {
                        currentProfilePictureBase64 = base64
                        binding.ivProfileImage.setImageBitmap(scaled)
                        Toast.makeText(requireContext(), getString(R.string.profile_picture_updated), Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(requireContext(), getString(R.string.error_upload_picture), Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), getString(R.string.error_generic, e.message), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        prefillFromCache()
        loadProfileData()
        setupClickListeners()
    }

    override fun onResume() {
        super.onResume()
        if (_binding != null) loadProfileData()
    }

    private fun getPrefs() =
        requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    private fun getUserId() = getPrefs().getString("user_id", "") ?: ""
    private fun getToken()  = "Bearer ${getPrefs().getString("jwt_token", "") ?: ""}"

    // ── Pre-fill from SharedPrefs cache so UI shows instantly ─────────────────
    private fun prefillFromCache() {
        val prefs     = getPrefs()
        val firstName = prefs.getString("first_name", "") ?: ""
        val lastName  = prefs.getString("last_name",  "") ?: ""
        val email     = prefs.getString("email",      "") ?: ""
        val username  = prefs.getString("username",   "") ?: ""
        val phone     = prefs.getString("phone",      "") ?: ""
        val location  = prefs.getString("location",   "") ?: ""

        val fullName = "$firstName $lastName".trim()
        if (fullName.isNotEmpty()) binding.tvUserName.text = fullName
        if (username.isNotEmpty()) binding.tvUsername.text = "@$username"
        if (email.isNotEmpty())    binding.tvEmail.text    = email
        binding.tvPhone.text    = phone.ifEmpty    { getString(R.string.not_set) }
        binding.tvLocation.text = location.ifEmpty { getString(R.string.not_set) }

        val daysActive = prefs.getInt("days_active", -1)
        val goalsCount = prefs.getInt("goals_count", -1)
        val totalSaved = prefs.getFloat("total_saved", -1f)
        val memberSince = prefs.getString("member_since", null)

        if (daysActive >= 0)  binding.tvPastPlans.text  = daysActive.toString()
        if (goalsCount >= 0)  binding.tvGoalsCount.text = goalsCount.toString()
        if (totalSaved >= 0f) binding.tvPoints.text     = "₱${(totalSaved / 1000).toInt()}k"
        if (!memberSince.isNullOrEmpty()) binding.tvMemberSince.text = memberSince

        // Restore cached profile picture
        val cachedPic = prefs.getString("profile_picture", null)
        if (!cachedPic.isNullOrEmpty()) {
            currentProfilePictureBase64 = cachedPic
            loadProfilePicture(cachedPic)
        }
    }

    private fun loadProfileData() {
        val userId = getUserId()
        if (userId.isEmpty()) {
            Toast.makeText(requireContext(), getString(R.string.error_user_not_found), Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.authApi.getUserProfile(getToken(), userId)
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        val profile = response.body()?.profile ?: return@withContext
                        bindProfile(profile)
                    } else {
                        Toast.makeText(requireContext(), getString(R.string.error_load_profile), Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), getString(R.string.error_generic, e.message), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun bindProfile(profile: com.example.pesoai.api.models.ProfileDetails) {
        // ── Identity ──────────────────────────────────────────────────────────
        binding.tvUserName.text = profile.name.ifBlank {
            "${profile.firstName} ${profile.lastName}".trim()
        }
        binding.tvUsername.text = "@${profile.username}"
        binding.tvEmail.text    = profile.email

        // ── Contact — never leave blank, always fall back to "Not set" ────────
        binding.tvPhone.text    = profile.phone?.takeIf { it.isNotBlank() }
            ?: getString(R.string.not_set)
        binding.tvLocation.text = profile.location?.takeIf { it.isNotBlank() }
            ?: getString(R.string.not_set)

        // ── Stats ─────────────────────────────────────────────────────────────
        binding.tvPastPlans.text  = profile.daysActive.toString()
        binding.tvGoalsCount.text = profile.goalsCount.toString()
        binding.tvPoints.text     = "₱${(profile.totalSaved / 1000).toInt()}k"

        // ── Member since — robust multi-format parser ─────────────────────────
        binding.tvMemberSince.text = parseMemberSince(profile.createdAt)
            ?: getString(R.string.member_since_default)

        // ── Profile picture ───────────────────────────────────────────────────
        val pic = profile.profilePicture
        if (!pic.isNullOrBlank()) {
            currentProfilePictureBase64 = pic
            loadProfilePicture(pic)
        }

        // ── Update SharedPrefs cache ──────────────────────────────────────────
        val memberSinceFormatted = parseMemberSince(profile.createdAt) ?: ""
        getPrefs().edit().apply {
            putString("first_name",       profile.firstName)
            putString("last_name",        profile.lastName)
            putString("email",            profile.email)
            putString("username",         profile.username)
            putString("phone",            profile.phone     ?: "")
            putString("location",         profile.location  ?: "")
            putString("member_since",     memberSinceFormatted)
            putString("profile_picture",  profile.profilePicture ?: "")
            putFloat("monthly_expenses",  profile.monthlyExpenses.toFloat())
            putFloat("monthly_income",    profile.monthlyIncome.toFloat())
            putFloat("user_monthly_budget", profile.monthlyIncome.toFloat())
            putInt("days_active",         profile.daysActive)
            putInt("goals_count",         profile.goalsCount)
            putFloat("total_saved",       profile.totalSaved.toFloat())
            apply()
        }
    }

    /**
     * Parses every Postgres timestamp format robustly:
     *   "2026-03-08 18:47:43.305942"   ← most common (space + microseconds)
     *   "2026-03-08 18:47:43"
     *   "2026-03-08T18:47:43.305942"
     *   "2026-03-08T18:47:43"
     *   "2026-03-08"
     *
     * Returns null if all formats fail so the caller can show a fallback string.
     */
    private fun parseMemberSince(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val displayFmt = SimpleDateFormat("MMMM yyyy", Locale.getDefault())

        // Normalise: replace space separator → T, truncate sub-seconds to 3 digits
        val normalised = raw.trim()
            .replace(' ', 'T')
            .replace(Regex("(T\\d{2}:\\d{2}:\\d{2})\\.\\d+")) { it.groupValues[1] }

        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm",
            "yyyy-MM-dd",
        )
        for (fmt in formats) {
            try {
                val date = SimpleDateFormat(fmt, Locale.US).parse(normalised)
                if (date != null) return displayFmt.format(date)
            } catch (_: Exception) { /* try next */ }
        }

        // Last resort: extract year + month directly from the string
        return try {
            val parts  = raw.trim().split("-")
            val year   = parts[0]
            val month  = parts[1].toInt()
            val months = listOf(
                "January","February","March","April","May","June",
                "July","August","September","October","November","December"
            )
            "${months.getOrElse(month - 1) { "Unknown" }} $year"
        } catch (_: Exception) { null }
    }

    private fun loadProfilePicture(base64: String) {
        try {
            val imageString  = if (base64.contains(",")) base64.split(",")[1] else base64
            val decodedBytes = Base64.decode(imageString, Base64.DEFAULT)
            val bmp = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
            if (bmp != null) binding.ivProfileImage.setImageBitmap(bmp)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupClickListeners() {
        binding.btnEditProfile.setOnClickListener { showEditProfileDialog() }
        binding.fabEditPicture.setOnClickListener {
            AppLockManager.suppressForNextResume(requireContext())
            pickImageLauncher.launch("image/*")
        }
    }

    private fun showEditProfileDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_edit_profile, null)
        val dialog = AlertDialog.Builder(requireContext(), R.style.CustomDialogTheme)
            .setView(dialogView).create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tilFirstName = dialogView.findViewById<TextInputLayout>(R.id.tilFirstName)
        val etFirstName  = dialogView.findViewById<TextInputEditText>(R.id.etFirstName)
        val tilLastName  = dialogView.findViewById<TextInputLayout>(R.id.tilLastName)
        val etLastName   = dialogView.findViewById<TextInputEditText>(R.id.etLastName)
        val tilEmail     = dialogView.findViewById<TextInputLayout>(R.id.tilEmail)
        val etEmail      = dialogView.findViewById<TextInputEditText>(R.id.etEmail)
        val tilUsername  = dialogView.findViewById<TextInputLayout>(R.id.tilUsername)
        val etUsername   = dialogView.findViewById<TextInputEditText>(R.id.etUsername)
        val etPhone      = dialogView.findViewById<TextInputEditText>(R.id.etPhone)
        val etLocation   = dialogView.findViewById<TextInputEditText>(R.id.etLocation)
        val btnCancel    = dialogView.findViewById<MaterialButton>(R.id.btnCancel)
        val btnSave      = dialogView.findViewById<MaterialButton>(R.id.btnSave)

        // Pre-fill from current binding values
        val nameParts = binding.tvUserName.text.toString().split(" ", limit = 2)
        etFirstName.setText(nameParts.getOrNull(0) ?: "")
        etLastName.setText(nameParts.getOrNull(1) ?: "")
        etEmail.setText(binding.tvEmail.text)
        etUsername.setText(binding.tvUsername.text.toString().removePrefix("@"))
        val notSet = getString(R.string.not_set)
        etPhone.setText(if (binding.tvPhone.text == notSet) "" else binding.tvPhone.text)
        etLocation.setText(if (binding.tvLocation.text == notSet) "" else binding.tvLocation.text)

        btnCancel.setOnClickListener { dialog.dismiss() }
        btnSave.setOnClickListener {
            val firstName = etFirstName.text.toString().trim()
            val lastName  = etLastName.text.toString().trim()
            val email     = etEmail.text.toString().trim()
            val username  = etUsername.text.toString().trim()
            val phone     = etPhone.text.toString().trim()
            val location  = etLocation.text.toString().trim()

            var hasError = false
            if (firstName.isEmpty()) {
                tilFirstName.error = getString(R.string.error_first_name_required); hasError = true
            } else tilFirstName.error = null
            if (email.isEmpty()) {
                tilEmail.error = getString(R.string.error_email_required); hasError = true
            } else if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                tilEmail.error = getString(R.string.error_invalid_email); hasError = true
            } else tilEmail.error = null
            if (username.isEmpty()) {
                tilUsername.error = getString(R.string.error_username_required); hasError = true
            } else if (username.length < 3) {
                tilUsername.error = getString(R.string.error_username_min_length); hasError = true
            } else tilUsername.error = null

            if (!hasError) {
                updateProfile(firstName, lastName, email, username, phone, location)
                dialog.dismiss()
            }
        }

        dialog.show()
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun updateProfile(
        firstName: String, lastName: String, email: String,
        username: String, phone: String, location: String
    ) {
        val userId = getUserId()
        if (userId.isEmpty()) {
            Toast.makeText(requireContext(), getString(R.string.error_user_not_found), Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.authApi.updateProfile(
                    getToken(), userId,
                    UpdateProfileRequest(
                        firstName = firstName,
                        lastName  = lastName,
                        email     = email,
                        username  = username,
                        phone     = phone.ifEmpty { null },
                        location  = location.ifEmpty { null }
                    )
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        binding.tvUserName.text = "$firstName $lastName".trim()
                        binding.tvUsername.text = "@$username"
                        binding.tvEmail.text    = email
                        val notSetLabel         = getString(R.string.not_set)
                        binding.tvPhone.text    = phone.ifEmpty { notSetLabel }
                        binding.tvLocation.text = location.ifEmpty { notSetLabel }
                        getPrefs().edit().apply {
                            putString("first_name", firstName)
                            putString("last_name",  lastName)
                            putString("email",      email)
                            putString("username",   username)
                            putString("phone",      phone)
                            putString("location",   location)
                            apply()
                        }
                        Toast.makeText(requireContext(), getString(R.string.profile_updated), Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(
                            requireContext(),
                            response.body()?.message ?: getString(R.string.error_update_profile),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), getString(R.string.error_generic, e.message), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}