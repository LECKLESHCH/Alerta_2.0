import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ArticleModule } from './article/article.module';
import { AuthModule } from './auth/auth.module';
import { CrawlerModule } from './crawler/crawler.module';
import { ThreatPredictorModule } from './threat-predictor/threat-predictor.module';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '.env'),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ??
          configService.get<string>('MONGO_URI') ??
          'mongodb://127.0.0.1:27017/alerta',
      }),
    }),
    AuthModule,
    ArticleModule,
    CrawlerModule,
    ThreatPredictorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
