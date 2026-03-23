package com.example.pesoai.data.repository

import com.example.pesoai.api.ApiClient
import com.example.pesoai.api.models.MarkReadResponse
import com.example.pesoai.api.models.NotificationListResponse
import com.example.pesoai.api.models.NotificationSettingsRequest
import com.example.pesoai.api.models.NotificationSettingsResponse
import retrofit2.Response

class NotificationRepository {

    private val api = ApiClient.authApi

    suspend fun getNotifications(
        token: String,
        userId: String
    ): Response<NotificationListResponse> =
        api.getNotifications(token, userId)

    suspend fun updateSettings(
        token: String,
        userId: String,
        request: NotificationSettingsRequest
    ): Response<NotificationSettingsResponse> =
        api.updateNotificationSettings(token, userId, request)

    suspend fun markRead(
        token: String,
        userId: String,
        notificationId: Int
    ): Response<MarkReadResponse> =
        api.markNotificationRead(token, userId, notificationId)

    suspend fun markAllRead(
        token: String,
        userId: String
    ): Response<MarkReadResponse> =
        api.markAllNotificationsRead(token, userId)
}