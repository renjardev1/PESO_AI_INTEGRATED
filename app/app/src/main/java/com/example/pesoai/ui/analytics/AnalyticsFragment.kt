package com.example.pesoai.ui.analytics

import android.app.DatePickerDialog
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.pesoai.R
import com.example.pesoai.api.models.AnalyticsResponse
import com.example.pesoai.databinding.FragmentAnalyticsBinding
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.BarData
import com.github.mikephil.charting.data.BarDataSet
import com.github.mikephil.charting.data.BarEntry
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineData
import com.github.mikephil.charting.data.LineDataSet
import com.github.mikephil.charting.data.PieData
import com.github.mikephil.charting.data.PieDataSet
import com.github.mikephil.charting.data.PieEntry
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class AnalyticsFragment : Fragment() {

    private var _binding: FragmentAnalyticsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: AnalyticsViewModel by viewModels()
    private lateinit var categoryAdapter: TopCategoryAdapter

    private val calendar  = Calendar.getInstance()
    private var startDate = ""
    private var endDate   = ""
    private var currentTrendPeriod = "month"

    // Legend colors — must match updatePieChart order
    private val pieColors by lazy {
        listOf(
            ContextCompat.getColor(requireContext(), R.color.primary_blue),
            ContextCompat.getColor(requireContext(), R.color.success_green),
            ContextCompat.getColor(requireContext(), R.color.warning_orange),
            ContextCompat.getColor(requireContext(), R.color.error_red),
            ContextCompat.getColor(requireContext(), R.color.primary_blue_light),
            ContextCompat.getColor(requireContext(), R.color.primary_blue_dark)
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAnalyticsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupBarChart()
        setupLineChart()
        setupPieChart()
        setupClickListeners()
        setupObservers()
        setDefaultDateRange()
    }

    override fun onResume() {
        super.onResume()
        if (_binding != null && startDate.isNotEmpty()) loadAnalytics()
    }

    // ── Setup ─────────────────────────────────────────────────────────────────

    private fun setupRecyclerView() {
        categoryAdapter = TopCategoryAdapter()
        binding.rvTopCategories.apply {
            layoutManager            = LinearLayoutManager(requireContext())
            adapter                  = categoryAdapter
            isNestedScrollingEnabled = false
        }
    }

    private fun setupBarChart() {
        val chart = binding.barChart
        chart.description.isEnabled    = false
        chart.legend.isEnabled         = false
        chart.setDrawGridBackground(false)
        chart.setDrawBorders(false)
        chart.isDoubleTapToZoomEnabled = false
        chart.setPinchZoom(false)

        chart.xAxis.apply {
            position         = XAxis.XAxisPosition.BOTTOM
            setDrawGridLines(false)
            granularity      = 1f
            textColor        = ContextCompat.getColor(requireContext(), R.color.text_secondary)
            textSize         = 10f
        }
        chart.axisLeft.apply {
            setDrawGridLines(true)
            gridColor        = ContextCompat.getColor(requireContext(), R.color.divider)
            textColor        = ContextCompat.getColor(requireContext(), R.color.text_secondary)
            textSize         = 10f
            axisMinimum      = 0f
        }
        chart.axisRight.isEnabled = false
    }

    private fun setupLineChart() {
        val chart = binding.lineChart
        chart.description.isEnabled    = false
        chart.legend.isEnabled         = false
        chart.setDrawGridBackground(false)
        chart.setDrawBorders(false)
        chart.isDoubleTapToZoomEnabled = false
        chart.setPinchZoom(false)

        chart.xAxis.apply {
            position         = XAxis.XAxisPosition.BOTTOM
            setDrawGridLines(false)
            granularity      = 1f
            textColor        = ContextCompat.getColor(requireContext(), R.color.text_secondary)
            textSize         = 10f
        }
        chart.axisLeft.apply {
            setDrawGridLines(true)
            gridColor        = ContextCompat.getColor(requireContext(), R.color.divider)
            textColor        = ContextCompat.getColor(requireContext(), R.color.text_secondary)
            textSize         = 10f
            axisMinimum      = 0f
        }
        chart.axisRight.isEnabled = false
    }

    private fun setupPieChart() {
        val chart = binding.pieChart
        chart.description.isEnabled  = false
        chart.isDrawHoleEnabled      = true
        chart.holeRadius             = 50f
        chart.setHoleColor(Color.WHITE)
        chart.setDrawEntryLabels(false)   // labels drawn in our custom legend instead
        chart.legend.isEnabled       = false
        chart.setUsePercentValues(true)
        chart.isRotationEnabled      = true
        chart.animateY(600)
    }

    private fun setupClickListeners() {
        binding.btnFilter.setOnClickListener { showFilterDialog() }
        binding.btnWeekly.setOnClickListener  { selectTrendPeriod("week")  }
        binding.btnMonthly.setOnClickListener { selectTrendPeriod("month") }
        binding.btnYearly.setOnClickListener  { selectTrendPeriod("year")  }
        binding.btnRefreshInsights.setOnClickListener { viewModel.loadInsights() }
    }

    private fun setupObservers() {
        viewModel.analyticsData.observe(viewLifecycleOwner) { data ->
            if (data != null) bindAnalyticsData(data)
        }
        viewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }
        viewModel.error.observe(viewLifecycleOwner) { err ->
            if (!err.isNullOrEmpty())
                Toast.makeText(requireContext(), err, Toast.LENGTH_LONG).show()
        }
        viewModel.trendData.observe(viewLifecycleOwner) { data ->
            if (data?.success == true) updateLineChart(data.data, currentTrendPeriod)
        }
        viewModel.insightsData.observe(viewLifecycleOwner) { response ->
            binding.progressInsights.visibility = View.GONE
            if (response?.success == true && response.insights != null) {
                bindInsights(response)
            } else {
                binding.tvInsightsError.visibility      = View.VISIBLE
                binding.layoutInsightsContent.visibility = View.GONE
            }
        }
        viewModel.isInsightsLoading.observe(viewLifecycleOwner) { loading ->
            binding.progressInsights.visibility      = if (loading) View.VISIBLE else View.GONE
            binding.layoutInsightsContent.visibility = if (loading) View.GONE   else View.VISIBLE
        }
    }

    // ── Date range ────────────────────────────────────────────────────────────

    private fun setDefaultDateRange() {
        val fmt   = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val now   = Calendar.getInstance()
        val start = now.clone() as Calendar
        start.set(Calendar.DAY_OF_MONTH, 1)
        startDate = fmt.format(start.time)
        endDate   = fmt.format(now.time)
        updatePeriodLabel()
        loadAnalytics()
        viewModel.loadTrendData(currentTrendPeriod)
        viewModel.loadInsights()
    }

    private fun updatePeriodLabel() {
        val display = SimpleDateFormat("MMM yyyy", Locale.getDefault())
        try {
            val fmt   = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val start = fmt.parse(startDate)!!
            val end   = fmt.parse(endDate)!!
            val sameMonth = SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(start) ==
                    SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(end)
            binding.tvAnalyticsPeriod.text = if (sameMonth) display.format(start)
            else "${display.format(start)} – ${display.format(end)}"
        } catch (e: Exception) {
            binding.tvAnalyticsPeriod.text = "$startDate – $endDate"
        }
    }

    private fun loadAnalytics() { viewModel.loadAnalytics(startDate, endDate) }

    private fun selectTrendPeriod(period: String) {
        currentTrendPeriod = period
        val activeColor   = ContextCompat.getColor(requireContext(), R.color.primary_blue)
        val inactiveColor = ContextCompat.getColor(requireContext(), R.color.text_secondary)
        binding.btnWeekly.setTextColor( if (period == "week")  Color.WHITE else inactiveColor)
        binding.btnMonthly.setTextColor(if (period == "month") Color.WHITE else inactiveColor)
        binding.btnYearly.setTextColor( if (period == "year")  Color.WHITE else inactiveColor)
        viewModel.loadTrendData(period)
    }

    // ── Bind analytics response ───────────────────────────────────────────────

    private fun bindAnalyticsData(data: AnalyticsResponse) {
        val fmt     = NumberFormat.getNumberInstance(Locale.US)
        val summary = data.summary

        binding.tvTotalSpent.text        = "₱${fmt.format(summary.totalSpent.toInt())}"
        binding.tvTotalTransactions.text = summary.totalTransactions.toString()
        val avg = if (summary.totalTransactions > 0)
            summary.totalSpent / summary.totalTransactions else 0.0
        binding.tvAverageSpending.text = "₱${fmt.format(avg.toInt())} avg"

        val prefs = requireActivity().getSharedPreferences("PesoAI_Prefs", Context.MODE_PRIVATE)
        // Priority: user_monthly_budget → monthly_income → fallback 10000
        val monthlyBudget = prefs.getFloat("user_monthly_budget",
            prefs.getFloat("monthly_income",
                prefs.getFloat("monthly_expenses", 10000f)
            )
        ).toDouble()

        val pct = if (monthlyBudget > 0) (summary.totalSpent / monthlyBudget * 100) else 0.0
        val (statusText, statusColor) = when {
            pct >= 100.0 -> Pair("🔴 DANGER — ${String.format("%.0f", pct)}% of budget used",   R.color.error_red)
            pct >= 80.0  -> Pair("🔴 CRITICAL — ${String.format("%.0f", pct)}% of budget used", R.color.error_red)
            pct >= 50.0  -> Pair("🟡 WARNING — ${String.format("%.0f", pct)}% of budget used",  R.color.warning_orange)
            else         -> Pair("🟢 On track — ${String.format("%.0f", pct)}% of budget used", R.color.success_green)
        }
        binding.tvBudgetComparison.text = statusText
        binding.tvBudgetComparison.setTextColor(ContextCompat.getColor(requireContext(), statusColor))

        updateBarChart(data)
        updatePieChart(data)
        categoryAdapter.submitList(data.topCategories)
        binding.tvEmptyCategories.visibility =
            if (data.topCategories.isEmpty()) View.VISIBLE else View.GONE
    }

    // ── Bar chart ─────────────────────────────────────────────────────────────

    private fun updateBarChart(data: AnalyticsResponse) {
        val chart = binding.barChart
        if (data.dailySpending.isNullOrEmpty()) {
            chart.clear(); chart.invalidate(); return
        }

        val sorted  = data.dailySpending.sortedBy { it.transactionDate }
        val entries = sorted.mapIndexed { idx, item ->
            BarEntry(idx.toFloat(), item.totalSpent.toFloat())
        }
        val labels = sorted.map {
            try {
                SimpleDateFormat("dd", Locale.getDefault())
                    .format(SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).parse(it.transactionDate)!!)
            } catch (e: Exception) { it.transactionDate }
        }

        val dataSet = BarDataSet(entries, getString(R.string.analytics_daily_label)).apply {
            color          = ContextCompat.getColor(requireContext(), R.color.primary_blue)
            valueTextColor = Color.TRANSPARENT
            setDrawValues(false)
        }
        chart.xAxis.valueFormatter = IndexAxisValueFormatter(labels)
        chart.xAxis.labelCount     = minOf(labels.size, 7)
        chart.data                 = BarData(dataSet).apply { barWidth = 0.7f }
        chart.animateY(400)
        chart.invalidate()
    }

    // ── Pie chart + legend ────────────────────────────────────────────────────

    private fun updatePieChart(data: AnalyticsResponse) {
        val chart = binding.pieChart
        if (data.categoryBreakdown.isNullOrEmpty()) {
            chart.clear()
            chart.invalidate()
            buildPieLegend(emptyList(), emptyList())
            return
        }

        val entries = data.categoryBreakdown.mapIndexed { idx, cat ->
            PieEntry(cat.percentage.toFloat(), cat.category)
        }
        val colors = data.categoryBreakdown.mapIndexed { idx, _ ->
            pieColors[idx % pieColors.size]
        }

        val dataSet = PieDataSet(entries, "").apply {
            this.colors    = colors
            sliceSpace     = 2f
            selectionShift = 5f
        }
        chart.data = PieData(dataSet).apply {
            setValueTextColor(Color.TRANSPARENT)
            setDrawValues(false)
        }
        chart.animateY(600)
        chart.invalidate()

        // Build the category legend below the pie chart
        buildPieLegend(data.categoryBreakdown, colors)
    }

    /**
     * Builds a programmatic legend under the pie chart.
     * Each row: colored dot · Category name · percentage
     * Uses layoutPieLegend from fragment_analytics.xml (must be a LinearLayout).
     */
    private fun buildPieLegend(
        breakdown: List<com.example.pesoai.api.models.CategoryBreakdown>,
        colors: List<Int>
    ) {
        val legendLayout = binding.layoutPieLegend
        legendLayout.removeAllViews()

        if (breakdown.isEmpty()) return

        val fmt = NumberFormat.getNumberInstance(Locale.US)

        breakdown.forEachIndexed { idx, cat ->
            val row = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, 6, 0, 6)
            }

            // Colored dot
            val dot = View(requireContext()).apply {
                layoutParams = LinearLayout.LayoutParams(20, 20).also { lp ->
                    lp.marginEnd = 10
                    lp.topMargin = 2
                }
                background = ContextCompat.getDrawable(requireContext(), R.drawable.bg_circle)
                    ?.mutate()?.also { it.setTint(colors[idx % colors.size]) }
            }

            // Category name
            val tvName = TextView(requireContext()).apply {
                text      = cat.category.replaceFirstChar { it.titlecase(Locale.getDefault()) }
                textSize  = 12f
                setTextColor(ContextCompat.getColor(requireContext(), R.color.text_primary))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }

            // Percentage + amount
            val tvValue = TextView(requireContext()).apply {
                text     = "${String.format("%.1f", cat.percentage)}%  ₱${fmt.format(cat.total.toInt())}"
                textSize = 12f
                setTextColor(ContextCompat.getColor(requireContext(), R.color.text_secondary))
            }

            row.addView(dot)
            row.addView(tvName)
            row.addView(tvValue)
            legendLayout.addView(row)
        }
    }

    // ── Line chart (spending trend) ───────────────────────────────────────────

    private fun updateLineChart(
        trendPoints: List<com.example.pesoai.api.models.TrendDataPoint>,
        period: String
    ) {
        val chart = binding.lineChart
        if (trendPoints.isEmpty()) {
            chart.clear(); chart.invalidate(); return
        }

        val spendingEntries = trendPoints.mapIndexed { idx, point ->
            Entry(idx.toFloat(), point.spending.toFloat())
        }
        val incomeEntries = trendPoints.mapIndexed { idx, point ->
            Entry(idx.toFloat(), point.income.toFloat())
        }
        val labels = trendPoints.map { it.label }

        val spendingSet = LineDataSet(spendingEntries, getString(R.string.analytics_spending_label)).apply {
            color          = ContextCompat.getColor(requireContext(), R.color.error_red)
            setCircleColor(ContextCompat.getColor(requireContext(), R.color.error_red))
            lineWidth      = 2f
            circleRadius   = 3f
            setDrawValues(false)
            mode           = LineDataSet.Mode.CUBIC_BEZIER
        }
        val incomeSet = LineDataSet(incomeEntries, getString(R.string.analytics_income_label)).apply {
            color          = ContextCompat.getColor(requireContext(), R.color.success_green)
            setCircleColor(ContextCompat.getColor(requireContext(), R.color.success_green))
            lineWidth      = 2f
            circleRadius   = 3f
            setDrawValues(false)
            mode           = LineDataSet.Mode.CUBIC_BEZIER
        }

        chart.xAxis.valueFormatter = IndexAxisValueFormatter(labels)
        chart.xAxis.labelCount     = labels.size
        chart.data                 = LineData(spendingSet, incomeSet)
        chart.animateX(400)
        chart.invalidate()
    }

    // ── AI Insights ───────────────────────────────────────────────────────────

    private fun bindInsights(response: com.example.pesoai.api.models.InsightsResponse) {
        val insights = response.insights ?: return

        binding.tvInsightsError.visibility       = View.GONE
        binding.layoutInsightsContent.visibility = View.VISIBLE

        binding.tvInsightSummary.text = insights.summary

        binding.layoutRecommendations.removeAllViews()
        if (insights.recommendations.isNotEmpty()) {
            binding.tvRecommendationsHeader.visibility = View.VISIBLE
            insights.recommendations.forEach { rec ->
                binding.layoutRecommendations.addView(buildBulletTextView("• $rec"))
            }
        }

        binding.layoutTrends.removeAllViews()
        if (insights.trends.isNotEmpty()) {
            binding.tvTrendsHeader.visibility = View.VISIBLE
            insights.trends.forEach { trend ->
                binding.layoutTrends.addView(buildBulletTextView("• $trend"))
            }
        }

        binding.layoutAlerts.removeAllViews()
        if (insights.alerts.isNotEmpty()) {
            binding.tvAlertsHeader.visibility = View.VISIBLE
            insights.alerts.forEach { alert ->
                val tv = buildBulletTextView("⚠ $alert")
                tv.setTextColor(ContextCompat.getColor(requireContext(), R.color.error_red))
                binding.layoutAlerts.addView(tv)
            }
        }
    }

    private fun buildBulletTextView(text: String): TextView {
        return TextView(requireContext()).apply {
            this.text = text
            textSize  = 13f
            setTextColor(ContextCompat.getColor(requireContext(), R.color.text_primary))
            setPadding(0, 6, 0, 6)
        }
    }

    // ── Filter dialog ─────────────────────────────────────────────────────────

    private fun showFilterDialog() {
        val items = arrayOf(
            getString(R.string.filter_this_month),
            getString(R.string.filter_last_month),
            getString(R.string.filter_last_3_months),
            getString(R.string.filter_custom_range)
        )
        androidx.appcompat.app.AlertDialog.Builder(requireContext())
            .setTitle(getString(R.string.dialog_title_filter_period))
            .setItems(items) { _, which ->
                when (which) {
                    0 -> setThisMonth()
                    1 -> setLastMonth()
                    2 -> setLast3Months()
                    3 -> showCustomRangePicker()
                }
            }
            .setNegativeButton(getString(R.string.btn_cancel), null)
            .show()
    }

    private fun setThisMonth() {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val now = Calendar.getInstance()
        val start = now.clone() as Calendar
        start.set(Calendar.DAY_OF_MONTH, 1)
        startDate = fmt.format(start.time); endDate = fmt.format(now.time)
        updatePeriodLabel(); loadAnalytics()
    }

    private fun setLastMonth() {
        val fmt   = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val start = Calendar.getInstance().apply { add(Calendar.MONTH, -1); set(Calendar.DAY_OF_MONTH, 1) }
        val end   = start.clone() as Calendar
        end.set(Calendar.DAY_OF_MONTH, end.getActualMaximum(Calendar.DAY_OF_MONTH))
        startDate = fmt.format(start.time); endDate = fmt.format(end.time)
        updatePeriodLabel(); loadAnalytics()
    }

    private fun setLast3Months() {
        val fmt   = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val start = Calendar.getInstance().apply { add(Calendar.MONTH, -3); set(Calendar.DAY_OF_MONTH, 1) }
        val end   = Calendar.getInstance()
        startDate = fmt.format(start.time); endDate = fmt.format(end.time)
        updatePeriodLabel(); loadAnalytics()
    }

    private fun showCustomRangePicker() {
        val fmt   = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val today = Calendar.getInstance()
        DatePickerDialog(requireContext(), { _, sy, sm, sd ->
            val startCal = Calendar.getInstance().also { it.set(sy, sm, sd) }
            DatePickerDialog(requireContext(), { _, ey, em, ed ->
                val endCal = Calendar.getInstance().also { it.set(ey, em, ed) }
                if (endCal.before(startCal)) {
                    Toast.makeText(requireContext(), getString(R.string.error_end_before_start), Toast.LENGTH_SHORT).show()
                    return@DatePickerDialog
                }
                startDate = fmt.format(startCal.time); endDate = fmt.format(endCal.time)
                updatePeriodLabel(); loadAnalytics()
            }, today.get(Calendar.YEAR), today.get(Calendar.MONTH), today.get(Calendar.DAY_OF_MONTH)).show()
        }, today.get(Calendar.YEAR), today.get(Calendar.MONTH), today.get(Calendar.DAY_OF_MONTH)).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}