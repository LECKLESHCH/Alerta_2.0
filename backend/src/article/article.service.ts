import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Article } from './article.schema';

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
  constructor(
    @InjectModel(Article.name) private articleModel: Model<Article>,
  ) {}

  async findAll(query: ArticleListQuery): Promise<ArticleListResult> {
    const filter: Record<string, string> = {};

    if (query.type) filter.type = query.type;
    if (query.severity) filter.severity = query.severity;
    if (query.category) filter.category = query.category;
    if (query.source) filter.source = query.source;

    const projection = query.includeText ? {} : { text: 0 };
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.articleModel
        .find(filter, projection)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.articleModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }
}
