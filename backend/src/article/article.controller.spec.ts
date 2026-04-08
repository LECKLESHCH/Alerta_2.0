import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';

describe('ArticleController', () => {
  let controller: ArticleController;
  const articleService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    articleService.findAll.mockReset();

    const moduleBuilder = Test.createTestingModule({
      controllers: [ArticleController],
      providers: [
        {
          provide: ArticleService,
          useValue: articleService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<ArticleController>(ArticleController);
  });

  it('should pass normalized pagination query to service', async () => {
    articleService.findAll.mockResolvedValue({
      items: [],
      meta: { page: 2, limit: 25, total: 0, totalPages: 0 },
    });

    await controller.findAll('2', '25', 'threat', 'high', 'APT', 'Manual', '1');

    expect(articleService.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 25,
      includeText: true,
      type: 'threat',
      severity: 'high',
      category: 'APT',
      source: 'Manual',
    });
  });

  it('should reject invalid page', async () => {
    await expect(
      controller.findAll('0', '25', undefined, undefined, undefined, undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
