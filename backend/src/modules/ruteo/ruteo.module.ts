import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nodo } from './infrastructure/entities/nodo.entity';
import { Arista } from './infrastructure/entities/arista.entity';
import { Incidente } from './infrastructure/entities/incidente.entity';
import { RuteoController } from './presentation/ruteo.controller';
import { RuteoService } from './application/ruteo.service';
import { NodoRepository } from './infrastructure/repositories/nodo.repository';
import { AristaRepository } from './infrastructure/repositories/arista.repository';
import { MotorAlgoritmoService } from './application/motor-algoritmo.service';
import { IncidenteCleanupService } from './application/incidente-cleanup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Nodo, Arista, Incidente]),
  ],
  controllers: [RuteoController],
  providers: [
    RuteoService,
    NodoRepository,
    AristaRepository,
    MotorAlgoritmoService,
    IncidenteCleanupService,
  ],
})
export class RuteoModule {}