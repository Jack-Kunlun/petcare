import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import { SmsSender } from "./sms/sms-sender";
import { VerificationCodeService } from "./verification-code.service";

const smsHourlyLimit = 5;

class InMemoryRedis {
  readonly values = new Map<string, string>();

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async setIfAbsent(key: string, value: string): Promise<boolean> {
    if (this.values.has(key)) {
      return false;
    }

    this.values.set(key, value);

    return true;
  }

  async increment(key: string): Promise<number> {
    const next = Number(this.values.get(key) ?? "0") + 1;

    this.values.set(key, String(next));

    return next;
  }

  expire(): Promise<void> {
    return Promise.resolve();
  }

  async consumeFixedWindow(key: string, maxAttempts: number): Promise<boolean> {
    return (await this.increment(key)) <= maxAttempts;
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.values.delete(key);
    }
  }

  async verifyAndConsumeOtp(
    otpKey: string,
    attemptsKey: string,
    expectedDigest: string,
    maxAttempts: number,
  ): Promise<boolean> {
    const storedDigest = this.values.get(otpKey);
    const attempts = Number(this.values.get(attemptsKey) ?? "0");

    if (!storedDigest || attempts >= maxAttempts) {
      this.values.delete(otpKey);
      this.values.delete(attemptsKey);

      return false;
    }

    if (storedDigest === expectedDigest) {
      this.values.delete(otpKey);
      this.values.delete(attemptsKey);

      return true;
    }

    const nextAttempts = attempts + 1;

    this.values.set(attemptsKey, String(nextAttempts));

    if (nextAttempts >= maxAttempts) {
      this.values.delete(otpKey);
      this.values.delete(attemptsKey);
    }

    return false;
  }
}

describe("VerificationCodeService", () => {
  let redis: InMemoryRedis;
  let sender: { sendCode: jest.Mock };
  let service: VerificationCodeService;

  beforeEach(() => {
    redis = new InMemoryRedis();
    sender = { sendCode: jest.fn().mockResolvedValue(undefined) };
    const config = {
      jwtSecret: "test-jwt-secret-that-is-at-least-32-characters",
      smsDevCode: "246810",
      smsCodeTtlSeconds: 300,
      smsSendCooldownSeconds: 60,
      smsHourlyLimit,
      smsMaxAttempts: 5,
    } as ConfigService;

    service = new VerificationCodeService(
      redis as unknown as RedisService,
      config,
      sender as SmsSender,
    );
  });

  it("stores only a digest and sends the configured six-digit code", async () => {
    await service.send({ phone: "13800138000", purpose: "admin_login" });

    expect(sender.sendCode).toHaveBeenCalledWith("13800138000", "246810");
    expect(redis.values.get("auth:otp:admin_login:13800138000")).toBeDefined();
    expect(redis.values.get("auth:otp:admin_login:13800138000")).not.toContain("246810");
  });

  it("removes the OTP and cooldown when the provider rejects delivery", async () => {
    sender.sendCode.mockRejectedValue(
      Object.assign(new Error("短信发送失败，请稍后重试"), {
        code: "SMS_DELIVERY_FAILED",
        status: 503,
      }),
    );

    await expect(
      service.send({ phone: "13800138000", purpose: "admin_login" }),
    ).rejects.toMatchObject({
      code: "SMS_DELIVERY_FAILED",
    });
    expect(redis.values.has("auth:otp:admin_login:13800138000")).toBe(false);
    expect(redis.values.has("auth:otp:cooldown:admin_login:13800138000")).toBe(false);
  });

  it("consumes a correct code once", async () => {
    await service.send({ phone: "13800138000", purpose: "admin_login" });

    await expect(
      service.verifyAndConsume({
        phone: "13800138000",
        code: "246810",
        purpose: "admin_login",
      }),
    ).resolves.toBe(true);
    await expect(
      service.verifyAndConsume({
        phone: "13800138000",
        code: "246810",
        purpose: "admin_login",
      }),
    ).resolves.toBe(false);
  });

  it("blocks the correct code after five failed attempts", async () => {
    await service.send({ phone: "13800138000", purpose: "admin_login" });

    await Array.from({ length: 5 }).reduce(async (previousAttempt) => {
      await previousAttempt;
      await expect(
        service.verifyAndConsume({
          phone: "13800138000",
          code: "000000",
          purpose: "admin_login",
        }),
      ).resolves.toBe(false);
    }, Promise.resolve());

    await expect(
      service.verifyAndConsume({
        phone: "13800138000",
        code: "246810",
        purpose: "admin_login",
      }),
    ).resolves.toBe(false);
  });

  it("enforces the send cooldown", async () => {
    await service.send({ phone: "13800138000", purpose: "admin_login" });

    await expect(
      service.send({ phone: "13800138000", purpose: "admin_login" }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED", status: 429 });
  });

  it("enforces the hourly send limit", async () => {
    await Array.from({ length: smsHourlyLimit }).reduce(async (previousSend) => {
      await previousSend;
      await service.send({ phone: "13800138000", purpose: "admin_login" });
      redis.values.delete("auth:otp:cooldown:admin_login:13800138000");
    }, Promise.resolve());

    await expect(
      service.send({ phone: "13800138000", purpose: "admin_login" }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED", status: 429 });
  });

  it("does not consume a code issued for another purpose", async () => {
    await service.send({ phone: "13800138000", purpose: "admin_login" });

    await expect(
      service.verifyAndConsume({
        phone: "13800138000",
        code: "246810",
        purpose: "miniapp_bind_phone",
      }),
    ).resolves.toBe(false);
  });

  it("limits one Miniapp subject across different destination phones", async () => {
    await Array.from({ length: smsHourlyLimit }).reduce(async (previousSend, _, index) => {
      await previousSend;
      await service.send({
        phone: `1760000000${index}`,
        purpose: "miniapp_bind_phone",
        subject: "user-1",
      });
    }, Promise.resolve());

    await expect(
      service.send({
        phone: "17600000009",
        purpose: "miniapp_bind_phone",
        subject: "user-1",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
  });

  it("does not charge a destination phone for subject-limited requests", async () => {
    await Array.from({ length: smsHourlyLimit }).reduce(async (previousSend, _, index) => {
      await previousSend;
      await service.send({
        phone: `1750000000${index}`,
        purpose: "miniapp_bind_phone",
        subject: "user-1",
      });
    }, Promise.resolve());

    await Array.from({ length: smsHourlyLimit }).reduce(async (previousSend) => {
      await previousSend;
      await expect(
        service.send({
          phone: "17500000009",
          purpose: "miniapp_bind_phone",
          subject: "user-1",
        }),
      ).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
    }, Promise.resolve());

    await expect(
      service.send({
        phone: "17500000009",
        purpose: "miniapp_bind_phone",
        subject: "user-2",
      }),
    ).resolves.toBeUndefined();
  });
});
