import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CrawlerController } from './crawler.controller';
import { CrawlerService } from './crawler.service';

describe('CrawlerController', () => {
  let controller: CrawlerController;
  const crawlerService = {
    startCrawlAllSources: jest.fn(),
    startSiteCrawl: jest.fn(),
    isCrawlRunning: jest.fn(),
    getSourceCount: jest.fn(),
    getActiveCrawlScope: jest.fn(),
    getRecentLogs: jest.fn(),
    parseAndSave: jest.fn(),
  };

  beforeEach(async () => {
    Object.values(crawlerService).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        fn.mockReset();
      }
    });

    const moduleBuilder = Test.createTestingModule({
      controllers: [CrawlerController],
      providers: [
        {
          provide: CrawlerService,
          useValue: crawlerService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<CrawlerController>(CrawlerController);
  });

  it('should start crawl asynchronously', async () => {
    crawlerService.startCrawlAllSources.mockReturnValue(true);
    crawlerService.isCrawlRunning.mockReturnValue(true);
    crawlerService.getActiveCrawlScope.mockReturnValue('all');

    await expect(controller.crawlAllSources()).resolves.toEqual({
      status: 'started',
      running: true,
      scope: 'all',
    });
  });

  it('should start sites crawl asynchronously', async () => {
    crawlerService.startSiteCrawl.mockReturnValue(true);
    crawlerService.isCrawlRunning.mockReturnValue(true);
    crawlerService.getActiveCrawlScope.mockReturnValue('sites');

    await expect(controller.crawlSites()).resolves.toEqual({
      status: 'started',
      running: true,
      scope: 'sites',
    });
  });

  it('should expose crawler status', () => {
    crawlerService.isCrawlRunning.mockReturnValue(false);
    crawlerService.getSourceCount.mockReturnValue(12);
    crawlerService.getActiveCrawlScope.mockReturnValue(null);

    expect(controller.getStatus()).toEqual({
      running: false,
      sources: 12,
      scope: null,
    });
  });

  it('should expose crawler logs', () => {
    crawlerService.isCrawlRunning.mockReturnValue(true);
    crawlerService.getActiveCrawlScope.mockReturnValue('sites');
    crawlerService.getRecentLogs.mockReturnValue({
      lines: ['line-1', 'line-2'],
      source: '/tmp/backend.log',
    });

    expect(controller.getLogs('50')).toEqual({
      running: true,
      scope: 'sites',
      lines: ['line-1', 'line-2'],
      source: '/tmp/backend.log',
    });
  });

  it('should reject missing article params', async () => {
    await expect(controller.crawlArticle('', '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
