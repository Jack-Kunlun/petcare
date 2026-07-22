import { createHmac, randomBytes, randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";

const captchaAlphabet = "23456789";

const segmentPaths = {
  a: "M3 1H15L13 4H5Z",
  b: "M15 3L18 5V15L15 17L13 14V6Z",
  c: "M15 17L18 19V29L15 31L13 28V20Z",
  d: "M3 33H15L13 30H5Z",
  e: "M0 19L3 17L5 20V28L3 31L0 29Z",
  f: "M0 5L3 3L5 6V14L3 17L0 15Z",
  g: "M3 17L5 15H13L15 17L13 19H5Z",
} as const;

type Segment = keyof typeof segmentPaths;

const digitSegments: Record<string, Segment[]> = {
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

export interface CaptchaChallenge {
  captchaId: string;
  image: string;
  expiresIn: number;
}

@Injectable()
export class CaptchaService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async create(): Promise<CaptchaChallenge> {
    const captchaId = randomBytes(16).toString("hex");
    const answer = Array.from(
      { length: 4 },
      () => captchaAlphabet[randomInt(0, captchaAlphabet.length)],
    ).join("");

    await this.redisService.set(
      this.valueKey(captchaId),
      this.digest(captchaId, answer),
      this.configService.captchaTtlSeconds,
    );

    return {
      captchaId,
      image: `data:image/svg+xml;base64,${Buffer.from(this.renderSvg(answer)).toString("base64")}`,
      expiresIn: this.configService.captchaTtlSeconds,
    };
  }

  async verifyAndConsume(captchaId: string, answer: string): Promise<boolean> {
    return this.redisService.verifyAndConsumeDigest(
      this.valueKey(captchaId),
      this.attemptsKey(captchaId),
      this.digest(captchaId, answer.trim()),
      this.configService.captchaMaxAttempts,
    );
  }

  private renderSvg(answer: string): string {
    const glyphs = [...answer]
      .map((digit, index) => {
        const paths = digitSegments[digit]
          .map((segment) => `<path d="${segmentPaths[segment]}"/>`)
          .join("");
        const x = 15 + index * 30 + randomInt(-2, 3);
        const y = 7 + randomInt(-2, 3);
        const rotation = randomInt(-8, 9);

        return `<g transform="translate(${x} ${y}) rotate(${rotation} 9 17)">${paths}</g>`;
      })
      .join("");
    const lines = Array.from({ length: 4 }, () => {
      const x1 = randomInt(0, 141);
      const y1 = randomInt(0, 49);
      const x2 = randomInt(0, 141);
      const y2 = randomInt(0, 49);

      return `<path d="M${x1} ${y1}L${x2} ${y2}"/>`;
    }).join("");
    const dots = Array.from({ length: 18 }, () => {
      const cx = randomInt(0, 141);
      const cy = randomInt(0, 49);
      const radius = randomInt(1, 3);

      return `<circle cx="${cx}" cy="${cy}" r="${radius}"/>`;
    }).join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="48" viewBox="0 0 140 48"><rect width="140" height="48" rx="8" fill="#eff6ff"/><g fill="#1d4ed8">${glyphs}</g><g fill="none" stroke="#60a5fa" stroke-width="1.2" opacity=".65">${lines}</g><g fill="#93c5fd" opacity=".65">${dots}</g></svg>`;
  }

  private digest(captchaId: string, answer: string): string {
    return createHmac("sha256", this.configService.jwtSecret)
      .update(`${captchaId}:${answer}`)
      .digest("hex");
  }

  private valueKey(captchaId: string): string {
    return `auth:captcha:${captchaId}`;
  }

  private attemptsKey(captchaId: string): string {
    return `auth:captcha:attempts:${captchaId}`;
  }
}
