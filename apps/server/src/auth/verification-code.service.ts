import { createHmac, randomInt } from "node:crypto";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import { SMS_SENDER, SmsSender } from "./sms/sms-sender";

@Injectable()
export class VerificationCodeService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
  ) {}

  async send(phone: string): Promise<void> {
    const cooldownKey = this.cooldownKey(phone);
    const cooldownCreated = await this.redisService.setIfAbsent(
      cooldownKey,
      "1",
      this.configService.smsSendCooldownSeconds,
    );

    if (!cooldownCreated) {
      this.throwTooManyRequests();
    }

    const hourlyKey = this.hourlyKey(phone);
    const hourlyCount = await this.redisService.increment(hourlyKey);

    if (hourlyCount === 1) {
      await this.redisService.expire(hourlyKey, 3600);
    }

    if (hourlyCount > this.configService.smsHourlyLimit) {
      await this.redisService.del(cooldownKey);
      this.throwTooManyRequests();
    }

    const code = this.configService.smsDevCode ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
    const otpKey = this.otpKey(phone);
    const attemptsKey = this.attemptsKey(phone);

    await this.redisService.set(
      otpKey,
      this.digest(phone, code),
      this.configService.smsCodeTtlSeconds,
    );
    await this.redisService.del(attemptsKey);

    try {
      await this.smsSender.sendCode(phone, code);
    } catch (error) {
      await this.redisService.del(otpKey, cooldownKey);
      throw error;
    }
  }

  async verifyAndConsume(phone: string, code: string): Promise<boolean> {
    return this.redisService.verifyAndConsumeOtp(
      this.otpKey(phone),
      this.attemptsKey(phone),
      this.digest(phone, code),
      this.configService.smsMaxAttempts,
    );
  }

  private digest(phone: string, code: string): string {
    return createHmac("sha256", this.configService.jwtSecret)
      .update(`${phone}:${code}`)
      .digest("hex");
  }

  private otpKey(phone: string): string {
    return `auth:otp:${phone}`;
  }

  private attemptsKey(phone: string): string {
    return `auth:otp:attempts:${phone}`;
  }

  private cooldownKey(phone: string): string {
    return `auth:otp:cooldown:${phone}`;
  }

  private hourlyKey(phone: string): string {
    return `auth:otp:hour:${phone}`;
  }

  private throwTooManyRequests(): never {
    throw new ApiException(
      "RATE_LIMIT_EXCEEDED",
      "验证码发送过于频繁",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
