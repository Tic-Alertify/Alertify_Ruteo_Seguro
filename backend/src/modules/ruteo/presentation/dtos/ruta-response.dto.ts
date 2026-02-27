import { ApiProperty } from '@nestjs/swagger';

/**
 * Respuesta del endpoint POST /ruteo/calcular.
 * Los campos están sincronizados con RuteoResponse.kt del frontend Android.
 */
export class RutaResponseDto {
  @ApiProperty({ example: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', description: 'Polilínea codificada en formato Google Encoded Polyline' })
  rutaGeometria: string;

  @ApiProperty({ example: '12 min', description: 'Tiempo estimado de viaje' })
  tiempoEstimado: string;

  @ApiProperty({ example: 'Bajo', enum: ['Bajo', 'Medio', 'Alto'], description: 'Nivel de riesgo de la ruta' })
  nivelRiesgo: string;

  @ApiProperty({ example: 3400.5, description: 'Distancia total en metros' })
  distanciaMetros: number;
}
