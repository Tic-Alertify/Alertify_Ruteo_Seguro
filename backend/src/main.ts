import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');

  // Validación global con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger UI
  const config = new DocumentBuilder()
    .setTitle('Módulo Ruteo Seguro — API')
    .setDescription(
      'API REST del sistema de ruteo seguro para Quito. ' +
      'Permite calcular rutas óptimas ponderadas por nivel de riesgo ' +
      'y consultar incidentes activos.',
    )
    .setVersion('1.0')
    .addTag('Ruteo', 'Cálculo de rutas e incidentes')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000, '0.0.0.0');
  console.log(`Application is running on: http://localhost:3000`);
  console.log(`Swagger UI disponible en:  http://localhost:3000/api`);
}
bootstrap();
