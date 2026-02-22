import { Controller } from '@nestjs/common';
import { RuteoService } from '../application/ruteo.service';

@Controller('ruteo')
export class RuteoController {
  constructor(private readonly ruteoService: RuteoService) {}
}