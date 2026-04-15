import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateObjectPayload, ObjectService } from './object.service';

function normalizeScore(value: unknown, field: string): number {
  const normalized =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    throw new BadRequestException(
      `${field} must be a number in the range from 0 to 1`,
    );
  }

  return normalized;
}

@UseGuards(JwtAuthGuard)
@Controller('objects')
export class ObjectController {
  constructor(private readonly objectService: ObjectService) {}

  @Get()
  async findAll() {
    return this.objectService.findAll();
  }

  @Post()
  async create(@Body() body: CreateObjectPayload) {
    if (!body.objectName?.trim()) {
      throw new BadRequestException('objectName is required');
    }

    if (!body.objectType?.trim()) {
      throw new BadRequestException('objectType is required');
    }

    if (!body.criticalityClass?.trim()) {
      throw new BadRequestException('criticalityClass is required');
    }

    if (!body.industry?.trim()) {
      throw new BadRequestException('industry is required');
    }

    if (!body.securityMaturity?.trim()) {
      throw new BadRequestException('securityMaturity is required');
    }

    if (!body.monitoringMaturity?.trim()) {
      throw new BadRequestException('monitoringMaturity is required');
    }

    if (!body.patchMaturity?.trim()) {
      throw new BadRequestException('patchMaturity is required');
    }

    return this.objectService.create({
      ...body,
      businessCriticality: normalizeScore(
        body.businessCriticality,
        'businessCriticality',
      ),
      impactConfidentiality: normalizeScore(
        body.impactConfidentiality,
        'impactConfidentiality',
      ),
      impactIntegrity: normalizeScore(body.impactIntegrity, 'impactIntegrity'),
      impactAvailability: normalizeScore(
        body.impactAvailability,
        'impactAvailability',
      ),
      attackSurface: normalizeScore(body.attackSurface, 'attackSurface'),
      remoteAccessLevel: normalizeScore(
        body.remoteAccessLevel,
        'remoteAccessLevel',
      ),
      segmentationLevel: normalizeScore(
        body.segmentationLevel,
        'segmentationLevel',
      ),
      legacyShare: normalizeScore(body.legacyShare, 'legacyShare'),
      cloudPresence: normalizeScore(body.cloudPresence, 'cloudPresence'),
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const removed = await this.objectService.removeById(id);

    if (!removed) {
      throw new NotFoundException('Object model not found');
    }

    return {
      deleted: true,
      id,
    };
  }
}
