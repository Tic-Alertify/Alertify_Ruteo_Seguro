package com.erickballas.ruteoseguro.ui.map

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
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
import kotlinx.coroutines.launch

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
    private lateinit var rvSugerencias: RecyclerView
    private lateinit var placesAdapter: PlacesAdapter

    // Bandera para evitar llamadas cíclicas al TextWatcher
    private var isProgrammaticChange = false

    // Marcadores de origen y destino en el mapa
    private var origenMarker: Marker? = null
    private var destinoMarker: Marker? = null

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
        rvSugerencias = view.findViewById(R.id.rv_sugerencias)

        val mapFragment = childFragmentManager.findFragmentById(R.id.google_map) as SupportMapFragment?
        mapFragment?.getMapAsync(this)

        configurarBotonesAccion()
        configurarBuscador()
        observarErrores()
        observarCoordenadas()
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

    /**
     * T-03 + T-04: Observa los StateFlow de coordenadas VALIDADAS del ViewModel.
     * La cámara y los marcadores solo se actualizan si el ViewModel aceptó la coordenada,
     * lo que garantiza que nunca se muestre un punto fuera de Pichincha en el mapa.
     */
    private fun observarCoordenadas() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.coordenadaOrigen.collect { latLng ->
                    latLng ?: return@collect
                    if (!::googleMap.isInitialized) return@collect
                    origenMarker?.remove()
                    origenMarker = googleMap.addMarker(
                        MarkerOptions()
                            .position(latLng)
                            .title("Mi ubicación")
                            .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_AZURE))
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
                    destinoMarker = googleMap.addMarker(
                        MarkerOptions()
                            .position(latLng)
                            .title("Destino")
                            .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED))
                    )
                    googleMap.animateCamera(CameraUpdateFactory.newLatLngZoom(latLng, 16f))
                }
            }
        }
    }

    private fun configurarBotonesAccion() {
        // Lógica de la "X"
        ivClearText.setOnClickListener {
            etDestino.text.clear()
            etDestino.isEnabled = true
            rvSugerencias.visibility = View.GONE
            btnConfirmarUbicacion.visibility = View.GONE
            placesAdapter.submitList(emptyList())
        }

        // Lógica de Confirmar Ubicación
        btnConfirmarUbicacion.setOnClickListener {
            etDestino.isEnabled = false
            ivClearText.visibility = View.GONE
            btnConfirmarUbicacion.visibility = View.GONE

            // Enviar la orden al ViewModel para llamar al backend (NestJS)
            viewModel.solicitarRutaSegura()
        }
    }

    private fun configurarBuscador() {
        placesAdapter = PlacesAdapter { prediction ->
            // Activamos bandera para evitar recargar búsquedas
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
        // T-02: Restricción geográfica a Pichincha para sugerencias más relevantes
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
                // T-04: setDestino valida que esté dentro de Pichincha.
                // Si acepta, observarCoordenadas() colocará el marcador y moverá la cámara.
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
                // T-04: setOrigen valida que esté dentro de Pichincha.
                // Si acepta, observarCoordenadas() colocará el marcador y moverá la cámara.
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

    override fun onMapReady(map: GoogleMap) {
        googleMap = map
        googleMap.uiSettings.isZoomControlsEnabled = false
        googleMap.uiSettings.isCompassEnabled = true
        googleMap.moveCamera(CameraUpdateFactory.newLatLngZoom(viewModel.quitoLocation, viewModel.defaultZoom))

        // Solicitamos permiso al usuario en cuanto el mapa esté listo
        solicitarPermisosUbicacion()
    }
}