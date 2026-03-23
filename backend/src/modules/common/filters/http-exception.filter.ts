import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  error: string;
  mensaje: string;
  path: string;
  timestamp: string;
}

/**
 * Filtro global de excepciones.
 *
 * Captura TODOS los errores no manejados y devuelve un JSON consistente
 * que el frontend Android puede interpretar de forma uniforme.
 *
 * Casos cubiertos:
 *  - HttpException (400, 404, 422…) → usa el status y mensaje de la excepción
 *  - Error genérico / errores de BD    → 500 con mensaje genérico (el detalle queda en logs)
 *  - NotFoundException del A*          → 404 con mensaje descriptivo
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let mensaje: string;
    let error: string;

    if (excepcion instanceof HttpException) {
      statusCode = excepcion.getStatus();
      const respuestaHttp = excepcion.getResponse();

      // NestJS puede devolver string o { message: string | string[] }
      if (typeof respuestaHttp === 'string') {
        mensaje = respuestaHttp;
      } else if (typeof respuestaHttp === 'object' && respuestaHttp !== null) {
        const obj = respuestaHttp as Record<string, unknown>;
        const msg = obj['message'];
        mensaje = Array.isArray(msg) ? msg.join('; ') : String(msg ?? excepcion.message);
      } else {
        mensaje = excepcion.message;
      }

      error = excepcion.name;
    } else {
      // Error de infraestructura (BD, conexión, error inesperado)
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      mensaje = 'Error interno del servidor. Por favor intente más tarde.';
      error = 'InternalServerError';

      // Logueamos el error real solo en el servidor, no lo exponemos al cliente
      this.logger.error(
        `Error no controlado en ${request.method} ${request.url}`,
        excepcion instanceof Error ? excepcion.stack : String(excepcion),
      );
    }

    // Para errores HTTP también logueamos (nivel warn si ≥500, debug si <500)
    if (excepcion instanceof HttpException) {
      const logMsg = `${statusCode} ${request.method} ${request.url} — ${mensaje}`;
      statusCode >= 500 ? this.logger.warn(logMsg) : this.logger.debug(logMsg);
    }

    const cuerpo: ErrorResponse = {
      statusCode,
      error,
      mensaje,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(cuerpo);
  }
}
