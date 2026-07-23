import { isAbsolute, resolve } from "node:path";
import { Injectable } from "@nestjs/common";

export const LOG_LEVELS = ["error", "warn", "info", "http", "verbose", "debug", "silly"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const monorepoRoot = resolve(__dirname, "../../../..");

@Injectable()
export class ConfigService {
  private getRequiredString(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new Error(`${name} is required`);
    }

    return value;
  }

  private getPositiveInteger(name: string, fallback: number): number {
    const value = process.env[name];

    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }

    return parsed;
  }

  // 数据库配置
  get databaseUrl(): string {
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || "5432";
    const username = process.env.DB_USERNAME || "user";
    const password = process.env.DB_PASSWORD || "password";
    const name = process.env.DB_NAME || "petcare";
    const schema = process.env.DB_SCHEMA || "public";

    return `postgresql://${username}:${password}@${host}:${port}/${name}?schema=${schema}`;
  }

  // Redis配置
  get redisHost(): string {
    return process.env.REDIS_HOST || "localhost";
  }

  get redisPort(): number {
    return this.getPositiveInteger("REDIS_PORT", 6379);
  }

  get redisPassword(): string | undefined {
    return process.env.REDIS_PASSWORD || undefined;
  }

  get redisUrl(): string {
    const host = this.redisHost;
    const port = this.redisPort;
    const password = this.redisPassword;

    if (password) {
      return `redis://:${password}@${host}:${port}`;
    }

    return `redis://${host}:${port}`;
  }

  // JWT配置
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters long for security");
    }

    return secret;
  }

  get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN || "7d";
  }

  get jwtAccessExpiresIn(): string {
    return process.env.JWT_ACCESS_EXPIRES_IN || "15m";
  }

  get jwtRefreshExpiresIn(): string {
    return process.env.JWT_REFRESH_EXPIRES_IN || "7d";
  }

  get refreshTokenTtlSeconds(): number {
    return this.getPositiveInteger("REFRESH_TOKEN_TTL_SECONDS", 604800);
  }

  get smsDevCode(): string | undefined {
    const code = process.env.SMS_DEV_CODE?.trim();

    if (!code) {
      return undefined;
    }

    if (this.nodeEnv === "production") {
      throw new Error("SMS_DEV_CODE must not be configured in production");
    }

    if (!/^\d{6}$/.test(code)) {
      throw new Error("SMS_DEV_CODE must be exactly 6 digits");
    }

    return code;
  }

  get smsCodeTtlSeconds(): number {
    return this.getPositiveInteger("SMS_CODE_TTL_SECONDS", 300);
  }

  get smsSendCooldownSeconds(): number {
    return this.getPositiveInteger("SMS_SEND_COOLDOWN_SECONDS", 60);
  }

  get smsHourlyLimit(): number {
    return this.getPositiveInteger("SMS_HOURLY_LIMIT", 5);
  }

  get smsMaxAttempts(): number {
    return this.getPositiveInteger("SMS_MAX_ATTEMPTS", 5);
  }

  get captchaTtlSeconds(): number {
    return this.getPositiveInteger("CAPTCHA_TTL_SECONDS", 300);
  }

  get captchaMaxAttempts(): number {
    return this.getPositiveInteger("CAPTCHA_MAX_ATTEMPTS", 5);
  }

  get defaultAdminUsername(): string {
    return process.env.DEFAULT_ADMIN_USERNAME?.trim() || "admin";
  }

  get defaultAdminPhone(): string {
    const phone = this.getRequiredString("DEFAULT_ADMIN_PHONE");

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new Error("DEFAULT_ADMIN_PHONE must be a valid Chinese mobile number");
    }

    return phone;
  }

  get defaultAdminPassword(): string {
    return this.getRequiredString("DEFAULT_ADMIN_PASSWORD");
  }

  // CORS配置
  get allowedOrigins(): string {
    return process.env.ALLOWED_ORIGINS || "http://localhost:8986";
  }

  // API配置
  get apiBaseUrl(): string {
    return process.env.API_BASE_URL || "http://localhost:8986/api";
  }

  // 服务器配置
  get port(): number {
    return this.getPositiveInteger("PORT", 3000);
  }

  get nodeEnv(): string {
    return process.env.NODE_ENV || "development";
  }

  // 日志配置
  get logLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.trim() || "info";

    if (!LOG_LEVELS.includes(level as LogLevel)) {
      throw new Error(`LOG_LEVEL must be one of ${LOG_LEVELS.join(", ")}`);
    }

    return level as LogLevel;
  }

  get logDirectory(): string {
    const directory = process.env.LOG_DIR?.trim() || "logs/server";

    return isAbsolute(directory) ? directory : resolve(monorepoRoot, directory);
  }

  get logRawRequestBody(): boolean {
    return this.nodeEnv !== "production" && this.logLevel === "debug";
  }

  // 异步任务配置。任务生产者和 Worker 必须使用同一队列前缀，
  // 以便在单体内运行或拆分为独立进程时保持兼容。
  get queuePrefix(): string {
    return process.env.QUEUE_PREFIX || "petcare";
  }

  get workerConcurrency(): number {
    return this.getPositiveInteger("WORKER_CONCURRENCY", 5);
  }

  get outboxPollIntervalMs(): number {
    return this.getPositiveInteger("OUTBOX_POLL_INTERVAL_MS", 1000);
  }

  get orderTimeoutDelayMs(): number {
    return this.getPositiveInteger("ORDER_TIMEOUT_DELAY_MS", 172800000);
  }

  // 第三方服务配置
  get wechatAppId(): string {
    return process.env.WECHAT_APP_ID || "";
  }

  get wechatAppSecret(): string {
    return process.env.WECHAT_APP_SECRET || "";
  }

  get aliyunOssAccessKeyId(): string {
    return process.env.ALIYUN_OSS_ACCESS_KEY_ID || "";
  }

  get aliyunOssAccessKeySecret(): string {
    return process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || "";
  }

  get aliyunOssBucket(): string {
    return process.env.ALIYUN_OSS_BUCKET || "";
  }

  get aliyunOssRegion(): string {
    return process.env.ALIYUN_OSS_REGION || "";
  }
}
