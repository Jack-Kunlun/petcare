import { createHmac } from "node:crypto";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import { PasswordLoginAttemptService } from "./password-login-attempt.service";

describe("PasswordLoginAttemptService", () => {
  const redis = {
    consumeFixedWindow: jest.fn(),
    del: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    jwtSecret: "test-secret",
    authPasswordMaxAttempts: 5,
    authPasswordWindowSeconds: 900,
  };
  const service = new PasswordLoginAttemptService(
    redis as unknown as RedisService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hashes a normalized identifier before consuming the window", async () => {
    redis.consumeFixedWindow.mockResolvedValue(true);

    await service.assertAllowed("  Admin  ");

    expect(redis.consumeFixedWindow).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:password:attempts:[a-f0-9]{64}$/u),
      5,
      900,
    );
    expect(redis.consumeFixedWindow.mock.calls[0][0]).not.toContain("admin");
  });

  it("uses the HMAC key for a canonically equivalent identifier", async () => {
    redis.consumeFixedWindow.mockResolvedValue(true);
    const expected = createHmac("sha256", config.jwtSecret).update("admin").digest("hex");

    await service.assertAllowed("  ＡＤＭＩＮ  ");

    expect(redis.consumeFixedWindow).toHaveBeenCalledWith(
      `auth:password:attempts:${expected}`,
      5,
      900,
    );
  });

  it("returns a stable 429 after the limit", async () => {
    redis.consumeFixedWindow.mockResolvedValue(false);

    await expect(service.assertAllowed("admin")).rejects.toMatchObject({
      code: "RATE_LIMIT_EXCEEDED",
      clientMessage: "登录尝试过于频繁，请稍后重试",
      status: 429,
    });
  });
});
