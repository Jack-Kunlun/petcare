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

  private getRequiredPositiveInteger(name: string): number {
    const value = this.getRequiredString(name);

    if (!/^\d+$/.test(value) || Number(value) <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }

    return Number(value);
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

  validateForStartup(): void {
    const errors: string[] = [];
    const check = (name: string, reader: () => unknown): void => {
      try {
        reader();
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${name} is invalid`);
      }
    };
    const required = [
      "DB_HOST",
      "DB_USERNAME",
      "DB_PASSWORD",
      "DB_NAME",
      "DB_SCHEMA",
      "REDIS_HOST",
      "DEFAULT_ADMIN_USERNAME",
    ] as const;

    for (const name of required) {
      check(name, () => this.getRequiredString(name));
    }

    check("NODE_ENV", () => this.validateNodeEnv());
    check("PORT", () => this.port);
    check("DB_PORT", () => this.getRequiredPositiveInteger("DB_PORT"));
    check("REDIS_PORT", () => this.getRequiredPositiveInteger("REDIS_PORT"));
    check("JWT_SECRET", () => this.jwtSecret);
    check("JWT_ACCESS_EXPIRES_IN", () =>
      this.validateDuration("JWT_ACCESS_EXPIRES_IN", this.jwtAccessExpiresIn),
    );
    check("JWT_REFRESH_EXPIRES_IN", () =>
      this.validateDuration("JWT_REFRESH_EXPIRES_IN", this.jwtRefreshExpiresIn),
    );
    check("REFRESH_TOKEN_TTL_SECONDS", () => this.refreshTokenTtlSeconds);
    check("DEFAULT_ADMIN_PHONE", () => this.defaultAdminPhone);
    check("DEFAULT_ADMIN_PASSWORD", () => this.validateAdminPassword());
    check("ALLOWED_ORIGINS", () => this.validateAllowedOrigins());
    check("WECHAT", () => this.validateWechatConfiguration());
    check("TENCENT_COS", () => this.validateTencentCosConfiguration());
    check("WEBSITE_PUBLIC_URL", () => this.websitePublicUrl);
    check("WEBSITE_PREVIEW_TTL_SECONDS", () => this.websitePreviewTtlSeconds);
    check("WEBSITE_CONTENT_CACHE_TTL_SECONDS", () => this.websiteContentCacheTtlSeconds);

    if (this.nodeEnv === "production") {
      check("REDIS_PASSWORD", () => this.getRequiredString("REDIS_PASSWORD"));
      check("SMS_DEV_CODE", () => this.smsDevCode);
      check("ALIYUN_SMS_ACCESS_KEY_ID", () => this.aliyunSmsAccessKeyId);
      check("ALIYUN_SMS_ACCESS_KEY_SECRET", () => this.aliyunSmsAccessKeySecret);
      check("ALIYUN_SMS_SIGN_NAME", () => this.aliyunSmsSignName);
      check("ALIYUN_SMS_TEMPLATE_CODE", () => this.aliyunSmsTemplateCode);
    }

    if (errors.length > 0) {
      throw new Error(`Invalid environment configuration:\n- ${errors.join("\n- ")}`);
    }
  }

  validateForBackup(): void {
    const errors: string[] = [];

    for (const name of [
      "BACKUP_COS_SECRET_ID",
      "BACKUP_COS_SECRET_KEY",
      "BACKUP_COS_BUCKET",
      "BACKUP_COS_REGION",
    ]) {
      try {
        this.getRequiredString(name);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${name} is invalid`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Invalid backup configuration:\n- ${errors.join("\n- ")}`);
    }

    if (!/^[a-z0-9][a-z0-9-]*-\d{10,}$/.test(this.backupCosBucket)) {
      throw new Error("BACKUP_COS_BUCKET must use the BucketName-APPID format");
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(this.backupCosRegion)) {
      throw new Error("BACKUP_COS_REGION has an invalid format");
    }
  }

  private validateNodeEnv(): void {
    if (!["development", "test", "production"].includes(this.nodeEnv)) {
      throw new Error("NODE_ENV must be development, test, or production");
    }
  }

  private validateDuration(name: string, value: string): void {
    if (!/^\d+(?:ms|s|m|h|d|w)$/.test(value)) {
      throw new Error(`${name} must be a positive duration such as 15m or 7d`);
    }
  }

  private validateAdminPassword(): void {
    if (this.defaultAdminPassword.length < 12) {
      throw new Error("DEFAULT_ADMIN_PASSWORD must be at least 12 characters long");
    }
  }

  private validateAllowedOrigins(): void {
    for (const origin of this.allowedOrigins.split(",").map((value) => value.trim())) {
      try {
        const url = new URL(origin);

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("unsupported protocol");
        }
      } catch {
        throw new Error("ALLOWED_ORIGINS must contain valid absolute HTTP URLs");
      }
    }
  }

  private validateOptionalGroup(names: readonly string[]): boolean {
    const configured = names.filter((name) => Boolean(process.env[name]?.trim()));

    if (configured.length === 0) {
      return false;
    }

    const missing = names.filter((name) => !process.env[name]?.trim());

    if (missing.length > 0) {
      throw new Error(`${missing.join(", ")} are required when this integration is configured`);
    }

    return true;
  }

  private validateWechatConfiguration(): void {
    if (!this.validateOptionalGroup(["WECHAT_APP_ID", "WECHAT_APP_SECRET"])) {
      return;
    }

    if (!/^wx[a-zA-Z0-9]{16}$/.test(this.wechatAppId)) {
      throw new Error("WECHAT_APP_ID has an invalid format");
    }

    if (!/^[a-f0-9]{32}$/i.test(this.wechatAppSecret)) {
      throw new Error("WECHAT_APP_SECRET has an invalid format");
    }
  }

  private validateTencentCosConfiguration(): void {
    if (
      !this.validateOptionalGroup([
        "TENCENT_COS_SECRET_ID",
        "TENCENT_COS_SECRET_KEY",
        "TENCENT_COS_BUCKET",
        "TENCENT_COS_REGION",
      ])
    ) {
      if (this.tencentCosPublicBaseUrl) {
        throw new Error("TENCENT_COS_PUBLIC_BASE_URL requires Tencent COS configuration");
      }

      return;
    }

    if (!/^[a-z0-9][a-z0-9-]*-\d{10,}$/.test(this.tencentCosBucket)) {
      throw new Error("TENCENT_COS_BUCKET must use the BucketName-APPID format");
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(this.tencentCosRegion)) {
      throw new Error("TENCENT_COS_REGION has an invalid format");
    }

    if (this.tencentCosPublicBaseUrl) {
      this.validateAbsoluteHttpUrl("TENCENT_COS_PUBLIC_BASE_URL", this.tencentCosPublicBaseUrl);
    }
  }

  private validateAbsoluteHttpUrl(name: string, value: string): string {
    try {
      const url = new URL(value);

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("unsupported protocol");
      }
    } catch {
      throw new Error(`${name} must be an absolute HTTP(S) URL`);
    }

    return value;
  }

  // 数据库配置
  get databaseSchema(): string {
    return process.env.DB_SCHEMA || "public";
  }

  get databaseName(): string {
    return process.env.DB_NAME?.trim() || "petcare";
  }

  get databaseUrl(): string {
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || "5432";
    const username = process.env.DB_USERNAME || "user";
    const password = process.env.DB_PASSWORD || "password";
    const name = this.databaseName;
    const schema = this.databaseSchema;

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

  get aliyunSmsAccessKeyId(): string {
    return this.getRequiredString("ALIYUN_SMS_ACCESS_KEY_ID");
  }

  get aliyunSmsAccessKeySecret(): string {
    return this.getRequiredString("ALIYUN_SMS_ACCESS_KEY_SECRET");
  }

  get aliyunSmsSignName(): string {
    return this.getRequiredString("ALIYUN_SMS_SIGN_NAME");
  }

  get aliyunSmsTemplateCode(): string {
    return this.getRequiredString("ALIYUN_SMS_TEMPLATE_CODE");
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

  get websitePublicUrl(): string {
    return this.validateAbsoluteHttpUrl(
      "WEBSITE_PUBLIC_URL",
      process.env.WEBSITE_PUBLIC_URL?.trim() || "http://localhost:8080",
    );
  }

  get websitePreviewTtlSeconds(): number {
    return this.getPositiveInteger("WEBSITE_PREVIEW_TTL_SECONDS", 600);
  }

  get websiteContentCacheTtlSeconds(): number {
    return this.getPositiveInteger("WEBSITE_CONTENT_CACHE_TTL_SECONDS", 86400);
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

  get tencentCosSecretId(): string {
    return process.env.TENCENT_COS_SECRET_ID?.trim() || "";
  }

  get tencentCosSecretKey(): string {
    return process.env.TENCENT_COS_SECRET_KEY?.trim() || "";
  }

  get tencentCosBucket(): string {
    return process.env.TENCENT_COS_BUCKET?.trim() || "";
  }

  get tencentCosRegion(): string {
    return process.env.TENCENT_COS_REGION?.trim() || "";
  }

  get tencentCosPublicBaseUrl(): string {
    return process.env.TENCENT_COS_PUBLIC_BASE_URL?.trim() || "";
  }

  get backupCosSecretId(): string {
    return this.getRequiredString("BACKUP_COS_SECRET_ID");
  }

  get backupCosSecretKey(): string {
    return this.getRequiredString("BACKUP_COS_SECRET_KEY");
  }

  get backupCosBucket(): string {
    return this.getRequiredString("BACKUP_COS_BUCKET");
  }

  get backupCosRegion(): string {
    return this.getRequiredString("BACKUP_COS_REGION");
  }

  get tencentCosEnabled(): boolean {
    return Boolean(
      this.tencentCosSecretId &&
      this.tencentCosSecretKey &&
      this.tencentCosBucket &&
      this.tencentCosRegion,
    );
  }
}
