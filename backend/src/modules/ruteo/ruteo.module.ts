import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nodo } from './infrastructure/entities/nodo.entity';
import { Arista } from './infrastructure/entities/arista.entity';
import { Incidente } from './infrastructure/entities/incidente.entity';
import { RuteoController } from './presentation/ruteo.controller';
import { RuteoService } from './application/ruteo.service';

@Module({
  imports: [
    // Registra las entidades para que este módulo las pueda usar
    TypeOrmModule.forFeature([Nodo, Arista, Incidente]),
  ],
  controllers: [RuteoController], 
  providers: [RuteoService],      
})
export class RuteoModule {}