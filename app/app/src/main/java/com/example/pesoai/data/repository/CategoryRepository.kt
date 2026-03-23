package com.example.pesoai.data.repository

import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.*
import retrofit2.Response

class CategoryRepository {

    // ✅ FIX: Correct API property
    private val api = ApiClient.authApi

    // ✅ FIX: Added token parameter to all methods
    suspend fun getCategories(
        token: String,
        userId: String
    ): Response<CategoryListResponse> =
        api.getCategories(token, userId)

    suspend fun addCategory(
        token: String,
        userId: String,
        name: String,
        icon: String,
        color: String
    ): Response<CategoryResponse> =
        api.addCategory(token, userId, AddCategoryRequest(name = name, icon = icon, color = color))

    suspend fun updateCategory(
        token: String,
        userId: String,
        categoryId: Int,
        name: String,
        icon: String,
        color: String
    ): Response<CategoryResponse> =
        api.updateCategory(token, userId, categoryId, UpdateCategoryRequest(name = name, icon = icon, color = color))

    suspend fun deleteCategory(
        token: String,
        userId: String,
        categoryId: Int
    ): Response<DeleteCategoryResponse> =
        api.deleteCategory(token, userId, categoryId)
}