import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateIncidentWebhookDto } from './dto/create-incident-webhook.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  // Inyectamos la conexión directa a la base de datos
  constructor(private dataSource: DataSource) {}

  async registrarYPenalizar(dto: CreateIncidentWebhookDto) {
    try {
      this.logger.log(`Recibiendo alerta del incidente ID: ${dto.id_incidente}...`);

      // Ejecutamos el Stored Procedure pasándole los parámetros exactos
      await this.dataSource.query(
        `EXEC dbo.SP_Registrar_Y_Penalizar_Incidente @id_incidente=@0, @latitud=@1, @longitud=@2, @nivel_gravedad=@3, @tipo=@4`,
        [
          dto.id_incidente,
          dto.latitud,
          dto.longitud,
          dto.nivel_gravedad,
          dto.tipo,
        ],
      );

      this.logger.log(`¡Éxito! Incidente ${dto.id_incidente} guardado y calle penalizada.`);
      return { success: true, message: 'Incidente procesado y arista actualizada.' };
      
    } catch (error) {
      this.logger.error(`Error al procesar el webhook del incidente ${dto.id_incidente}:`, error);
      throw new InternalServerErrorException('Error al ejecutar el Stored Procedure en Ruteo Seguro');
    }
  }
}