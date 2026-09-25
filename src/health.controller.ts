import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async ready() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', checks: { database: 'up' } };
  }

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness() {
    return this.ready();
  }
}
