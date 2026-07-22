import { createHmac } from "node:crypto";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import { CaptchaService } from "./captcha.service";

const captchaAlphabet = "23456789";
const jwtSecret = "test-jwt-secret-that-is-at-least-32-characters";

class InMemoryCaptchaRedis {
  readonly values = new Map<string, string>();
  readonly verifyCalls: Array<{
    valueKey: string;
    attemptsKey: string;
    expectedDigest: string;
    maxAttempts: number;
  }> = [];

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async verifyAndConsumeDigest(
    valueKey: string,
    attemptsKey: string,
    expectedDigest: string,
    maxAttempts: number,
  ): Promise<boolean> {
    this.verifyCalls.push({ valueKey, attemptsKey, expectedDigest, maxAttempts });
    const matches = this.values.get(valueKey) === expectedDigest;

    if (matches) {
      this.values.delete(valueKey);
    }

    return matches;
  }
}

function digest(captchaId: string, answer: string): string {
  return createHmac("sha256", jwtSecret).update(`${captchaId}:${answer}`).digest("hex");
}

function recoverTestAnswer(captchaId: string, storedDigest: string): string {
  for (const first of captchaAlphabet) {
    for (const second of captchaAlphabet) {
      for (const third of captchaAlphabet) {
        for (const fourth of captchaAlphabet) {
          const answer = `${first}${second}${third}${fourth}`;

          if (digest(captchaId, answer) === storedDigest) {
            return answer;
          }
        }
      }
    }
  }

  throw new Error("Generated captcha digest did not match the documented alphabet");
}

describe("CaptchaService", () => {
  let redis: InMemoryCaptchaRedis;
  let service: CaptchaService;

  beforeEach(() => {
    redis = new InMemoryCaptchaRedis();
    const config = {
      jwtSecret,
      captchaTtlSeconds: 300,
      captchaMaxAttempts: 5,
    } as ConfigService;

    service = new CaptchaService(redis as unknown as RedisService, config);
  });

  it("creates an opaque SVG challenge and stores only its digest", async () => {
    const challenge = await service.create();
    const storedDigest = redis.values.get(`auth:captcha:${challenge.captchaId}`);
    const svg = Buffer.from(challenge.image.split(",")[1], "base64").toString("utf8");

    expect(challenge.captchaId).toMatch(/^[a-f0-9]{32}$/);
    expect(challenge.image).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(challenge.expiresIn).toBe(300);
    expect(storedDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("data-answer");
  });

  it("consumes a correct answer only once", async () => {
    const challenge = await service.create();
    const storedDigest = redis.values.get(`auth:captcha:${challenge.captchaId}`);
    const answer = recoverTestAnswer(challenge.captchaId, storedDigest!);

    await expect(service.verifyAndConsume(challenge.captchaId, answer)).resolves.toBe(true);
    await expect(service.verifyAndConsume(challenge.captchaId, answer)).resolves.toBe(false);
  });

  it("rejects a wrong answer and applies the configured attempt limit", async () => {
    const challenge = await service.create();

    await expect(service.verifyAndConsume(challenge.captchaId, "2222")).resolves.toBe(false);
    expect(redis.verifyCalls[redis.verifyCalls.length - 1]).toMatchObject({
      valueKey: `auth:captcha:${challenge.captchaId}`,
      attemptsKey: `auth:captcha:attempts:${challenge.captchaId}`,
      maxAttempts: 5,
    });
  });
});
