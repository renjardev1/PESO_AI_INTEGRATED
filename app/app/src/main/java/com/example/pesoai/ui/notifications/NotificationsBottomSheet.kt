package com.example.pesoai.ui.notifications

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.navigation.Navigation
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.pesoai.MainActivity
import com.example.pesoai.R
import com.example.pesoai.databinding.BottomSheetNotificationsBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class NotificationsBottomSheet : BottomSheetDialogFragment() {

    private var _binding: BottomSheetNotificationsBinding? = null
    private val binding get() = _binding!!

    // Shared with NotificationsFragment so state is preserved
    private val viewModel: NotificationViewModel by activityViewModels()
    private lateinit var adapter: NotificationAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = BottomSheetNotificationsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        observeViewModel()
        fixDismissGesture()

        binding.btnMarkAllRead.setOnClickListener { viewModel.markAllRead() }

        binding.btnSeeAll.setOnClickListener {
            dismiss()
            // BottomSheetDialogFragment has no parent fragment — must resolve
            // NavController via the Activity's nav host fragment directly.
            Navigation.findNavController(requireActivity(), R.id.nav_host_fragment)
                .navigate(R.id.action_global_to_notifications)
        }

        viewModel.loadNotifications()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun setupRecyclerView() {
        adapter = NotificationAdapter { notif ->
            if (!notif.isRead) viewModel.markRead(notif.id)
        }
        binding.rvNotificationsSheet.layoutManager = LinearLayoutManager(requireContext())
        binding.rvNotificationsSheet.adapter = adapter
    }

    private fun fixDismissGesture() {
        val behavior = (dialog as? com.google.android.material.bottomsheet.BottomSheetDialog)
            ?.behavior ?: return

        binding.rvNotificationsSheet.addOnScrollListener(
            object : androidx.recyclerview.widget.RecyclerView.OnScrollListener() {
                override fun onScrolled(
                    recyclerView: androidx.recyclerview.widget.RecyclerView,
                    dx: Int, dy: Int
                ) {
                    // Allow BottomSheet to drag only when list cannot scroll further up
                    behavior.isDraggable = !recyclerView.canScrollVertically(-1)
                }
            }
        )
        // Start draggable since list begins at top
        behavior.isDraggable = true
    }

    private fun observeViewModel() {
        viewModel.notifications.observe(viewLifecycleOwner) { list ->
            // Bottom sheet shows only last 10
            adapter.submitList(list.take(10))
            binding.tvSheetEmpty.visibility =
                if (list.isEmpty()) View.VISIBLE else View.GONE
            binding.btnMarkAllRead.isEnabled = list.any { !it.isRead }
        }

        viewModel.unreadCount.observe(viewLifecycleOwner) { count ->
            (activity as? MainActivity)?.updateNotificationBadge(count)
            binding.tvSheetUnreadCount.text =
                if (count > 0) getString(R.string.label_unread_count, count)
                else getString(R.string.label_no_unread)
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            binding.progressSheet.visibility = if (loading) View.VISIBLE else View.GONE
        }

        viewModel.successMessage.observe(viewLifecycleOwner) { msg ->
            if (!msg.isNullOrBlank()) {
                Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
                viewModel.clearMessages()
            }
        }

        viewModel.errorMessage.observe(viewLifecycleOwner) { msg ->
            if (!msg.isNullOrBlank()) {
                Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
                viewModel.clearMessages()
            }
        }
    }

    companion object {
        const val TAG = "NotificationsBottomSheet"
    }
}