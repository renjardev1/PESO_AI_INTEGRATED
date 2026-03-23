package com.example.pesoai.data.repository

import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.MonthlySummaryResponse
import com.example.pesoai.api.models.Transaction
import com.example.pesoai.api.models.TransactionRequest

class TransactionRepository {

    // ── No date range: used after add / update / delete ───────────────────────
    suspend fun getTransactions(token: String, userId: String): List<Transaction> {
        val response = ApiClient.authApi.getTransactions(token, userId)
        if (response.isSuccessful) return response.body()?.transactions ?: emptyList()
        throw Exception("Failed to load transactions: ${response.errorBody()?.string()}")
    }

    // ── With period date range: used by TransactionFragment ──────────────────
    suspend fun getTransactions(
        token: String,
        userId: String,
        startDate: String,
        endDate: String
    ): List<Transaction> {
        val response = ApiClient.authApi.getTransactionsByRange(token, userId, startDate, endDate)
        if (response.isSuccessful) return response.body()?.transactions ?: emptyList()
        throw Exception("Failed to load transactions: ${response.errorBody()?.string()}")
    }

    suspend fun addTransaction(
        token: String,
        userId: String,
        amount: Double,
        category: String,         // ✅ always lowercase before calling
        description: String?,
        transactionType: String,  // ✅ "income" or "expense"
        transactionDate: String   // ✅ YYYY-MM-DD
    ): Transaction {
        val request = TransactionRequest(
            userId          = userId,
            amount          = amount,
            category        = category,
            description     = description,
            transactionType = transactionType,
            transactionDate = transactionDate
        )
        val response = ApiClient.authApi.addTransaction(token, request)
        if (response.isSuccessful) return response.body()!!.transaction
        throw Exception("Failed to add transaction: ${response.errorBody()?.string()}")
    }

    suspend fun updateTransaction(
        token: String,
        userId: String,
        transactionId: Int,
        amount: Double,
        category: String,
        description: String?,
        transactionType: String,
        transactionDate: String
    ) {
        val request = TransactionRequest(
            userId          = userId,
            amount          = amount,
            category        = category,
            description     = description,
            transactionType = transactionType,
            transactionDate = transactionDate
        )
        val response = ApiClient.authApi.updateTransaction(token, userId, transactionId, request)
        if (!response.isSuccessful)
            throw Exception("Failed to update transaction: ${response.errorBody()?.string()}")
    }

    suspend fun deleteTransaction(token: String, userId: String, transactionId: Int) {
        val response = ApiClient.authApi.deleteTransaction(token, userId, transactionId)
        if (!response.isSuccessful)
            throw Exception("Failed to delete transaction: ${response.errorBody()?.string()}")
    }

    suspend fun getMonthlySummary(token: String, userId: String): MonthlySummaryResponse {
        val response = ApiClient.authApi.getMonthlySummary(token, userId)
        if (response.isSuccessful) return response.body()!!
        throw Exception("Failed to load monthly summary: ${response.errorBody()?.string()}")
    }
}