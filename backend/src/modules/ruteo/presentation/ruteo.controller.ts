import {Controller, Post, Get, Body, HttpCode, HttpStatus,} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RuteoService } from '../application/ruteo.service';
import { CalcularRutaDto } from './dtos/calcular-ruta.dto';
import { RutaResponseDto } from './dtos/ruta-response.dto';
import { IncidenteResponseDto } from './dtos/incidente-response.dto';

@ApiTags('ruteo')
@Controller('ruteo')
export class RuteoController {
  constructor(private readonly ruteoService: RuteoService) {}

  @Post('calcular')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calcular ruta segura',
    description: 'Recibe coordenadas GPS de origen y destino. Devuelve la ruta óptima ponderada por nivel de riesgo.',
  })
  @ApiBody({ type: CalcularRutaDto })
  @ApiResponse({ status: 200, description: 'Ruta calculada exitosamente', type: RutaResponseDto })
  @ApiResponse({ status: 400, description: 'Coordenadas inválidas o fuera de rango' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async calcularRuta(@Body() dto: CalcularRutaDto): Promise<RutaResponseDto> {
    return this.ruteoService.calcularRuta(dto);
  }

  @Get('incidentes')
  @ApiOperation({
    summary: 'Obtener incidentes activos',
    description: 'Devuelve los incidentes de las últimas 24h para superponer en el mapa.',
  })
  @ApiResponse({ status: 200, description: 'Lista de incidentes activos', type: [IncidenteResponseDto] })
  async obtenerIncidentes(): Promise<IncidenteResponseDto[]> {
    return this.ruteoService.obtenerIncidentesActivos();
  }
}