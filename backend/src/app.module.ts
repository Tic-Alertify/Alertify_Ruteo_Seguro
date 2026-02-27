import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Nodo } from './modules/ruteo/infrastructure/entities/nodo.entity';
import { Arista } from './modules/ruteo/infrastructure/entities/arista.entity';
import { Incidente } from './modules/ruteo/infrastructure/entities/incidente.entity';

import { RuteoModule } from './modules/ruteo/ruteo.module';
import { databaseConfig, appConfig } from './config/env.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mssql',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [Nodo, Arista, Incidente],
        synchronize: configService.get<boolean>('database.synchronize'),
        options: {
          encrypt: true,
          trustServerCertificate: false,
          enableArithAbort: true,
        },
        logging: true,
      }),
    }),

    RuteoModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}