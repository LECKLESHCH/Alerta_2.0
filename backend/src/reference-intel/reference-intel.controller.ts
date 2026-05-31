import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReferenceIntelService } from './reference-intel.service';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`Invalid positive integer: ${value}`);
  }
  return parsed;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  throw new BadRequestException(`Invalid boolean flag: ${value}`);
}

@UseGuards(JwtAuthGuard)
@Controller('reference-intel')
export class ReferenceIntelController {
  constructor(private readonly referenceIntelService: ReferenceIntelService) {}

  @Get('cves')
  async listCves(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('q') q?: string,
    @Query('hasKev') hasKevRaw?: string,
  ) {
    const page = parsePositiveInt(pageRaw, 1);
    const limit = Math.min(parsePositiveInt(limitRaw, 50), 200);
    const hasKev = parseOptionalBoolean(hasKevRaw);

    return this.referenceIntelService.listCves({
      page,
      limit,
      q,
      hasKev,
    });
  }
}
