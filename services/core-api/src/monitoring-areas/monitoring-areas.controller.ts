import { Controller, Get, Post, Body } from '@nestjs/common';
import { MonitoringAreasService } from './monitoring-areas.service';

class CreateAreaDto {
  name: string;
  description: string;
  geojson: any;
}

@Controller('api/v1/monitoring-areas')
export class MonitoringAreasController {
  constructor(private readonly areasService: MonitoringAreasService) {}

  @Get()
  async list() {
    return this.areasService.listAreas();
  }

  @Post()
  async create(@Body() dto: CreateAreaDto) {
    return this.areasService.createArea(dto.name, dto.description, dto.geojson);
  }
}
