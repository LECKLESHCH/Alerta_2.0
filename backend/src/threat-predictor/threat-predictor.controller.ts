// src/threat-predictor/threat-predictor.controller.ts

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ThreatPredictorService } from './threat-predictor.service';

@UseGuards(JwtAuthGuard)
@Controller('threat-predictor')
export class ThreatPredictorController {
  constructor(private readonly predictorService: ThreatPredictorService) {}

  @Get('predict/:articleId')
  async predict(@Param('articleId') articleId: string) {
    try {
      const prediction = await this.predictorService.predict(articleId);
      return prediction;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }
}
