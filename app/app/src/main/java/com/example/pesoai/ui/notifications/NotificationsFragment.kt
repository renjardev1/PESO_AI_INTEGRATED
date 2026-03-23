package com.example.pesoai.ui.notifications

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.pesoai.MainActivity
import com.example.pesoai.api.models.AppNotification
import com.example.pesoai.databinding.FragmentNotificationsBinding

class NotificationsFragment : Fragment() {

    private var _binding: FragmentNotificationsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: NotificationViewModel by activityViewModels()
    private lateinit var adapter: NotificationAdapter

    // ── Pagination ────────────────────────────────────────────────────────────
    private val PAGE_SIZE    = 10
    private var currentPage  = 0
    private var allNotifs: List<AppNotification> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentNotificationsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        observeViewModel()

        binding.toolbarNotifications.setNavigationOnClickListener {
            findNavController().navigateUp()
        }

        binding.btnMarkAllReadFull.setOnClickListener { viewModel.markAllRead() }

        binding.btnPrevPage.setOnClickListener {
            if (currentPage > 0) {
                currentPage--
                renderPage()
                scrollToTop()
            }
        }

        binding.btnNextPage.setOnClickListener {
            val totalPages = totalPages()
            if (currentPage < totalPages - 1) {
                currentPage++
                renderPage()
                scrollToTop()
            }
        }

        if (viewModel.notifications.value == null) {
            viewModel.loadNotifications()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    // ── RecyclerView ──────────────────────────────────────────────────────────

    private fun setupRecyclerView() {
        adapter = NotificationAdapter { notif ->
            if (!notif.isRead) viewModel.markRead(notif.id)
        }
        binding.rvNotificationsFull.layoutManager = LinearLayoutManager(requireContext())
        binding.rvNotificationsFull.adapter = adapter
    }

    // ── Pagination ────────────────────────────────────────────────────────────

    private fun totalPages() = maxOf(1, (allNotifs.size + PAGE_SIZE - 1) / PAGE_SIZE)

    private fun renderPage() {
        val total      = totalPages()
        val fromIndex  = currentPage * PAGE_SIZE
        val toIndex    = minOf(fromIndex + PAGE_SIZE, allNotifs.size)
        val pageItems  = if (fromIndex < allNotifs.size) allNotifs.subList(fromIndex, toIndex)
        else emptyList()

        adapter.submitList(pageItems)

        // Empty state
        binding.tvFullEmpty.visibility =
            if (allNotifs.isEmpty()) View.VISIBLE else View.GONE

        // Pagination bar
        if (allNotifs.size > PAGE_SIZE) {
            binding.layoutPagination.visibility  = View.VISIBLE
            binding.tvPageIndicator.text         = "Page ${currentPage + 1} of $total"
            binding.btnPrevPage.isEnabled        = currentPage > 0
            binding.btnNextPage.isEnabled        = currentPage < total - 1
        } else {
            binding.layoutPagination.visibility  = View.GONE
        }

        // Mark all read button
        binding.btnMarkAllReadFull.isEnabled = allNotifs.any { !it.isRead }
    }

    private fun scrollToTop() {
        binding.rvNotificationsFull.scrollToPosition(0)
    }

    // ── Observers ─────────────────────────────────────────────────────────────

    private fun observeViewModel() {
        viewModel.notifications.observe(viewLifecycleOwner) { list ->
            allNotifs   = list
            currentPage = 0   // reset to first page on fresh load
            renderPage()
        }

        viewModel.unreadCount.observe(viewLifecycleOwner) { count ->
            (activity as? MainActivity)?.updateNotificationBadge(count)
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            binding.progressFull.visibility = if (loading) View.VISIBLE else View.GONE
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
}