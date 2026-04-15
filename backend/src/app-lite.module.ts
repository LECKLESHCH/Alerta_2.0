import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ArticleModule } from './article/article.module';
import { ObjectModule } from './objects/object.module';
import { ReferenceIntelModule } from './reference-intel/reference-intel.module';

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
    ObjectModule,
    ReferenceIntelModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppLiteModule {}
