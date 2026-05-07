import { IsInt, IsNumber, IsString, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateIncidentWebhookDto {
  @IsInt()
  @IsNotEmpty()
  id_incidente: number; // Debe ser INT para coincidir con tu base de datos

  @IsNumber()
  @IsNotEmpty()
  latitud: number;

  @IsNumber()
  @IsNotEmpty()
  longitud: number;

  @IsInt()
  @Min(1)
  @Max(5)
  nivel_gravedad: number; // Supongamos que va del 1 al 5

  @IsString()
  @IsNotEmpty()
  tipo: string;
}