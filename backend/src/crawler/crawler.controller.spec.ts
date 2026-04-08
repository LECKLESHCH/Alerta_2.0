import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CrawlerController } from './crawler.controller';
import { CrawlerService } from './crawler.service';

describe('CrawlerController', () => {
  let controller: CrawlerController;
  const crawlerService = {
    startCrawlAllSources: jest.fn(),
    isCrawlRunning: jest.fn(),
    getSourceCount: jest.fn(),
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

    await expect(controller.crawlAllSources()).resolves.toEqual({
      status: 'started',
      running: true,
    });
  });

  it('should expose crawler status', () => {
    crawlerService.isCrawlRunning.mockReturnValue(false);
    crawlerService.getSourceCount.mockReturnValue(12);

    expect(controller.getStatus()).toEqual({
      running: false,
      sources: 12,
    });
  });

  it('should reject missing article params', async () => {
    await expect(controller.crawlArticle('', '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
