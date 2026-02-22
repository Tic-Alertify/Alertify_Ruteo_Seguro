package com.erickballas.ruteoseguro.ui.map

import android.content.pm.PackageManager
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.erickballas.ruteoseguro.R
import com.erickballas.ruteoseguro.viewmodel.MapViewModel
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.libraries.places.api.Places
import com.google.android.libraries.places.api.model.Place
import com.google.android.libraries.places.api.net.FetchPlaceRequest
import com.google.android.libraries.places.api.net.FindAutocompletePredictionsRequest
import com.google.android.libraries.places.api.net.PlacesClient

class MapFragment : Fragment(), OnMapReadyCallback {

    private lateinit var googleMap: GoogleMap
    private val viewModel: MapViewModel by viewModels()

    private lateinit var placesClient: PlacesClient
    private lateinit var etDestino: EditText
    private lateinit var rvSugerencias: RecyclerView
    private lateinit var placesAdapter: PlacesAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        return inflater.inflate(R.layout.fragment_map, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        initPlaces()
        placesClient = Places.createClient(requireContext())

        etDestino = view.findViewById(R.id.et_destino)
        rvSugerencias = view.findViewById(R.id.rv_sugerencias)

        // Preparamos el mapa
        val mapFragment = childFragmentManager.findFragmentById(R.id.google_map) as SupportMapFragment?
        mapFragment?.getMapAsync(this)

        configurarBuscador()
    }

    private fun configurarBuscador() {
        // 1. Configurar la lista que recibe los clics
        placesAdapter = PlacesAdapter { prediction ->
            // Al hacer clic en un resultado:
            etDestino.setText(prediction.getPrimaryText(null).toString()) // Ponemos el nombre en la barra
            etDestino.clearFocus() // Quitamos el teclado
            placesAdapter.submitList(emptyList()) // Ocultamos la lista

            // Buscamos la coordenada exacta de ese lugar
            obtenerCoordenadasDelLugar(prediction.placeId)
        }
        rvSugerencias.layoutManager = LinearLayoutManager(requireContext())
        rvSugerencias.adapter = placesAdapter

        // 2. Escuchar lo que el usuario escribe en tiempo real
        etDestino.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {}
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val query = s.toString()
                if (query.length > 2) { // Solo buscar si hay más de 2 letras (ahorra dinero de la API)
                    buscarSugerencias(query)
                } else {
                    placesAdapter.submitList(emptyList()) // Si borra, limpia la lista
                }
            }
        })
    }

    private fun buscarSugerencias(query: String) {
        val request = FindAutocompletePredictionsRequest.builder()
            .setQuery(query)
            .setCountry("EC") // 🇪🇨 Restringimos a Ecuador
            .build()

        placesClient.findAutocompletePredictions(request).addOnSuccessListener { response ->
            // Enviar los resultados al RecyclerView
            placesAdapter.submitList(response.autocompletePredictions)
        }.addOnFailureListener {
            // Manejo de errores silencioso
        }
    }

    private fun obtenerCoordenadasDelLugar(placeId: String) {
        // Le pedimos a Google explícitamente la latitud y longitud de ese ID
        val placeFields = listOf(Place.Field.ID, Place.Field.NAME, Place.Field.LAT_LNG)
        val request = FetchPlaceRequest.builder(placeId, placeFields).build()

        placesClient.fetchPlace(request).addOnSuccessListener { response ->
            val place = response.place
            val coordenadaDestino = place.latLng

            coordenadaDestino?.let {
                // Hacemos el vuelo de cámara y guardamos la coordenada (Para la T-03)
                googleMap.animateCamera(CameraUpdateFactory.newLatLngZoom(it, 16f))
            }
        }
    }

    private fun initPlaces() {
        if (!Places.isInitialized()) {
            val appInfo = requireContext().packageManager.getApplicationInfo(requireContext().packageName, PackageManager.GET_META_DATA)
            val apiKey = appInfo.metaData.getString("com.google.android.geo.API_KEY")
            if (apiKey != null) Places.initialize(requireContext(), apiKey)
        }
    }

    override fun onMapReady(map: GoogleMap) {
        googleMap = map
        googleMap.uiSettings.isZoomControlsEnabled = false
        googleMap.uiSettings.isCompassEnabled = true
        googleMap.moveCamera(CameraUpdateFactory.newLatLngZoom(viewModel.quitoLocation, viewModel.defaultZoom))
    }
}