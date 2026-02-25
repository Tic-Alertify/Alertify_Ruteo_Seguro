package com.erickballas.ruteoseguro.utils

import com.google.android.gms.maps.model.LatLng

object GeoUtils {

    /**
     * Verifica si un punto está dentro de un polígono usando el algoritmo Ray-Casting.
     * Lanza un rayo horizontal desde el punto hacia la derecha y cuenta cuántos
     * lados del polígono cruza. Impar = dentro, par = fuera.
     *
     * @param punto  Coordenada a validar
     * @param poligono Lista de vértices del polígono en orden (abierto — no repetir el primero al final)
     * @return true si el punto está dentro del polígono
     */
    fun estaDentroDelPoligono(punto: LatLng, poligono: List<LatLng>): Boolean {
        val lat = punto.latitude
        val lng = punto.longitude
        var dentroDelPoligono = false

        var i = 0
        var j = poligono.size - 1

        while (i < poligono.size) {
            val latI = poligono[i].latitude
            val lngI = poligono[i].longitude
            val latJ = poligono[j].latitude
            val lngJ = poligono[j].longitude

            // Condición del rayo: el segmento [j→i] cruza horizontalmente el nivel 'lat'
            val cruzaLatitud = (latI > lat) != (latJ > lat)
            // X donde el segmento cruza el nivel 'lat' (interpolación lineal)
            val xInterseccion = (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI

            if (cruzaLatitud && lng < xInterseccion) {
                dentroDelPoligono = !dentroDelPoligono
            }

            j = i++
        }

        return dentroDelPoligono
    }
}
