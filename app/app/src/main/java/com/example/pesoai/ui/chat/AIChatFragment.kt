package com.example.pesoai.ui.chat

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.pesoai.R
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.ChatMessage
import com.example.pesoai.databinding.FragmentAiChatBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AIChatFragment : Fragment() {

    private var _binding: FragmentAiChatBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ChatViewModel by activityViewModels()
    private lateinit var chatAdapter: ChatAdapter

    // ── History panel ─────────────────────────────────────────────────────────
    private lateinit var historyAdapter: HistoryAdapter
    private val historyItems = mutableListOf<HistoryItem>()
    private var historyPanelVisible = false

    private fun getPrefs() =
        requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    // ✅ user_id is always String (UUID)
    private fun getUserId() = getPrefs().getString("user_id", "") ?: ""
    private fun getToken()  = "Bearer ${getPrefs().getString("jwt_token", "") ?: ""}"

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAiChatBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupChatRecyclerView()
        setupHistoryRecyclerView()
        setupObservers()
        setupClickListeners()
        updateEmptyState()
    }

    // ── Setup ─────────────────────────────────────────────────────────────────

    private fun setupChatRecyclerView() {
        chatAdapter = ChatAdapter(
            messages      = mutableListOf(),
            onRetryClick  = { pos -> viewModel.retryLastMessage(getUserId(), pos) },
            onCopyClick   = { text -> copyToClipboard(text) },
            onDeleteClick = { pos -> viewModel.removeMessagePairAt(pos) }
        )
        binding.rvChatMessages.apply {
            layoutManager = LinearLayoutManager(requireContext()).apply {
                stackFromEnd = true
            }
            adapter = chatAdapter
        }
    }

    private fun setupHistoryRecyclerView() {
        historyAdapter = HistoryAdapter(
            historyItems  = historyItems,
            onItemClick   = { historyId -> loadHistoryConversation(historyId) },
            onDeleteClick = { historyId, adapterPos ->
                deleteHistoryItem(historyId, adapterPos)
            }
        )
        binding.rvHistoryList.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter       = historyAdapter
        }
    }

    private fun setupObservers() {
        viewModel.messages.observe(viewLifecycleOwner) { messages ->
            chatAdapter.updateMessages(messages)
            if (messages.isNotEmpty()) {
                binding.rvChatMessages.smoothScrollToPosition(messages.size - 1)
            }
            updateEmptyState()
        }

        viewModel.isGenerating.observe(viewLifecycleOwner) { generating ->
            if (generating) {
                chatAdapter.showThinking()
                binding.btnSend.visibility = View.GONE
                binding.btnStop.visibility = View.VISIBLE
            } else {
                chatAdapter.hideThinking()
                binding.btnSend.visibility = View.VISIBLE
                binding.btnStop.visibility = View.GONE
            }
        }
    }

    private fun setupClickListeners() {
        // Send
        binding.btnSend.setOnClickListener {
            val text = binding.etMessage.text.toString().trim()
            if (text.isEmpty()) return@setOnClickListener
            binding.etMessage.text?.clear()
            hideHistoryPanel()
            viewModel.generateAIResponse(getUserId(), text)
        }

        // Stop generation
        binding.btnStop.setOnClickListener { viewModel.stopGeneration() }

        // New chat — prompt save before clearing
        binding.btnNewChat.setOnClickListener {
            val messages = viewModel.messages.value
            if (!messages.isNullOrEmpty()) showNewChatDialog() else viewModel.clearMessages()
        }

        // History panel toggle
        binding.btnHistory.setOnClickListener {
            if (historyPanelVisible) hideHistoryPanel()
            else showHistoryPanel()
        }

        // Mode chips
        binding.chipGeneralMode.setOnClickListener  { setMode("general") }
        binding.chipAdvancedMode.setOnClickListener { setMode("advanced") }

        // Quick prompts
        binding.chipPrompt1.setOnClickListener {
            sendQuickPrompt(getString(R.string.quick_prompt_spending))
        }
        binding.chipPrompt2.setOnClickListener {
            sendQuickPrompt(getString(R.string.quick_prompt_budget))
        }
        binding.chipPrompt3.setOnClickListener {
            sendQuickPrompt(getString(R.string.quick_prompt_savings))
        }
    }

    // ── Mode toggle ───────────────────────────────────────────────────────────

    private fun setMode(mode: String) {
        viewModel.currentMode = mode
        binding.chipGeneralMode.isChecked  = mode == "general"
        binding.chipAdvancedMode.isChecked = mode == "advanced"
    }

    // ── Empty state visibility ────────────────────────────────────────────────

    private fun updateEmptyState() {
        val isEmpty = viewModel.messages.value.isNullOrEmpty()
        binding.emptyChatState.visibility  = if (isEmpty) View.VISIBLE  else View.GONE
        binding.rvChatMessages.visibility  = if (isEmpty) View.GONE     else View.VISIBLE
    }

    // ── Quick prompts ─────────────────────────────────────────────────────────

    private fun sendQuickPrompt(prompt: String) {
        hideHistoryPanel()
        viewModel.generateAIResponse(getUserId(), prompt)
    }

    // ── Clipboard copy ────────────────────────────────────────────────────────

    private fun copyToClipboard(text: String) {
        val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("AI Response", text))
        Toast.makeText(requireContext(), getString(R.string.copied_to_clipboard), Toast.LENGTH_SHORT).show()
    }

    // ── New chat dialog ───────────────────────────────────────────────────────

    private fun showNewChatDialog() {
        AlertDialog.Builder(requireContext())
            .setTitle(getString(R.string.dialog_title_new_chat))
            .setMessage(getString(R.string.dialog_msg_new_chat))
            .setPositiveButton(getString(R.string.btn_save_and_new)) { _, _ ->
                viewModel.saveConversation(getUserId()) { success, msg ->
                    Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
                    viewModel.clearMessages()
                }
            }
            .setNeutralButton(getString(R.string.btn_discard)) { _, _ -> viewModel.clearMessages() }
            .setNegativeButton(getString(R.string.btn_cancel), null)
            .show()
    }

    // ── History panel ─────────────────────────────────────────────────────────

    private fun showHistoryPanel() {
        historyPanelVisible = true
        binding.historyPanel.visibility = View.VISIBLE
        loadConversationHistory()
    }

    private fun hideHistoryPanel() {
        historyPanelVisible = false
        binding.historyPanel.visibility = View.GONE
    }

    private fun loadConversationHistory() {
        val userId = getUserId()
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.authApi.getConversationHistory(getToken(), userId, 1, 20)
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        // FIX C1: .data?.conversations → .history
                        val histories = response.body()?.history ?: emptyList()
                        historyItems.clear()
                        histories.forEach { conv ->
                            // FIX C2: conv.messages is non-nullable — no ?: needed
                            val messages  = conv.messages
                            val firstUser = messages.firstOrNull { it.role == "user" }?.content ?: ""
                            val firstAI   = messages.firstOrNull { it.role == "assistant" }?.content ?: ""
                            historyItems.add(HistoryItem(
                                id               = conv.id,
                                // FIX C3: conv.createdAt is a computed property (non-nullable)
                                date             = conv.createdAt,
                                // FIX C4: conv.mode is non-nullable
                                mode             = conv.mode,
                                exchangeCount    = messages.size / 2,
                                firstUserMessage = firstUser,
                                firstAiResponse  = firstAI
                            ))
                        }
                        historyAdapter.notifyDataSetChanged()
                        binding.tvHistoryEmpty.visibility =
                            if (historyItems.isEmpty()) View.VISIBLE else View.GONE
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), getString(R.string.error_generic, e.message), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }


    private fun loadHistoryConversation(historyId: Int) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.authApi.getConversationById(getToken(), getUserId(), historyId)
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        // FIX C5: .data?.messages → .conversation?.messages
                        val messages = response.body()?.conversation?.messages ?: emptyList()
                        val chatMessages = messages.map { msg ->
                            ChatMessage(
                                // FIX C6: msg.content and msg.role — correct field names from HistoryMessage
                                message     = msg.content,
                                isUser      = msg.role == "user",
                                timestamp   = System.currentTimeMillis(),
                                // FIX C7: .data?.mode → .conversation?.mode
                                messageType = response.body()?.conversation?.mode ?: "general",
                                isFailed    = false
                            )
                        }
                        viewModel.setMessages(chatMessages)
                        // FIX C8: .data?.mode → .conversation?.mode
                        response.body()?.conversation?.mode?.let { viewModel.currentMode = it }
                        hideHistoryPanel()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), getString(R.string.error_generic, e.message), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun deleteHistoryItem(historyId: Int, adapterPosition: Int) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.authApi.deleteConversationHistory(getToken(), getUserId(), historyId)
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        historyAdapter.removeAt(adapterPosition)
                        binding.tvHistoryEmpty.visibility =
                            if (historyItems.isEmpty()) View.VISIBLE else View.GONE
                    } else {
                        Toast.makeText(requireContext(), getString(R.string.error_delete_history), Toast.LENGTH_SHORT).show()
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