@file:Suppress("DEPRECATION")

package com.erickballas.ruteoseguro.ui.map

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.location.Location
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.DrawableRes
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.erickballas.ruteoseguro.R
import com.erickballas.ruteoseguro.viewmodel.MapViewModel
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Polyline
import com.google.android.gms.maps.model.PolylineOptions
import com.google.android.gms.maps.model.RoundCap
import com.google.android.gms.maps.model.JointType
import com.google.android.libraries.places.api.Places
import com.google.android.libraries.places.api.model.Place
import com.google.android.libraries.places.api.model.RectangularBounds
import com.google.android.libraries.places.api.net.FetchPlaceRequest
import com.google.android.libraries.places.api.net.FindAutocompletePredictionsRequest
import com.google.android.libraries.places.api.net.PlacesClient
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions
import com.erickballas.ruteoseguro.utils.Constants
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.button.MaterialButton
import com.google.maps.android.PolyUtil
import kotlinx.coroutines.launch
import androidx.core.graphics.toColorInt
import com.google.android.gms.maps.model.BitmapDescriptor
import androidx.core.graphics.createBitmap

class MapFragment : Fragment(), OnMapReadyCallback {

    private lateinit var googleMap: GoogleMap
    private val viewModel: MapViewModel by viewModels()

    // Herramientas de Google
    private lateinit var placesClient: PlacesClient
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    // Componentes de la UI
    private lateinit var etDestino: EditText
    private lateinit var ivClearText: ImageView
    private lateinit var btnConfirmarUbicacion: MaterialButton
    private lateinit var btnCambiarDestino: MaterialButton
    private lateinit var rvSugerencias: RecyclerView
    private lateinit var placesAdapter: PlacesAdapter

    // Bandera para evitar llamadas cíclicas al TextWatcher
    private var isProgrammaticChange = false

    // Marcadores de origen y destino en el mapa
    private var origenMarker: Marker? = null
    private var destinoMarker: Marker? = null

    // Lista para guardar la ruta y poder borrarla después
    private val rutaPolylines = mutableListOf<Polyline>()


    private lateinit var layoutLoading: View

    // Lanzador para solicitar permisos de ubicación modernos
    private val requestLocationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false

