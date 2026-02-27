import { registerAs } from '@nestjs/config';

/**
 * Configuración tipada de variables de entorno.
 * Si una variable requerida está ausente, la aplicación falla al arrancar
 * con un mensaje claro en lugar de un error críptico en tiempo de ejecución.
 */

export const databaseConfig = registerAs('database', () => {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Variable de entorno requerida no definida: ${key}`);
    }
  }

  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '1433', 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
  };
});

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
}));
