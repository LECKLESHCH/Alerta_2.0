import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CrawlerService } from './crawler.service';

@UseGuards(JwtAuthGuard)
@Controller('crawl')
export class CrawlerController {
  private readonly logger = new Logger(CrawlerController.name);

  constructor(private crawlerService: CrawlerService) {}

  @Get('all')
  @HttpCode(HttpStatus.ACCEPTED)
  async crawlAllSources() {
    const started = this.crawlerService.startCrawlAllSources();
    const status = started ? 'started' : 'already_running';
    this.logger.log(`Full crawl request received: ${status}`);
    return {
      status,
      running: this.crawlerService.isCrawlRunning(),
    };
  }

  @Get('status')
  getStatus() {
    return {
      running: this.crawlerService.isCrawlRunning(),
      sources: this.crawlerService.getSourceCount(),
    };
  }

  @Get('article')
  async crawlArticle(
    @Query('url') url: string,
    @Query('source') source: string,
  ) {
    if (!url || !source) {
      throw new BadRequestException('url и source обязательны');
    }
    this.logger.log(`Parsing single article: ${url}`);
    const article = await this.crawlerService.parseAndSave(url, source);
    if (!article) {
      throw new BadRequestException('Статья не найдена или пустая');
    }
    return article;
  }
}
