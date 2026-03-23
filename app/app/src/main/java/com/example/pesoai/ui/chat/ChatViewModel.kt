package com.example.pesoai.ui.chat

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.AIChatRequest
import com.example.pesoai.api.models.ChatMessage
import com.example.pesoai.api.models.HistoryMessage
import com.example.pesoai.api.models.SaveHistoryRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.net.SocketTimeoutException

class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private val _messages = MutableLiveData<MutableList<ChatMessage>>(mutableListOf())
    val messages: LiveData<MutableList<ChatMessage>> = _messages

    private val _isGenerating = MutableLiveData(false)
    val isGenerating: LiveData<Boolean> = _isGenerating

    var currentMode = "general"
    private var aiJob: Job? = null

    // ── Internal helpers ──────────────────────────────────────────────────────

    private fun getPrefs() = getApplication<Application>()
        .getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)

    // ✅ user_id is always String (UUID)
    private fun getUserId() = getPrefs().getString("user_id", "") ?: ""
    private fun getToken()  = "Bearer ${getPrefs().getString("jwt_token", "") ?: ""}"

    // ── Message management ────────────────────────────────────────────────────

    fun addMessage(message: ChatMessage) {
        val list = _messages.value ?: mutableListOf()
        list.add(message)
        _messages.value = list
    }

    fun removeMessageAt(index: Int) {
        val list = _messages.value ?: return
        if (index in 0 until list.size) { list.removeAt(index); _messages.value = list }
    }

    // ✅ Remove user message + its AI response atomically — observer fires ONCE
    fun removeMessagePairAt(userPosition: Int) {
        val list = _messages.value ?: return
        if (userPosition !in 0 until list.size) return
        val hasAIResponse = userPosition + 1 < list.size && !list[userPosition + 1].isUser
        if (hasAIResponse) list.removeAt(userPosition + 1)
        if (userPosition < list.size) list.removeAt(userPosition)
        _messages.value = list
    }

    fun updateMessageAt(index: Int, message: ChatMessage) {
        val list = _messages.value ?: return
        if (index in 0 until list.size) { list[index] = message; _messages.value = list }
    }

    fun clearMessages() { _messages.value = mutableListOf() }

    fun setMessages(newMessages: List<ChatMessage>) {
        _messages.value = newMessages.toMutableList()
    }

    // ── AI generation ─────────────────────────────────────────────────────────

    fun generateAIResponse(userId: String, userMessage: String, isRetry: Boolean = false) {
        aiJob?.cancel()

        if (!isRetry) {
            addMessage(ChatMessage(
                message     = userMessage,
                isUser      = true,
                timestamp   = System.currentTimeMillis(),
                messageType = currentMode,
                isFailed    = false
            ))
        }

        _isGenerating.value = true

        aiJob = viewModelScope.launch(Dispatchers.IO) {
            try {
                // ✅ timeout 90s for advanced mode, 50s for general
                val timeoutMs = if (currentMode == "advanced") 90_000L else 50_000L
                val response  = withTimeout(timeoutMs) {
                    ApiClient.authApi.chatWithAI(
                        getToken(), userId,
                        AIChatRequest(userMessage, currentMode)
                    )
                }
                withContext(Dispatchers.Main) {
                    _isGenerating.value = false
                    if (response.isSuccessful && response.body()?.success == true) {
                        addMessage(ChatMessage(
                            message     = response.body()?.response ?: "No response",
                            isUser      = false,
                            timestamp   = System.currentTimeMillis(),
                            messageType = currentMode,
                            isFailed    = false
                        ))
                    } else {
                        addErrorMessage("AI returned an error (${response.code()})")
                    }
                }
            } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
                withContext(Dispatchers.Main) {
                    _isGenerating.value = false
                    addErrorMessage(
                        if (currentMode == "advanced")
                            "Response too long. Try a simpler question."
                        else
                            "Request timed out. Please try again."
                    )
                }
            } catch (e: SocketTimeoutException) {
                withContext(Dispatchers.Main) {
                    _isGenerating.value = false
                    addErrorMessage("Connection timeout. Check server.")
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                withContext(Dispatchers.Main) {
                    _isGenerating.value = false
                    addErrorMessage("Response cancelled")
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    _isGenerating.value = false
                    addErrorMessage(e.message ?: "Unknown error")
                }
            }
        }
    }

    private fun addErrorMessage(msg: String) {
        addMessage(ChatMessage(
            message     = "Error: $msg",
            isUser      = false,
            timestamp   = System.currentTimeMillis(),
            messageType = currentMode,
            isFailed    = true
        ))
    }

    // ── Retry ─────────────────────────────────────────────────────────────────

    fun retryLastMessage(userId: String, clickedPosition: Int) {
        val msgs = _messages.value ?: return
        if (clickedPosition !in 0 until msgs.size) return
        val clicked = msgs[clickedPosition]

        if (clicked.isUser) {
            // Clicked a user bubble — remove next AI response and regenerate
            if (clickedPosition + 1 < msgs.size && !msgs[clickedPosition + 1].isUser) {
                msgs.removeAt(clickedPosition + 1)
                _messages.value = msgs
            }
            generateAIResponse(userId, clicked.message, isRetry = true)
        } else {
            // Clicked an AI bubble — find preceding user message and regenerate
            val userMessage = msgs.subList(0, clickedPosition).findLast { it.isUser }
            if (userMessage != null) {
                msgs.removeAt(clickedPosition)
                _messages.value = msgs
                generateAIResponse(userId, userMessage.message, isRetry = true)
            }
        }
    }

    // ── Save conversation ─────────────────────────────────────────────────────
    // ✅ Maps ChatMessage → HistoryMessage({ role, content })
    //    Backend validator requires { role: "user"|"assistant", content: "..." }

    fun saveConversation(userId: String, onComplete: (Boolean, String) -> Unit) {
        val currentMessages = _messages.value
        if (currentMessages.isNullOrEmpty()) { onComplete(false, "No messages to save"); return }

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val historyMessages = currentMessages
                    .filter { !it.isFailed }
                    .map { HistoryMessage(
                        role    = if (it.isUser) "user" else "assistant",
                        content = it.message
                    )}

                val response = ApiClient.authApi.saveConversationHistory(
                    getToken(), userId,
                    SaveHistoryRequest(historyMessages, currentMode)
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true)
                        onComplete(true, "Conversation saved")
                    else
                        onComplete(false, "Failed to save: HTTP ${response.code()}")
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { onComplete(false, "Error: ${e.message}") }
            }
        }
    }

    fun stopGeneration() {
        aiJob?.cancel()
        _isGenerating.value = false
    }
}