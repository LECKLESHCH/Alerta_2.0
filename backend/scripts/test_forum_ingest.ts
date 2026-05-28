import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CrawlerService } from '../src/crawler/crawler.service';

type ForumDoc = {
  url?: string;
  source?: string;
  title?: string;
  text?: string;
  type?: string;
  category?: string | null;
  severity?: string | null;
  classification_reasoning?: string | null;
  interpretation_summary?: string | null;
  publishedAt?: string | Date;
  updatedAt?: string | Date;
};

function hasCyrillic(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /[А-Яа-яЁё]/.test(value);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const crawler = app.get(CrawlerService);
    const started = crawler.startForumCrawl();
    const startedAt = new Date().toISOString();

    const startWait = Date.now();
    while (crawler.isCrawlRunning()) {
      if (Date.now() - startWait > 35 * 60 * 1000) {
        throw new Error('Forum ingest timeout after 35 minutes');
      }
      await sleep(1000);
    }

    const articleModel = (crawler as any).articleModel;
    const forumCollection = articleModel.db.collection('articles_forum');
    const total = await forumCollection.countDocuments({});
    const recentDocs = (await forumCollection
      .find({})
      .sort({ updatedAt: -1, publishedAt: -1 })
      .limit(50)
      .toArray()) as ForumDoc[];

    const russianQuality = recentDocs.reduce(
      (acc, doc) => {
        acc.total += 1;
        if (hasCyrillic(doc.title)) acc.titleRu += 1;
        if (hasCyrillic(doc.classification_reasoning)) acc.reasoningRu += 1;
        if (hasCyrillic(doc.interpretation_summary)) acc.interpretationRu += 1;
        if (hasCyrillic(doc.text)) acc.textRu += 1;
        return acc;
      },
      {
        total: 0,
        titleRu: 0,
        reasoningRu: 0,
        interpretationRu: 0,
        textRu: 0,
      },
    );

    const runResult = {
      started,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      collection: 'articles_forum',
      total_documents: total,
      sampled_documents: recentDocs.length,
      russian_quality: russianQuality,
      sample: recentDocs.slice(0, 10).map((doc) => ({
        url: doc.url,
        source: doc.source,
        title: doc.title,
        type: doc.type,
        category: doc.category ?? null,
        severity: doc.severity ?? null,
        classification_reasoning: doc.classification_reasoning ?? null,
        interpretation_summary: doc.interpretation_summary ?? null,
        publishedAt: doc.publishedAt ?? null,
        updatedAt: doc.updatedAt ?? null,
      })),
      logs: crawler.getRecentLogs(300),
    };

    const outDir = path.resolve(process.cwd(), '..', 'output', 'forum-prototype');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(
      outDir,
      `forum-ingest-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    fs.writeFileSync(outFile, JSON.stringify(runResult, null, 2), 'utf8');

    // eslint-disable-next-line no-console
    console.log(`Forum ingest test report saved: ${outFile}`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(runResult.russian_quality));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
