import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Nodo } from './modules/ruteo/infrastructure/entities/nodo.entity';
import { Arista } from './modules/ruteo/infrastructure/entities/arista.entity';
import { Incidente } from './modules/ruteo/infrastructure/entities/incidente.entity';

import { RuteoModule } from './modules/ruteo/ruteo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mssql',
        host: configService.get<string>('DB_HOST'),
        port: +configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [Nodo, Arista, Incidente],
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
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