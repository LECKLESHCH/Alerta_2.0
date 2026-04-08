import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Article } from '../article/article.schema';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface ThreatPredictionResult {
  articleId: string;
  rag_used: boolean;
  retrieved_docs: number;
  llm_response: string;
}

@Injectable()
export class ThreatPredictorService implements OnModuleInit {
  private readonly logger = new Logger(ThreatPredictorService.name);
  private qdrant: QdrantClient;
  private embeddings: OpenAIEmbeddings;
  private llm: ChatOpenAI;
  private readonly collectionName = 'articles';
  private readonly embeddingModel = 'text-embedding-3-small';
  private readonly embeddingSize = 1536;

  constructor(
    @InjectModel(Article.name) private articleModel: Model<Article>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const qdrantUrl =
      this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333';
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    const openaiApiBase =
      this.configService.get<string>('OPENAI_API_BASE') ||
      'https://openrouter.ai/api/v1';

    if (!openaiApiKey) {
      this.logger.error(
        'OPENAI_API_KEY is not set! Threat prediction will fail.',
      );
      throw new Error('OPENAI_API_KEY is missing');
    }

    this.logger.log(
      `Initializing services. Qdrant: ${qdrantUrl}, OpenAI Base: ${openaiApiBase}`,
    );

    this.qdrant = new QdrantClient({ url: qdrantUrl });

    const openAiConfig = {
      apiKey: openaiApiKey,
      configuration: {
        baseURL: openaiApiBase,
      },
    };

    this.embeddings = new OpenAIEmbeddings({
      ...openAiConfig,
      model: this.embeddingModel,
    });

    this.llm = new ChatOpenAI({
      ...openAiConfig,
      temperature: 0.2,
    });

    await this.ensureQdrantCollection();
  }

  async predict(articleId: string): Promise<ThreatPredictionResult | string> {
    const article = await this.articleModel.findById(articleId).exec();
    if (!article) return 'Статья не найдена';

    this.logger.log(`Processing article: ${articleId}`);

    const vector = await this.embeddings.embedQuery(article.text);

    await this.qdrant.upsert(this.collectionName, {
      points: [
        {
          id: article._id.toString(),
          vector,
          payload: {
            title: article.title,
            text: article.text,
            articleId: article._id.toString(),
          },
        },
      ],
    });

    const searchRes = await this.qdrant.search(this.collectionName, {
      vector,
      limit: 3,
      with_payload: true,
    });

    const context = searchRes
      .map((r) => {
        const p = r.payload as Record<string, unknown> | null;
        if (!p) return '';
        const titleVal = p['title'];
        const textVal = p['text'];
        const title = typeof titleVal === 'string' ? titleVal : '';
        const text = typeof textVal === 'string' ? textVal : '';
        return title ? `${title}: ${text}` : '';
      })
      .join('\n');

    const prompt = `Ты аналитик по киберугрозам. Отвечай всегда на русском языке.
На основе контекста и статьи оцени вероятность появления новой киберугрозы.

Контекст (похожие инциденты):
${context}

Статья:
${article.text}

Ответь в формате JSON:
{
  "risk_level": "low|medium|high|critical",
  "probability": number,
  "explanation": string
}`;

    const response = await this.llm.invoke(prompt);

    return {
      articleId,
      rag_used: true,
      retrieved_docs: searchRes.length,
      llm_response: response.content as string,
    };
  }

  private async ensureQdrantCollection() {
    try {
      await this.qdrant.getCollection(this.collectionName);
    } catch {
      await this.qdrant.createCollection(this.collectionName, {
        vectors: { size: this.embeddingSize, distance: 'Cosine' },
      });
    }
  }
}
