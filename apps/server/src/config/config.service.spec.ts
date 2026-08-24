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
    TENCENT_COS_SECRET_ID: "",
    TENCENT_COS_SECRET_KEY: "",
    TENCENT_COS_BUCKET: "",
    TENCENT_COS_REGION: "",
    TENCENT_COS_PUBLIC_BASE_URL: "",
  };
  const validProductionSmsEnv = {
    ALIYUN_SMS_ACCESS_KEY_ID: "test-access-key-id",
    ALIYUN_SMS_ACCESS_KEY_SECRET: "test-access-key-secret",
    ALIYUN_SMS_SIGN_NAME: "宠伴",
    ALIYUN_SMS_TEMPLATE_CODE: "100001",
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.JWT_ACCESS_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.REFRESH_TOKEN_TTL_SECONDS;
    delete process.env.SMS_DEV_CODE;
    delete process.env.ALIYUN_SMS_ACCESS_KEY_ID;
    delete process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
    delete process.env.ALIYUN_SMS_SIGN_NAME;
    delete process.env.ALIYUN_SMS_TEMPLATE_CODE;
    delete process.env.SMS_CODE_TTL_SECONDS;
    delete process.env.SMS_SEND_COOLDOWN_SECONDS;
    delete process.env.SMS_HOURLY_LIMIT;
    delete process.env.SMS_MAX_ATTEMPTS;
    delete process.env.CAPTCHA_TTL_SECONDS;
    delete process.env.CAPTCHA_MAX_ATTEMPTS;
    delete process.env.AUTH_PASSWORD_MAX_ATTEMPTS;
    delete process.env.AUTH_PASSWORD_WINDOW_SECONDS;
    delete process.env.DEFAULT_ADMIN_USERNAME;
    delete process.env.DEFAULT_ADMIN_PHONE;
    delete process.env.DEFAULT_ADMIN_PASSWORD;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_DIR;
    delete process.env.NODE_ENV;
    delete process.env.TENCENT_COS_SECRET_ID;
    delete process.env.TENCENT_COS_SECRET_KEY;
    delete process.env.TENCENT_COS_BUCKET;
    delete process.env.TENCENT_COS_REGION;
    delete process.env.TENCENT_COS_PUBLIC_BASE_URL;
    delete process.env.BACKUP_COS_SECRET_ID;
    delete process.env.BACKUP_COS_SECRET_KEY;
    delete process.env.BACKUP_COS_BUCKET;
    delete process.env.BACKUP_COS_REGION;
    delete process.env.WEBSITE_PUBLIC_URL;
    delete process.env.WEBSITE_PREVIEW_TTL_SECONDS;
    delete process.env.WEBSITE_CONTENT_CACHE_TTL_SECONDS;
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
    expect(config.authPasswordMaxAttempts).toBe(5);
    expect(config.authPasswordWindowSeconds).toBe(900);
    expect(config.defaultAdminUsername).toBe("admin");
  });

  it("rejects a partially numeric password limiter value", () => {
    process.env.AUTH_PASSWORD_MAX_ATTEMPTS = "5x";

    expect(() => new ConfigService().authPasswordMaxAttempts).toThrow(
      "AUTH_PASSWORD_MAX_ATTEMPTS must be a positive integer",
    );
  });

  it("returns documented website runtime defaults", () => {
    const config = new ConfigService();

    expect(config.websitePublicUrl).toBe("http://localhost:8080");
    expect(config.websitePreviewTtlSeconds).toBe(600);
    expect(config.websiteContentCacheTtlSeconds).toBe(86400);
  });

  it("exposes the configured database schema to runtime adapters", () => {
    process.env.DB_SCHEMA = "system_settings_e2e_123";

    expect(new ConfigService().databaseSchema).toBe("system_settings_e2e_123");
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

    it.each(Object.keys(validProductionSmsEnv))(
      "requires %s for production startup",
      (missingName) => {
        process.env = {
          ...originalEnv,
          ...validStartupEnv,
          ...validProductionSmsEnv,
          NODE_ENV: "production",
          REDIS_PASSWORD: "production-redis-password",
        };
        delete process.env[missingName];

        expect(() => new ConfigService().validateForStartup()).toThrow(
          `${missingName} is required`,
        );
      },
    );

    it("keeps COS disabled when all fields are empty", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        TENCENT_COS_SECRET_ID: "",
        TENCENT_COS_SECRET_KEY: "",
        TENCENT_COS_BUCKET: "",
        TENCENT_COS_REGION: "",
        TENCENT_COS_PUBLIC_BASE_URL: "",
      };
      const config = new ConfigService();

      expect(() => config.validateForStartup()).not.toThrow();
      expect(config.tencentCosEnabled).toBe(false);
    });

    it("reports all missing required startup variables without exposing values", () => {
      process.env = { NODE_ENV: "development" };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        /DB_HOST.*DB_PASSWORD.*JWT_SECRET.*DEFAULT_ADMIN_PHONE/s,
      );
    });

    it("rejects partially configured WeChat and Tencent COS integrations", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        WECHAT_APP_ID: "wx3bdad4ab652f0d1d",
        TENCENT_COS_BUCKET: "petcare-1250000000",
      };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        /WECHAT_APP_SECRET.*TENCENT_COS_SECRET_ID.*TENCENT_COS_REGION/s,
      );
    });

    it("accepts configured Tencent COS and exposes typed getters", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        TENCENT_COS_SECRET_ID: "test-secret-id",
        TENCENT_COS_SECRET_KEY: "test-secret-key",
        TENCENT_COS_BUCKET: "petcare-media-1250000000",
        TENCENT_COS_REGION: "ap-guangzhou",
        TENCENT_COS_PUBLIC_BASE_URL: "https://cdn.example.com/petcare",
      };
      const config = new ConfigService();

      expect(() => config.validateForStartup()).not.toThrow();
      expect(config.tencentCosSecretId).toBe("test-secret-id");
      expect(config.tencentCosSecretKey).toBe("test-secret-key");
      expect(config.tencentCosBucket).toBe("petcare-media-1250000000");
      expect(config.tencentCosRegion).toBe("ap-guangzhou");
      expect(config.tencentCosPublicBaseUrl).toBe("https://cdn.example.com/petcare");
      expect(config.tencentCosEnabled).toBe(true);
    });

    it.each([
      ["bucket", { TENCENT_COS_BUCKET: "Invalid_Bucket" }, "TENCENT_COS_BUCKET"],
      ["region", { TENCENT_COS_REGION: "guangzhou" }, "TENCENT_COS_REGION"],
      [
        "public base URL",
        { TENCENT_COS_PUBLIC_BASE_URL: "ftp://cdn.example.com/petcare" },
        "TENCENT_COS_PUBLIC_BASE_URL",
      ],
    ])("rejects a malformed Tencent COS %s", (_name, overrides, errorName) => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        TENCENT_COS_SECRET_ID: "test-secret-id",
        TENCENT_COS_SECRET_KEY: "test-secret-key",
        TENCENT_COS_BUCKET: "petcare-media-1250000000",
        TENCENT_COS_REGION: "ap-guangzhou",
        ...overrides,
      };

      expect(() => new ConfigService().validateForStartup()).toThrow(errorName);
    });

    it("rejects an unconfigured Tencent COS public base URL", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        TENCENT_COS_PUBLIC_BASE_URL: "https://cdn.example.com/petcare",
      };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        "TENCENT_COS_PUBLIC_BASE_URL requires Tencent COS configuration",
      );
    });

    it("validates website runtime URL and positive lifetimes", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        WEBSITE_PUBLIC_URL: "ftp://website.example.com",
        WEBSITE_PREVIEW_TTL_SECONDS: "0",
        WEBSITE_CONTENT_CACHE_TTL_SECONDS: "tomorrow",
      };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        /WEBSITE_PUBLIC_URL.*WEBSITE_PREVIEW_TTL_SECONDS.*WEBSITE_CONTENT_CACHE_TTL_SECONDS/s,
      );
    });

    it("validates password login limiter configuration", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        AUTH_PASSWORD_MAX_ATTEMPTS: "5x",
        AUTH_PASSWORD_WINDOW_SECONDS: "0",
      };

      expect(() => new ConfigService().validateForStartup()).toThrow(
        /AUTH_PASSWORD_MAX_ATTEMPTS.*AUTH_PASSWORD_WINDOW_SECONDS/s,
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

  describe("backup COS configuration", () => {
    it("requires the complete private backup group only when backup validation is requested", () => {
      process.env = { ...originalEnv, ...validStartupEnv };
      delete process.env.BACKUP_COS_SECRET_ID;
      delete process.env.BACKUP_COS_SECRET_KEY;
      delete process.env.BACKUP_COS_BUCKET;
      delete process.env.BACKUP_COS_REGION;
      const config = new ConfigService();

      expect(() => config.validateForStartup()).not.toThrow();
      expect(() => config.validateForBackup()).toThrow(
        /BACKUP_COS_SECRET_ID.*BACKUP_COS_SECRET_KEY.*BACKUP_COS_BUCKET.*BACKUP_COS_REGION/s,
      );
    });

    it("accepts a complete private backup group", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        BACKUP_COS_SECRET_ID: "backup-secret-id",
        BACKUP_COS_SECRET_KEY: "backup-secret-key",
        BACKUP_COS_BUCKET: "petcare-backup-1250000000",
        BACKUP_COS_REGION: "ap-guangzhou",
      };
      const config = new ConfigService();

      expect(() => config.validateForBackup()).not.toThrow();
      expect(config.databaseName).toBe("petcare");
      expect(config.backupCosSecretId).toBe("backup-secret-id");
      expect(config.backupCosSecretKey).toBe("backup-secret-key");
      expect(config.backupCosBucket).toBe("petcare-backup-1250000000");
      expect(config.backupCosRegion).toBe("ap-guangzhou");
    });

    it.each([
      ["bucket", { BACKUP_COS_BUCKET: "Invalid_Bucket" }, "BACKUP_COS_BUCKET"],
      ["region", { BACKUP_COS_REGION: "guangzhou" }, "BACKUP_COS_REGION"],
    ])("rejects a malformed backup COS %s", (_name, overrides, errorName) => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        BACKUP_COS_SECRET_ID: "backup-secret-id",
        BACKUP_COS_SECRET_KEY: "backup-secret-key",
        BACKUP_COS_BUCKET: "petcare-backup-1250000000",
        BACKUP_COS_REGION: "ap-guangzhou",
        ...overrides,
      };

      expect(() => new ConfigService().validateForBackup()).toThrow(errorName);
    });

    it("reports incomplete backup configuration by variable names without values", () => {
      process.env = {
        ...originalEnv,
        ...validStartupEnv,
        BACKUP_COS_SECRET_ID: "backup-secret-id",
        BACKUP_COS_SECRET_KEY: "backup-secret-key",
        BACKUP_COS_BUCKET: "",
        BACKUP_COS_REGION: "",
      };

      expect(() => new ConfigService().validateForBackup()).toThrow(
        /BACKUP_COS_BUCKET.*BACKUP_COS_REGION/s,
      );
      expect(() => new ConfigService().validateForBackup()).not.toThrow("backup-secret-id");
      expect(() => new ConfigService().validateForBackup()).not.toThrow("backup-secret-key");
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
