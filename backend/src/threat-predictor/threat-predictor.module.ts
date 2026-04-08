// src/threat-predictor/threat-predictor.module.ts
import { Module } from '@nestjs/common';
import { ThreatPredictorService } from './threat-predictor.service';
import { ThreatPredictorController } from './threat-predictor.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from '../article/article.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Article.name, schema: ArticleSchema }]),
  ],
  providers: [ThreatPredictorService],
  controllers: [ThreatPredictorController],
})
export class ThreatPredictorModule {}
