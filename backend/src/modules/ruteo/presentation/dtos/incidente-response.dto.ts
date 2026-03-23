import { ApiProperty } from '@nestjs/swagger';

/**
 * Respuesta del endpoint GET /ruteo/incidentes.
 * Representa un incidente activo para superponer en el mapa Android.
 */
export class IncidenteResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: -0.2099, description: 'Latitud del incidente' })
  lat: number;

  @ApiProperty({ example: -78.4849, description: 'Longitud del incidente' })
  lng: number;

  @ApiProperty({ example: 'Robo', description: 'Tipo de incidente', enum: ['Robo', 'Accidente', 'Zona peligrosa'] })
  tipo: string;

  @ApiProperty({ example: 2, description: '1 = leve, 2 = moderado, 3 = grave' })
  nivelGravedad: number;

  @ApiProperty({ example: '2026-02-26T21:00:00.000Z' })
  fechaReporte: Date;
}
