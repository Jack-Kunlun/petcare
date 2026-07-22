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
    const value = await this.client.get(key);

    return typeof value === "string" ? value : null;
  }

  async setIfAbsent(key: string, value: string, ttl: number): Promise<boolean> {
    const result = await this.client.set(key, value, { EX: ttl, NX: true });

    return result === "OK";
  }

  async increment(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // 示例方法：删除键
  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  async verifyAndConsumeOtp(
    otpKey: string,
    attemptsKey: string,
    expectedDigest: string,
    maxAttempts: number,
  ): Promise<boolean> {
    return this.verifyAndConsumeDigest(otpKey, attemptsKey, expectedDigest, maxAttempts);
  }

  async verifyAndConsumeDigest(
    valueKey: string,
    attemptsKey: string,
    expectedDigest: string,
    maxAttempts: number,
  ): Promise<boolean> {
    const result = await this.client.eval(
      `
        local stored = redis.call("GET", KEYS[1])
        if not stored then
          return 0
        end

        local attempts = tonumber(redis.call("GET", KEYS[2]) or "0")
        local maxAttempts = tonumber(ARGV[2])
        if attempts >= maxAttempts then
          redis.call("DEL", KEYS[1], KEYS[2])
          return 0
        end

        if stored == ARGV[1] then
          redis.call("DEL", KEYS[1], KEYS[2])
          return 1
        end

        attempts = redis.call("INCR", KEYS[2])
        if attempts == 1 then
          local remainingTtl = redis.call("TTL", KEYS[1])
          if remainingTtl > 0 then
            redis.call("EXPIRE", KEYS[2], remainingTtl)
          end
        end

        if attempts >= maxAttempts then
          redis.call("DEL", KEYS[1], KEYS[2])
        end
        return 0
      `,
      {
        keys: [valueKey, attemptsKey],
        arguments: [expectedDigest, String(maxAttempts)],
      },
    );

    return Number(result) === 1;
  }
}
