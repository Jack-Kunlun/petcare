import { ConfigService } from "./config.service";

describe("ConfigService", () => {
  const originalEnv = process.env;
  const validStartupEnv = {
    NODE_ENV: "development",
    PORT: "3000",
    DB_HOST: "localhost",
    DB_PORT: "5432",
    DB_USERNAME: "user",
    DB_PASSWORD: "local-database-password",
    DB_NAME: "petcare",
    DB_SCHEMA: "public",
    REDIS_HOST: "localhost",
    REDIS_PORT: "6379",
    REDIS_PASSWORD: "",
    JWT_SECRET: "local-jwt-secret-with-at-least-32-characters",
    DEFAULT_ADMIN_USERNAME: "admin",
    DEFAULT_ADMIN_PHONE: "13800138000",
    DEFAULT_ADMIN_PASSWORD: "Local-Admin-Password-2026!",
    ALLOWED_ORIGINS: "http://localhost:8986",
    WECHAT_APP_ID: "",
    WECHAT_APP_SECRET: "",
    ALIYUN_OSS_ACCESS_KEY_ID: "",
    ALIYUN_OSS_ACCESS_KEY_SECRET: "",
    ALIYUN_OSS_BUCKET: "",
    ALIYUN_OSS_REGION: "",
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.JWT_ACCESS_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.REFRESH_TOKEN_TTL_SECONDS;
    delete process.env.SMS_DEV_CODE;
    delete process.env.SMS_CODE_TTL_SECONDS;
    delete process.env.SMS_SEND_COOLDOWN_SECONDS;
    delete process.env.SMS_HOURLY_LIMIT;
    delete process.env.SMS_MAX_ATTEMPTS;
    delete process.env.CAPTCHA_TTL_SECONDS;
    delete process.env.CAPTCHA_MAX_ATTEMPTS;
    delete process.env.DEFAULT_ADMIN_USERNAME;
    delete process.env.DEFAULT_ADMIN_PHONE;
    delete process.env.DEFAULT_ADMIN_PASSWORD;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_DIR;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns the documented authentication defaults", () => {
    const config = new ConfigService();

    expect(config.jwtAccessExpiresIn).toBe("15m");
    expect(config.jwtRefreshExpiresIn).toBe("7d");
    expect(config.refreshTokenTtlSeconds).toBe(604800);
    expect(config.smsCodeTtlSeconds).toBe(300);
    expect(config.smsSendCooldownSeconds).toBe(60);
    expect(config.smsHourlyLimit).toBe(5);
    expect(config.smsMaxAttempts).toBe(5);
    expect(config.captchaTtlSeconds).toBe(300);
    expect(config.captchaMaxAttempts).toBe(5);
    expect(config.defaultAdminUsername).toBe("admin");
  });

  it("requires the default administrator phone and password", () => {
    const config = new ConfigService();

    expect(() => config.defaultAdminPhone).toThrow("DEFAULT_ADMIN_PHONE is required");
    expect(() => config.defaultAdminPassword).toThrow("DEFAULT_ADMIN_PASSWORD is required");
  });

  it("rejects a production development SMS code", () => {
    process.env.NODE_ENV = "production";
    process.env.SMS_DEV_CODE = "246810";

    expect(() => new ConfigService().smsDevCode).toThrow(
      "SMS_DEV_CODE must not be configured in production",
    );
  });

  it("rejects a malformed development SMS code", () => {
    process.env.NODE_ENV = "development";
    process.env.SMS_DEV_CODE = "12345";

    expect(() => new ConfigService().smsDevCode).toThrow("SMS_DEV_CODE must be exactly 6 digits");
  });

  it("rejects non-positive captcha limits", () => {
    process.env.CAPTCHA_TTL_SECONDS = "0";
    process.env.CAPTCHA_MAX_ATTEMPTS = "-1";
    const config = new ConfigService();

    expect(() => config.captchaTtlSeconds).toThrow(
      "CAPTCHA_TTL_SECONDS must be a positive integer",
    );
    expect(() => config.captchaMaxAttempts).toThrow(
      "CAPTCHA_MAX_ATTEMPTS must be a positive integer",
    );
  });

  describe("startup validation", () => {
    it("accepts complete startup configuration with disabled optional integrations", () => {
      process.env = { ...originalEnv, ...validStartupEnv };

      expect(() => new ConfigService().validateForStartup()).not.toThrow();
    });

    it("reports all missing required startup variables without exposing values", () => {
      process.env = { NODE_ENV: "development" };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        /DB_HOST.*DB_PASSWORD.*JWT_SECRET.*DEFAULT_ADMIN_PHONE/s,
      );
    });

    it("rejects partially configured WeChat and OSS integrations", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        WECHAT_APP_ID: "wx3bdad4ab652f0d1d",
        ALIYUN_OSS_BUCKET: "petcare-test",
      };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        /WECHAT_APP_SECRET.*ALIYUN_OSS_ACCESS_KEY_ID.*ALIYUN_OSS_REGION/s,
      );
    });

    it("rejects malformed complete WeChat and OSS integrations", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        WECHAT_APP_ID: "invalid-app-id",
        WECHAT_APP_SECRET: "invalid-secret",
        ALIYUN_OSS_ACCESS_KEY_ID: "test-access-key",
        ALIYUN_OSS_ACCESS_KEY_SECRET: "test-access-secret",
        ALIYUN_OSS_BUCKET: "Invalid_Bucket",
        ALIYUN_OSS_REGION: "cn-hangzhou",
      };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        /WECHAT_APP_ID.*ALIYUN_OSS_BUCKET/s,
      );
    });

    it("rejects malformed ports, token durations, and allowed origins", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        DB_PORT: "5432x",
        JWT_ACCESS_EXPIRES_IN: "soon",
        JWT_REFRESH_EXPIRES_IN: "next-week",
        ALLOWED_ORIGINS: "localhost:8986",
      };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        /DB_PORT.*JWT_ACCESS_EXPIRES_IN.*JWT_REFRESH_EXPIRES_IN.*ALLOWED_ORIGINS/s,
      );
    });

    it("requires Redis authentication and rejects development SMS codes in production", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        NODE_ENV: "production",
        REDIS_PASSWORD: "",
        SMS_DEV_CODE: "246810",
      };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        /REDIS_PASSWORD.*SMS_DEV_CODE/s,
      );
    });
  });

  describe("logging configuration", () => {
    it("uses safe logging defaults", () => {
      const config = new ConfigService();

      expect(config.logLevel).toBe("info");
      expect(config.logDirectory.replaceAll("\\", "/")).toMatch(/\/logs\/server$/);
      expect(config.logRawRequestBody).toBe(false);
    });

    it("allows raw request bodies only for development debug logging", () => {
      process.env.NODE_ENV = "development";
      process.env.LOG_LEVEL = "debug";
      expect(new ConfigService().logRawRequestBody).toBe(true);

      process.env.NODE_ENV = "production";
      expect(new ConfigService().logRawRequestBody).toBe(false);
    });

    it("rejects an unsupported log level", () => {
      process.env.LOG_LEVEL = "trace";

      expect(() => new ConfigService().logLevel).toThrow(
        "LOG_LEVEL must be one of error, warn, info, http, verbose, debug, silly",
      );
    });
  });
});
