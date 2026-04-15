// backend/src/crawler/crawler.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '../article/article.schema';
import { CrawlerService } from './crawler.service';
import { CrawlerController } from './crawler.controller';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ReferenceIntelModule } from '../reference-intel/reference-intel.module';

@Module({
  imports: [
    AuthModule,
    ReferenceIntelModule,
    MongooseModule.forFeature([{ name: Article.name, schema: ArticleSchema }]),
    ConfigModule,
  ],
  providers: [CrawlerService],
  controllers: [CrawlerController],
  exports: [CrawlerService],
})
export class CrawlerModule {}
