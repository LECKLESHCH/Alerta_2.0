import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly ttlSeconds: number;
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
    const ttlRaw =
      this.configService.get<string>('REDIS_CACHE_TTL_SECONDS') ?? '60';
    const ttl = Number(ttlRaw);
    this.ttlSeconds = Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : 60;

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      this.client.on('error', (error) => {
        this.logger.warn(`Redis error: ${error.message}`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis initialization failed: ${message}`);
      this.client = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      if (this.client.status === 'wait') await this.client.connect();
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!this.client) return;
    try {
      if (this.client.status === 'wait') await this.client.connect();
      await this.client.set(key, JSON.stringify(value), 'EX', this.ttlSeconds);
    } catch {
      // no-op
    }
  }

  async onModuleDestroy() {
    if (!this.client) return;
    await this.client.quit();
  }
}

