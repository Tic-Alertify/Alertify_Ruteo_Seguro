package com.erickballas.ruteoseguro.ui.map

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.erickballas.ruteoseguro.R
import com.google.android.libraries.places.api.model.AutocompletePrediction

class PlacesAdapter(
    private val clickListener: (AutocompletePrediction) -> Unit
) : RecyclerView.Adapter<PlacesAdapter.PlaceViewHolder>() {

    private var predictions: List<AutocompletePrediction> = listOf()

    // Función para actualizar la lista cuando el usuario escribe
    fun submitList(newPredictions: List<AutocompletePrediction>) {
        predictions = newPredictions
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PlaceViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_lugar_busqueda, parent, false)
        return PlaceViewHolder(view)
    }

    override fun onBindViewHolder(holder: PlaceViewHolder, position: Int) {
        val prediction = predictions[position]
        // Muestra el texto completo sugerido por Google (Ej: "Parque La Carolina, Quito")
        holder.tvName.text = prediction.getFullText(null).toString()

        holder.itemView.setOnClickListener { clickListener(prediction) }
    }

    override fun getItemCount() = predictions.size

    class PlaceViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvName: TextView = itemView.findViewById(R.id.tv_nombre_lugar)
    }
}