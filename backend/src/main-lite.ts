import { NestFactory } from '@nestjs/core';
import { AppLiteModule } from './app-lite.module';

async function bootstrap() {
  const app = await NestFactory.create(AppLiteModule);
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
