import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class IncidenteCleanupService {
  private readonly logger = new Logger(IncidenteCleanupService.name);

  constructor(private dataSource: DataSource) {}

  // @Cron(CronExpression.EVERY_HOUR) //  Usar este en producción (Cada hora)
  @Cron(CronExpression.EVERY_HOUR) //  Usar este para pruebas (Cada 10 min)
  async limpiarIncidentesExpirados() {
    this.logger.log('Iniciando tarea automática de limpieza de incidentes...');
    
    try {
      // Ejecutamos el Stored Procedure que acabamos de crear en Azure SQL
      await this.dataSource.query(`EXEC dbo.SP_Limpiar_Incidentes_Expirados @horas_caducidad=2`);
      
      this.logger.log('Limpieza completada con éxito. Base de datos optimizada.');
    } catch (error) {
      this.logger.error('Error al ejecutar la limpieza automática:', error);
    }
  }
}