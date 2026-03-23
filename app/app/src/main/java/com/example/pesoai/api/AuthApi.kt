package com.example.pesoai.api

import com.example.pesoai.api.models.*
import retrofit2.Response
import retrofit2.http.*

interface AuthApi {

    // ==================== AUTH (no token required) ====================

    @POST("signup")
    suspend fun signup(
        @Body body: SignupRequest
    ): Response<AuthResponse>

    @POST("login")
    suspend fun login(
        @Body body: LoginRequest
    ): Response<AuthResponse>

    @POST("onboarding")
    suspend fun completeOnboarding(
        @Header("Authorization") token: String,
        @Body body: OnboardingRequest
    ): Response<OnboardingResponse>

    // ==================== PROFILE ====================

    @GET("profile/{userId}")
    suspend fun getProfile(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<ProfileResponse>

    @GET("profile/{userId}")
    suspend fun getUserProfile(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<ProfileResponse>

    @PUT("profile/{userId}")
    suspend fun updateProfile(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: UpdateProfileRequest
    ): Response<ProfileResponse>

    @PUT("profile/{userId}/picture")
    suspend fun uploadProfilePicture(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: UploadProfilePictureRequest
    ): Response<UploadProfilePictureResponse>

    @PUT("profile/{userId}/budget")
    suspend fun updateBudget(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: UpdateBudgetRequest
    ): Response<UpdateBudgetResponse>

    @PUT("profile/{userId}/budget-period")
    suspend fun updateBudgetPeriod(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: UpdateBudgetPeriodRequest
    ): Response<UpdateBudgetPeriodResponse>

    @PUT("profile/{userId}/password")
    suspend fun changePassword(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: ChangePasswordRequest
    ): Response<ChangePasswordResponse>

    @HTTP(method = "DELETE", path = "profile/{userId}", hasBody = true)
    suspend fun deleteAccount(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: DeleteAccountRequest
    ): Response<DeleteAccountResponse>

    // ==================== DASHBOARD ====================

    @GET("dashboard/{userId}")
    suspend fun getDashboard(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<DashboardResponse>

    @GET("dashboard/{userId}")
    suspend fun getDashboardData(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<DashboardResponse>

    @GET("dashboard/{userId}/profile")
    suspend fun getFullProfile(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<FullProfileResponse>

    // ==================== TRANSACTIONS ====================

    @GET("transactions/{userId}")
    suspend fun getTransactions(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<TransactionListResponse>

    @POST("transactions")
    suspend fun addTransaction(
        @Header("Authorization") token: String,
        @Body body: TransactionRequest
    ): Response<TransactionResponse>

    @PUT("transactions/{userId}/{transactionId}")
    suspend fun updateTransaction(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Path("transactionId") transactionId: Int,
        @Body body: TransactionRequest
    ): Response<TransactionResponse>

    @DELETE("transactions/{userId}/{transactionId}")
    suspend fun deleteTransaction(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Path("transactionId") transactionId: Int
    ): Response<DeleteResponse>

    @GET("transactions/{userId}/range")
    suspend fun getTransactionsByRange(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Query("startDate") startDate: String,
        @Query("endDate") endDate: String
    ): Response<TransactionListResponse>

    @GET("transactions/{userId}/summary/monthly")
    suspend fun getMonthlySummary(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<MonthlySummaryResponse>

    // ==================== SAVINGS GOALS ====================

    @GET("goals/{userId}")
    suspend fun getGoals(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<GoalsResponse>

    @GET("goals/{userId}")
    suspend fun getGoalsFiltered(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Query("status") status: String?
    ): Response<GoalsResponse>

    @POST("goals")
    suspend fun addGoal(
        @Header("Authorization") token: String,
        @Body body: GoalRequest
    ): Response<GoalResponse>

    @PUT("goals/{userId}/{goalId}")
    suspend fun updateGoal(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Path("goalId") goalId: Int,
        @Body body: GoalRequest
    ): Response<GoalResponse>

    @POST("goals/{userId}/{goalId}/contribute")
    suspend fun contributeToGoal(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Path("goalId") goalId: Int,
        @Body body: ContributionRequest
    ): Response<GoalResponse>

    @GET("goals/{userId}/{goalId}/contributions")
    suspend fun getGoalContributions(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Path("goalId") goalId: Int,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<ContributionsResponse>

    @DELETE("goals/{userId}/{goalId}")
    suspend fun deleteGoal(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Path("goalId") goalId: Int
    ): Response<DeleteResponse>

    // ==================== ANALYTICS ====================

    @GET("analytics/{userId}")
    suspend fun getAnalytics(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Query("startDate") startDate: String,
        @Query("endDate") endDate: String
    ): Response<AnalyticsResponse>

    @GET("analytics/trend/{userId}")
    suspend fun getSpendingTrend(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Query("months") months: Int = 6
    ): Response<TrendResponse>

    @GET("analytics/trend-chart/{userId}")
    suspend fun getTrendData(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Query("period") period: String
    ): Response<TrendDataResponse>

    @GET("ai/insights/{userId}")
    suspend fun getAIInsights(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<InsightsResponse>

    // ==================== AI CHAT ====================

    @POST("ai/chat/{userId}")
    suspend fun sendMessage(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: AIChatRequest
    ): Response<AIChatResponse>

    @POST("ai/chat/{userId}")
    suspend fun chatWithAI(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: AIChatRequest
    ): Response<AIChatResponse>

    @POST("ai/history/save/{userId}")
    suspend fun saveHistory(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: SaveHistoryRequest
    ): Response<SaveHistoryResponse>

    @POST("ai/history/save/{userId}")
    suspend fun saveConversationHistory(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: SaveHistoryRequest
    ): Response<SaveHistoryResponse>

    @GET("ai/history/list/{userId}")
    suspend fun getHistoryList(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<HistoryListResponse>

    @GET("ai/history/list/{userId}")
    suspend fun getConversationHistory(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Query("page")  page:  Int = 1,
        @Query("limit") limit: Int = 10
    ): Response<HistoryListResponse>

    @GET("ai/history/get/{userId}/{historyId}")
    suspend fun getHistory(
        @Header("Authorization") token: String,
        @Path("userId")    userId:    String,
        @Path("historyId") historyId: Int
    ): Response<ConversationResponse>

    @GET("ai/history/get/{userId}/{historyId}")
    suspend fun getConversationById(
        @Header("Authorization") token: String,
        @Path("userId")    userId:    String,
        @Path("historyId") historyId: Int
    ): Response<ConversationResponse>

    @DELETE("ai/history/{userId}/{historyId}")
    suspend fun deleteHistory(
        @Header("Authorization") token: String,
        @Path("userId")    userId:    String,
        @Path("historyId") historyId: Int
    ): Response<DeleteResponse>

    @DELETE("ai/history/{userId}/{historyId}")
    suspend fun deleteConversationHistory(
        @Header("Authorization") token: String,
        @Path("userId")    userId:    String,
        @Path("historyId") historyId: Int
    ): Response<DeleteResponse>

    // ==================== EXPORT ====================

    @POST("export/transactions/{userId}/pdf")
    suspend fun exportTransactionsPDF(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Query("period") period: String,
        @Query("startDate") startDate: String? = null,
        @Query("endDate") endDate: String? = null
    ): Response<ExportResponse>

    // ==================== NOTIFICATIONS ====================

    @GET("notifications/{userId}")
    suspend fun getNotifications(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<NotificationListResponse>

    @PUT("notifications/{userId}/settings")
    suspend fun updateNotificationSettings(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: NotificationSettingsRequest
    ): Response<NotificationSettingsResponse>

    @PUT("notifications/{userId}/{notificationId}/read")
    suspend fun markNotificationRead(
        @Header("Authorization") token: String,
        @Path("userId")         userId: String,
        @Path("notificationId") notificationId: Int
    ): Response<MarkReadResponse>

    @PUT("notifications/{userId}/read-all")
    suspend fun markAllNotificationsRead(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<MarkReadResponse>

    // ==================== BACKUP ====================

    @GET("backup/{userId}")
    suspend fun getBackup(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<BackupResponse>

    @POST("backup/{userId}/restore/{backupId}")  // ✅ FIX: Added {backupId} to route
    suspend fun restoreBackup(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Path("backupId") backupId: String  // ✅ FIX: Changed from @Body to @Path
    ): Response<RestoreResponse>

    @POST("backup/{userId}")
    suspend fun createBackup(
        @Header("Authorization") token:  String,
        @Path("userId")          userId: String
    ): Response<BackupResponse>

    // ==================== APP LOCK ====================

    @GET("app-lock/{userId}")
    suspend fun getAppLock(
        @Header("Authorization") token: String,
        @Path("userId") userId: String
    ): Response<AppLockResponse>

    @PUT("app-lock/{userId}")
    suspend fun setAppLock(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: SetAppLockRequest
    ): Response<AppLockResponse>

    @POST("app-lock/{userId}/verify")
    suspend fun verifyPin(
        @Header("Authorization") token: String,
        @Path("userId") userId: String,
        @Body request: VerifyPinRequest
    ): Response<VerifyPinResponse>

    /// ==================== CUSTOM BUDGET CATEGORIES ====================

    @GET("categories/{userId}")
    suspend fun getCategories(
        @Header("Authorization") token: String,  // ✅ FIX: Added token
        @Path("userId") userId: String
    ): Response<CategoryListResponse>

    @POST("categories/{userId}")
    suspend fun addCategory(
        @Header("Authorization") token: String,  // ✅ FIX: Added token
        @Path("userId") userId: String,
        @Body request: AddCategoryRequest
    ): Response<CategoryResponse>

    @PUT("categories/{userId}/{categoryId}")
    suspend fun updateCategory(
        @Header("Authorization") token: String,  // ✅ FIX: Added token
        @Path("userId")     userId: String,
        @Path("categoryId") categoryId: Int,
        @Body request: UpdateCategoryRequest
    ): Response<CategoryResponse>

    @DELETE("categories/{userId}/{categoryId}")
    suspend fun deleteCategory(
        @Header("Authorization") token: String,  // ✅ FIX: Added token
        @Path("userId")     userId: String,
        @Path("categoryId") categoryId: Int
    ): Response<DeleteCategoryResponse>

    // ── Forgot Password ──────────────────────────────────────────────────────

    @POST("forgot-password")
    suspend fun forgotPassword(
        @Body request: ForgotPasswordRequest
    ): Response<ForgotPasswordResponse>

    @POST("reset-password")
    suspend fun resetPassword(
        @Body request: ResetPasswordRequest
    ): Response<ResetPasswordResponse>

    // ==================== RECURRING TRANSACTIONS ====================

    @GET("recurring/{userId}")
    suspend fun getRecurring(
        @Header("Authorization") token:  String,
        @Path("userId")          userId: String
    ): Response<RecurringListResponse>

    @POST("recurring/{userId}")
    suspend fun createRecurring(
        @Header("Authorization") token:   String,
        @Path("userId")          userId:  String,
        @Body                    request: RecurringRequest
    ): Response<RecurringResponse>

    @PUT("recurring/{userId}/{recurringId}")
    suspend fun updateRecurring(
        @Header("Authorization") token:       String,
        @Path("userId")          userId:      String,
        @Path("recurringId")     recurringId: Int,
        @Body                    request:     RecurringRequest
    ): Response<RecurringResponse>

    @PUT("recurring/{userId}/{recurringId}/cancel")
    suspend fun cancelRecurring(
        @Header("Authorization") token:       String,
        @Path("userId")          userId:      String,
        @Path("recurringId")     recurringId: Int
    ): Response<RecurringResponse>

    // DELETE remains the same
    @DELETE("recurring/{userId}/{recurringId}")
    suspend fun deleteRecurring(
        @Header("Authorization") token:       String,
        @Path("userId")          userId:      String,
        @Path("recurringId")     recurringId: Int
    ): Response<RecurringResponse>

    @POST("recurring/{userId}/{recurringId}/pay")
    suspend fun markRecurringAsPaid(
        @Header("Authorization") token:       String,
        @Path("userId")          userId:      String,
        @Path("recurringId")     recurringId: Int
    ): Response<RecurringActionResponse>

    @POST("recurring/{userId}/{recurringId}/dismiss")
    suspend fun dismissRecurring(
        @Header("Authorization") token:       String,
        @Path("userId")          userId:      String,
        @Path("recurringId")     recurringId: Int
    ): Response<RecurringActionResponse>

    @GET("recurring/{userId}")
    suspend fun getRecurringFiltered(
        @Header("Authorization") token:  String,
        @Path("userId")          userId: String,
        @Query("status")         status: String?
    ): Response<RecurringListResponse>
}