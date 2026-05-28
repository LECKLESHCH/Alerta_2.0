import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CrawlerService } from '../src/crawler/crawler.service';
import { ReferenceIntelService } from '../src/reference-intel/reference-intel.service';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

function normalizeNullableString(value: unknown): string | null {
  const asString = String(value ?? '').trim();
  return asString ? asString : null;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const crawler = app.get(CrawlerService) as any;
    const referenceIntelService = app.get(ReferenceIntelService);
    const configService = app.get(ConfigService);
    const articleModel = crawler.articleModel;
    const forumCollection = articleModel.db.collection('articles_forum');
    const llm = new ChatOpenAI({
      apiKey: configService.get<string>('OPENAI_API_KEY'),
      model:
        configService.get<string>('OPENROUTER_CLASSIFIER_MODEL') ?? 'openrouter/free',
      temperature: 0,
      maxTokens: 120,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
    });

    const docs = await forumCollection
      .find({ type: 'threat' })
      .project({
        _id: 1,
        title: 1,
        text: 1,
        category: 1,
        severity: 1,
        classification_reasoning: 1,
        cve_mentions: 1,
        vendor_candidates: 1,
        product_candidates: 1,
        technology_terms: 1,
        attack_techniques: 1,
        asset_type: 1,
        threat_actor: 1,
        malware_family: 1,
      })
      .toArray();

    let updated = 0;
    let failed = 0;
    let subcategoryUpdated = 0;

    for (const doc of docs) {
      try {
        const interpretation = await referenceIntelService.interpretThreat({
          title: normalizeNullableString(doc.title) ?? 'Без заголовка',
          text: normalizeNullableString(doc.text) ?? '',
          category: normalizeNullableString(doc.category),
          subcategory: null,
          severity: normalizeNullableString(doc.severity),
          classification_reasoning:
            normalizeNullableString(doc.classification_reasoning) ??
            'Forum backfill',
          attack_vector: null,
          target_sector: null,
          cve_mentions: Array.isArray(doc.cve_mentions)
            ? doc.cve_mentions.map((x: unknown) => String(x))
            : [],
          vendor_candidates: Array.isArray(doc.vendor_candidates)
            ? doc.vendor_candidates.map((x: unknown) => String(x))
            : [],
          product_candidates: Array.isArray(doc.product_candidates)
            ? doc.product_candidates.map((x: unknown) => String(x))
            : [],
          technology_terms: Array.isArray(doc.technology_terms)
            ? doc.technology_terms.map((x: unknown) => String(x))
            : [],
          attack_techniques: Array.isArray(doc.attack_techniques)
            ? doc.attack_techniques.map((x: unknown) => String(x))
            : [],
          asset_type: normalizeNullableString(doc.asset_type),
          threat_actor: normalizeNullableString(doc.threat_actor),
          malware_family: normalizeNullableString(doc.malware_family),
        });

        let nextSubcategory = normalizeNullableString(doc.subcategory);
        const category = normalizeNullableString(doc.category);
        if (!nextSubcategory && category) {
          const prompt = `Верни только JSON в одну строку: {"subcategory": string|null}
Нужно выбрать подкатегорию угрозы на русском языке.
Если данных недостаточно, верни null.
Категория: ${category}
Заголовок: ${normalizeNullableString(doc.title) ?? ''}
Текст: ${(normalizeNullableString(doc.text) ?? '').slice(0, 900)}
`;
          try {
            const response = await llm.invoke(prompt);
            const text =
              typeof response?.content === 'string'
                ? response.content
                : Array.isArray(response?.content)
                  ? response.content
                      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
                      .join('\n')
                  : '';
            const match = text.match(/\{[\s\S]*\}/);
            const parsed = match ? JSON.parse(match[0]) : null;
            if (parsed && (parsed.subcategory === null || typeof parsed.subcategory === 'string')) {
              nextSubcategory = normalizeNullableString(parsed.subcategory);
              if (nextSubcategory) {
                subcategoryUpdated += 1;
              }
            }
          } catch {
            // noop
          }
        }

        await forumCollection.updateOne(
          { _id: doc._id },
          {
            $set: {
              subcategory: nextSubcategory ?? null,
              interpretation_grounding_score: interpretation.grounding_score,
              interpreted_reference_matches: interpretation.matches,
              updatedAt: new Date(),
            },
          },
        );
        updated += 1;
      } catch {
        failed += 1;
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `Forum grounding backfill done. updated=${updated}, subcategory_updated=${subcategoryUpdated}, failed=${failed}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
