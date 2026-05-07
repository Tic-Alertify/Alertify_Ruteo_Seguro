import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { CreateIncidentWebhookDto } from './dto/create-incident-webhook.dto';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('incidente')
  @HttpCode(HttpStatus.OK) // Devolvemos un 200 OK para que el otro backend sepa que lo recibimos bien
  async recibirIncidente(@Body() dto: CreateIncidentWebhookDto) {
    return await this.webhookService.registrarYPenalizar(dto);
  }
}