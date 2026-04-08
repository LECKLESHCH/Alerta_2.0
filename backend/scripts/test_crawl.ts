// test-crawl.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CrawlerService } from '../src/crawler/crawler.service';


async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const crawlerService = app.get(CrawlerService);

  try {
    const urlsRaw = process.env.CRAWL_URLS;
    const url = process.env.CRAWL_URL;
    const source = process.env.CRAWL_SOURCE ?? 'Manual Crawl';

    if (urlsRaw) {
      const urls = urlsRaw
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      console.log('--- START MULTI ARTICLE ---');
      console.log(`COUNT: ${urls.length}`);
      console.log(`SOURCE: ${source}`);
      for (const u of urls) {
        console.log(`URL: ${u}`);
        await crawlerService.parseAndSave(u, source);
      }
      console.log('--- MULTI ARTICLE FINISHED ---');
    } else if (url) {
      console.log('--- START SINGLE ARTICLE ---');
      console.log(`URL: ${url}`);
      console.log(`SOURCE: ${source}`);
      await crawlerService.parseAndSave(url, source);
      console.log('--- SINGLE ARTICLE FINISHED ---');
    } else {
      console.log('--- START CRAWLING ---');
      await crawlerService.crawlAllSources();
      console.log('--- CRAWLING FINISHED ---');
    }
  } catch (err) {
    console.error('Error during crawling:', err);
  } finally {
    await app.close();
  }
}

void bootstrap();
