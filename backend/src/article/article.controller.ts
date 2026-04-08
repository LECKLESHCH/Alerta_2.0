import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ArticleListQuery, ArticleService } from './article.service';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`Invalid positive integer: ${value}`);
  }
  return parsed;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  throw new BadRequestException(`Invalid boolean flag: ${value}`);
}

@UseGuards(JwtAuthGuard)
@Controller('articles')
export class ArticleController {
  private readonly logger = new Logger(ArticleController.name);

  constructor(private readonly articleService: ArticleService) {}

  @Get()
  async findAll(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('category') category?: string,
    @Query('source') source?: string,
    @Query('includeText') includeTextRaw?: string,
  ) {
    const page = parsePositiveInt(pageRaw, 1);
    const limit = Math.min(parsePositiveInt(limitRaw, 50), 200);
    const includeText = parseBooleanFlag(includeTextRaw, false);

    const query: ArticleListQuery = {
      page,
      limit,
      includeText,
      type,
      severity,
      category,
      source,
    };

    this.logger.log(
      `Fetching articles page=${page} limit=${limit} type=${type ?? '-'} severity=${severity ?? '-'} category=${category ?? '-'} source=${source ?? '-'} includeText=${includeText}`,
    );

    return this.articleService.findAll(query);
  }
}
