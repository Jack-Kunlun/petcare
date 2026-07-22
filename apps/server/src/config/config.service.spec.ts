import { ConfigService } from "./config.service";

describe("ConfigService authentication configuration", () => {
  const originalEnv = process.env;

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
});
