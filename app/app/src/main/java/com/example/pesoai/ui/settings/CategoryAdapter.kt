package com.example.pesoai.ui.settings

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.pesoai.R
import com.example.pesoai.api.models.Category   // ROOT CAUSE FIX: correct package

class CategoryAdapter(
    private val onEdit:   (Category) -> Unit,
    private val onDelete: (Category) -> Unit
) : ListAdapter<Category, CategoryAdapter.ViewHolder>(DiffCallback) {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvIcon:    TextView    = view.findViewById(R.id.tvCategoryIcon)
        val tvName:    TextView    = view.findViewById(R.id.tvCategoryName)
        val tvDefault: TextView    = view.findViewById(R.id.tvCategoryDefault)
        val btnEdit:   ImageButton = view.findViewById(R.id.btnEditCategory)
        val btnDelete: ImageButton = view.findViewById(R.id.btnDeleteCategory)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_category, parent, false)
        return ViewHolder(v)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val cat = getItem(position)

        holder.tvIcon.text = cat.icon
        holder.tvName.text = cat.name

        try {
            val parsed = Color.parseColor(cat.color)
            holder.tvIcon.backgroundTintList =
                android.content.res.ColorStateList.valueOf(parsed)
        } catch (_: IllegalArgumentException) { /* keep default */ }

        holder.tvDefault.visibility = if (cat.isDefault) View.VISIBLE else View.GONE
        holder.btnDelete.visibility = if (cat.isDefault) View.GONE   else View.VISIBLE

        holder.btnEdit.setOnClickListener   { onEdit(cat) }
        holder.btnDelete.setOnClickListener { onDelete(cat) }
    }

    companion object DiffCallback : DiffUtil.ItemCallback<Category>() {
        override fun areItemsTheSame(a: Category, b: Category) = a.id == b.id
        override fun areContentsTheSame(a: Category, b: Category) = a == b
    }
}