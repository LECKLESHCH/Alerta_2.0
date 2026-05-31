import { BadRequestException, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModelThreatService } from './model-threat.service';
import { ThreatSourceType } from './threat-controls';

function normalizeSource(value: string): ThreatSourceType {
  if (value === 'web' || value === 'tg' || value === 'forum') return value;
  throw new BadRequestException('source must be one of: web, tg, forum');
}

@UseGuards(JwtAuthGuard)
@Controller('model-threats')
export class ModelThreatController {
  constructor(private readonly modelThreatService: ModelThreatService) {}

  @Get(':source')
  async list(@Param('source') source: string) {
    return this.modelThreatService.list(normalizeSource(source));
  }

  @Post('clear/:source')
  async clearSource(@Param('source') source: string) {
    return this.modelThreatService.clearSource(normalizeSource(source));
  }

  @Post('clear-all')
  async clearAll() {
    return this.modelThreatService.clearAll();
  }

  @Post('rebuild/:source')
  async rebuildSource(
    @Param('source') source: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit);
    return this.modelThreatService.rebuildSource(
      normalizeSource(source),
      Number.isFinite(parsedLimit) ? parsedLimit : 150,
    );
  }

  @Post('rebuild-all')
  async rebuildAll(
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit);
    return this.modelThreatService.rebuildAll(Number.isFinite(parsedLimit) ? parsedLimit : 150);
  }
}
