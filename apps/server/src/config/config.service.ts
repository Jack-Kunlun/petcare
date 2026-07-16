import { Injectable } from "@nestjs/common";

@Injectable()
export class ConfigService {
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
    return parseInt(process.env.REDIS_PORT || "6379", 10);
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

  // CORS配置
  get allowedOrigins(): string {
    return process.env.ALLOWED_ORIGINS || "http://localhost:3000";
  }

  // API配置
  get apiBaseUrl(): string {
    return process.env.API_BASE_URL || "http://localhost:3001/api";
  }

  // 服务器配置
  get port(): number {
    return parseInt(process.env.PORT || "3001", 10);
  }

  get nodeEnv(): string {
    return process.env.NODE_ENV || "development";
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
