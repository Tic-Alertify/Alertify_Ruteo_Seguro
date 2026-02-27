import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalcularRutaDto {
  @ApiProperty({ example: -0.2099, description: 'Latitud del punto de origen (GPS)' })
  @IsNotEmpty({ message: 'La latitud de origen es obligatoria' })
  @IsNumber({}, { message: 'origenLat debe ser un número' })
  @Min(-90)
  @Max(90)
  origenLat: number;

  @ApiProperty({ example: -78.4849, description: 'Longitud del punto de origen (GPS)' })
  @IsNotEmpty({ message: 'La longitud de origen es obligatoria' })
  @IsNumber({}, { message: 'origenLng debe ser un número' })
  @Min(-180)
  @Max(180)
  origenLng: number;

  @ApiProperty({ example: -0.1807, description: 'Latitud del punto de destino (GPS)' })
  @IsNotEmpty({ message: 'La latitud de destino es obligatoria' })
  @IsNumber({}, { message: 'destinoLat debe ser un número' })
  @Min(-90)
  @Max(90)
  destinoLat: number;

  @ApiProperty({ example: -78.4678, description: 'Longitud del punto de destino (GPS)' })
  @IsNotEmpty({ message: 'La longitud de destino es obligatoria' })
  @IsNumber({}, { message: 'destinoLng debe ser un número' })
  @Min(-180)
  @Max(180)
  destinoLng: number;
}