        if (fineLocationGranted || coarseLocationGranted) {
            obtenerUbicacionActual()
        } else {
            Toast.makeText(requireContext(), "El permiso de ubicación es necesario para trazar la ruta", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        return inflater.inflate(R.layout.fragment_map, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        initPlaces()
        placesClient = Places.createClient(requireContext())
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())

        // Enlace de vistas
        etDestino = view.findViewById(R.id.et_destino)
        ivClearText = view.findViewById(R.id.iv_clear_text)
        btnConfirmarUbicacion = view.findViewById(R.id.btn_confirmar_ubicacion)
        btnCambiarDestino = view.findViewById(R.id.btn_cambiar_destino)
        rvSugerencias = view.findViewById(R.id.rv_sugerencias)
        layoutLoading = view.findViewById(R.id.layout_loading)

        val mapFragment = childFragmentManager.findFragmentById(R.id.google_map) as SupportMapFragment?
        mapFragment?.getMapAsync(this)

        configurarBotonesAccion()
        configurarBuscador()
        observarErrores()
        observarCoordenadas()
        observarRutaCalculada()
        observarCarga()
    }

    private fun observarErrores() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.errorMessage.collect { mensaje ->
                    if (!mensaje.isNullOrEmpty()) {
                        Toast.makeText(requireContext(), mensaje, Toast.LENGTH_LONG).show()
                        viewModel.clearError()
                    }
                }
            }
        }
    }

    private fun observarRutaCalculada() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.rutaPolyline.collect { encodedPolyline ->
                    if (!::googleMap.isInitialized) return@collect

                    // Limpiamos la ruta anterior siempre que haya un cambio
                    clearRutaPolyline()

                    if (encodedPolyline.isNullOrBlank()) return@collect

                    try {
                        val puntos = PolyUtil.decode(encodedPolyline)
                        if (puntos.isEmpty()) return@collect

                        // T-12: 1. Preparamos el constructor de la "caja" de límites
                        val boundsBuilder = com.google.android.gms.maps.model.LatLngBounds.Builder()

                        val MAX_POINTS_PER_POLYLINE = 9500
                        var index = 0

                        while (index < puntos.size) {
                            val endExclusive = minOf(index + MAX_POINTS_PER_POLYLINE, puntos.size)
                            val segment = ArrayList<LatLng>()

                            if (index != 0) {
                                segment.add(puntos[index - 1])
                            }
                            segment.addAll(puntos.subList(index, endExclusive))

                            // Dibujamos este segmento y lo guardamos en la lista
                            val polyline = googleMap.addPolyline(
                                PolylineOptions()
                                    .addAll(segment)
                                    .width(16f)
                                    .color("#1E88E5".toColorInt())
                                    .startCap(RoundCap())
                                    .endCap(RoundCap())
                                    .jointType(JointType.ROUND)
                                    .geodesic(true)
                                    .zIndex(2f)
                            )
                            rutaPolylines.add(polyline)

                            // T-12: 2. Metemos todos los puntos del segmento en la caja
                            for (punto in segment) {
                                boundsBuilder.include(punto)
                            }

                            index = endExclusive
                        }

                        // T-12: 3. Construimos los límites y animamos la cámara
                        val bounds = boundsBuilder.build()
                        val padding = 150 // Espacio en píxeles (margen) entre la ruta y el borde de la pantalla

                        googleMap.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, padding))

                    } catch (ex: IllegalArgumentException) {
                        Log.e("MapFragment", "Polyline inválida recibida", ex)
                        Toast.makeText(requireContext(), "No se pudo dibujar la ruta recibida.", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    // Función extraída correctamente al nivel de la clase
    private fun clearRutaPolyline() {
        rutaPolylines.forEach { it.remove() }
        rutaPolylines.clear()
    }

    private fun observarCoordenadas() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.coordenadaOrigen.collect { latLng ->
                    latLng ?: return@collect
                    if (!::googleMap.isInitialized) return@collect
                    origenMarker?.remove()
                    // Punto verde personalizado
                    val markerIcon = vectorToBitmapDescriptor(requireContext(), R.drawable.ic_marker_start)

                    origenMarker = googleMap.addMarker(
                        MarkerOptions()
                            .position(latLng)
                            .title("Mi ubicación")
                            .icon(markerIcon) // <-- Asignamos el icono aquí
                    )
                    googleMap.animateCamera(CameraUpdateFactory.newLatLngZoom(latLng, 16f))
                }
            }
        }
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.coordenadaDestino.collect { latLng ->
                    latLng ?: return@collect
                    if (!::googleMap.isInitialized) return@collect
                    destinoMarker?.remove()
                    // La bandera roja personalizada
                    val markerIcon = vectorToBitmapDescriptor(requireContext(), R.drawable.ic_marker_destination)

                    destinoMarker = googleMap.addMarker(
                        MarkerOptions()
                            .position(latLng)
                            .title("Destino")
                            .icon(markerIcon) // <-- Asignamos el icono aquí
                    )
                    googleMap.animateCamera(CameraUpdateFactory.newLatLngZoom(latLng, 16f))
                }
            }
        }
    }

    private fun configurarBotonesAccion() {
        ivClearText.setOnClickListener {
            etDestino.text.clear()
            etDestino.isEnabled = true
            rvSugerencias.visibility = View.GONE
            btnConfirmarUbicacion.visibility = View.GONE
            placesAdapter.submitList(emptyList())
        }

        btnConfirmarUbicacion.setOnClickListener {
            etDestino.isEnabled = false
            ivClearText.visibility = View.GONE
            btnConfirmarUbicacion.visibility = View.GONE
            btnCambiarDestino.visibility = View.VISIBLE

            viewModel.solicitarRutaSegura()
        }

        btnCambiarDestino.setOnClickListener {
            btnCambiarDestino.visibility = View.GONE
            etDestino.text.clear()
            etDestino.isEnabled = true
            ivClearText.visibility = View.GONE
            rvSugerencias.visibility = View.GONE
            placesAdapter.submitList(emptyList())

            destinoMarker?.remove()
            destinoMarker = null

            // T-10: Aseguramos que la ruta se borre al cambiar de destino
            clearRutaPolyline()

            viewModel.clearDestino()

            viewModel.coordenadaOrigen.value?.let { origen ->
                if (::googleMap.isInitialized) {
                    googleMap.animateCamera(CameraUpdateFactory.newLatLngZoom(origen, 16f))
                }
            }

            etDestino.requestFocus()
            val imm = requireContext().getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(etDestino, InputMethodManager.SHOW_IMPLICIT)
        }
    }

    private fun configurarBuscador() {
        placesAdapter = PlacesAdapter { prediction ->
            isProgrammaticChange = true
            rvSugerencias.visibility = View.GONE
            placesAdapter.submitList(emptyList())

            etDestino.setText(prediction.getPrimaryText(null).toString())
            etDestino.clearFocus()
            ocultarTeclado(etDestino)

            btnConfirmarUbicacion.visibility = View.VISIBLE
            obtenerCoordenadasDelLugar(prediction.placeId)

            isProgrammaticChange = false
        }
        rvSugerencias.layoutManager = LinearLayoutManager(requireContext())
        rvSugerencias.adapter = placesAdapter

        etDestino.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {}
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                if (isProgrammaticChange) return

                val query = s.toString()
                ivClearText.visibility = if (query.isNotEmpty() && etDestino.isEnabled) View.VISIBLE else View.GONE
                btnConfirmarUbicacion.visibility = View.GONE

                if (query.length > 2) {
                    buscarSugerencias(query)
                } else {
                    rvSugerencias.visibility = View.GONE
                    placesAdapter.submitList(emptyList())
                }
            }
        })
    }

    private fun buscarSugerencias(query: String) {
        val request = FindAutocompletePredictionsRequest.builder()
            .setQuery(query)
            .setCountry("EC")
            .setLocationRestriction(RectangularBounds.newInstance(Constants.PICHINCHA_BOUNDS))
            .build()

        placesClient.findAutocompletePredictions(request).addOnSuccessListener { response ->
            val predicciones = response.autocompletePredictions
            if (predicciones.isNotEmpty()) {
                rvSugerencias.visibility = View.VISIBLE
                placesAdapter.submitList(predicciones)
            } else {
                rvSugerencias.visibility = View.GONE
            }
        }.addOnFailureListener {
            rvSugerencias.visibility = View.GONE
        }
    }

    private fun obtenerCoordenadasDelLugar(placeId: String) {
        val placeFields = listOf(Place.Field.ID, Place.Field.NAME, Place.Field.LAT_LNG)
        val request = FetchPlaceRequest.builder(placeId, placeFields).build()

        placesClient.fetchPlace(request).addOnSuccessListener { response ->
            val place = response.place
            place.latLng?.let { destino ->
                viewModel.setDestino(destino)
            }
        }.addOnFailureListener {
            Toast.makeText(requireContext(), "No se pudo obtener la ubicación del lugar", Toast.LENGTH_SHORT).show()
        }
    }

    @SuppressLint("MissingPermission")
    private fun obtenerUbicacionActual() {
        googleMap.isMyLocationEnabled = true
        googleMap.uiSettings.isMyLocationButtonEnabled = false

        fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
            if (location != null) {
                val miUbicacion = LatLng(location.latitude, location.longitude)
                viewModel.setOrigen(miUbicacion)
            } else {
                Toast.makeText(
                    requireContext(),
                    "No se detectó tu ubicación. Activa el GPS e intenta de nuevo.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }.addOnFailureListener {
            Toast.makeText(requireContext(), "Error al obtener ubicación: ${it.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun solicitarPermisosUbicacion() {
        requestLocationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    private fun ocultarTeclado(view: View) {
        val imm = requireContext().getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(view.windowToken, 0)
    }

    private fun initPlaces() {
        if (!Places.isInitialized()) {
            val appInfo = requireContext().packageManager.getApplicationInfo(requireContext().packageName, PackageManager.GET_META_DATA)
            val apiKey = appInfo.metaData.getString("com.google.android.geo.API_KEY")
            if (apiKey != null) Places.initialize(requireContext(), apiKey)
        }
    }

    private fun observarCarga() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                // Escuchamos la variable isLoadingRoute que ya tenías en tu ViewModel
                viewModel.isLoadingRoute.collect { isLoading ->
                    if (isLoading) {
                        layoutLoading.visibility = View.VISIBLE
                        ocultarTeclado(requireView()) // Ocultamos teclado para que se vea bien
                    } else {
                        layoutLoading.visibility = View.GONE
                    }
                }
            }
        }
    }

    // T-11: Función para convertir un Vector Drawable en un BitmapDescriptor para el mapa
    private fun vectorToBitmapDescriptor(context: Context, @DrawableRes vectorResId: Int): BitmapDescriptor? {
        val vectorDrawable = ContextCompat.getDrawable(context, vectorResId) ?: return null
        vectorDrawable.setBounds(0, 0, vectorDrawable.intrinsicWidth, vectorDrawable.intrinsicHeight)

        // ¡Usamos createBitmap en lugar del constructor directo!
        val bitmap = createBitmap(vectorDrawable.intrinsicWidth, vectorDrawable.intrinsicHeight)
        val canvas = Canvas(bitmap)
        vectorDrawable.draw(canvas)

        return BitmapDescriptorFactory.fromBitmap(bitmap)
    }

    override fun onMapReady(map: GoogleMap) {
        googleMap = map
        googleMap.uiSettings.isZoomControlsEnabled = false
        googleMap.uiSettings.isCompassEnabled = true
        googleMap.moveCamera(CameraUpdateFactory.newLatLngZoom(viewModel.quitoLocation, viewModel.defaultZoom))

        solicitarPermisosUbicacion()
    }
}