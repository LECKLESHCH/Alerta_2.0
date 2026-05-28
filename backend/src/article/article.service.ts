import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Article } from './article.schema';
import { RedisCacheService } from '../cache/redis-cache.service';

export interface ArticleListQuery {
  page: number;
  limit: number;
  type?: string;
  severity?: string;
  category?: string;
  source?: string;
  includeText: boolean;
}

export interface ArticleListResult {
  items: Partial<Article>[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ArticleService {
  private readonly extraArticleCollections = ['articles_tg', 'articles_forum'];

  constructor(
    @InjectModel(Article.name) private articleModel: Model<Article>,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async findAll(query: ArticleListQuery): Promise<ArticleListResult> {
    const cacheKey = this.getListCacheKey(query);
    const cached = await this.redisCacheService.get<ArticleListResult>(cacheKey);
    if (cached) return cached;

    const filter: Record<string, string> = {};

    if (query.type) filter.type = query.type;
    if (query.severity) filter.severity = query.severity;
    if (query.category) filter.category = query.category;
    if (query.source) filter.source = query.source;

    const skip = (query.page - 1) * query.limit;

    const basePipeline: Record<string, unknown>[] = [
      { $match: filter },
      { $addFields: { dbCollection: 'articles' } },
    ];

    for (const collectionName of this.extraArticleCollections) {
      basePipeline.push({
        $unionWith: {
          coll: collectionName,
          pipeline: [
            { $match: filter },
            { $addFields: { dbCollection: collectionName } },
          ],
        },
      });
    }

    const itemsPipeline = [...basePipeline];
    if (!query.includeText) {
      itemsPipeline.push({ $project: { text: 0 } });
    }
    itemsPipeline.push(
      { $sort: { publishedAt: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: query.limit },
    );

    const totalPipeline = [...basePipeline, { $count: 'total' }];

    const [items, totalResult] = await Promise.all([
      this.articleModel.aggregate(itemsPipeline).exec(),
      this.articleModel.aggregate(totalPipeline).exec(),
    ]);
    const total =
      Array.isArray(totalResult) && totalResult[0]?.total
        ? Number(totalResult[0].total)
        : 0;

    const result: ArticleListResult = {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
    await this.redisCacheService.set(cacheKey, result);
    return result;
  }

  private getListCacheKey(query: ArticleListQuery): string {
    return [
      'articles:list',
      `page=${query.page}`,
      `limit=${query.limit}`,
      `type=${query.type ?? ''}`,
      `severity=${query.severity ?? ''}`,
      `category=${query.category ?? ''}`,
      `source=${query.source ?? ''}`,
      `includeText=${query.includeText}`,
    ].join('|');
  }
}
