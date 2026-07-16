import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { createClient, RedisClientType } from "redis";
import { ConfigService } from "../config/config.service";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  constructor(private configService: ConfigService) {
    const password = configService.redisPassword;

    this.client = createClient({
      socket: {
        host: configService.redisHost,
        port: configService.redisPort,
      },
      password: password || undefined,
    });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): RedisClientType {
    return this.client;
  }

  // 示例方法：设置键值
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  // 示例方法：获取键值
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  // 示例方法：删除键
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
