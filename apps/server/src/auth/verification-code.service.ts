import { createHmac, randomInt } from "node:crypto";
import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import { SMS_SENDER, SmsSender } from "./sms/sms-sender";

export type VerificationPurpose = "admin_login" | "miniapp_bind_phone" | "miniapp_cancel_account";

interface SendVerificationCodeInput {
  phone: string;
  purpose: VerificationPurpose;
  subject?: string;
}

interface VerifyVerificationCodeInput {
  phone: string;
  code: string;
  purpose: VerificationPurpose;
}

@Injectable()
export class VerificationCodeService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
  ) {}

  async send({ phone, purpose, subject }: SendVerificationCodeInput): Promise<void> {
    const cooldownKey = this.cooldownKey(phone, purpose);
    const cooldownCreated = await this.redisService.setIfAbsent(
      cooldownKey,
      "1",
      this.configService.smsSendCooldownSeconds,
    );

    if (!cooldownCreated) {
      this.throwTooManyRequests();
    }

    const hourlyKey = this.hourlyKey(phone, purpose);
    const hourlyCount = await this.redisService.increment(hourlyKey);

    if (hourlyCount === 1) {
      await this.redisService.expire(hourlyKey, 3600);
    }

    if (hourlyCount > this.configService.smsHourlyLimit) {
      await this.redisService.del(cooldownKey);
      this.throwTooManyRequests();
    }

    if (
      subject &&
      !(await this.redisService.consumeFixedWindow(
        this.subjectHourlyKey(subject, purpose),
        this.configService.smsHourlyLimit,
        3600,
      ))
    ) {
      await this.redisService.del(cooldownKey);
      this.throwTooManyRequests();
    }

    const code = this.configService.smsDevCode ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
    const otpKey = this.otpKey(phone, purpose);
    const attemptsKey = this.attemptsKey(phone, purpose);

    await this.redisService.set(
      otpKey,
      this.digest(phone, code, purpose),
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

  async verifyAndConsume({ phone, code, purpose }: VerifyVerificationCodeInput): Promise<boolean> {
    return this.redisService.verifyAndConsumeOtp(
      this.otpKey(phone, purpose),
      this.attemptsKey(phone, purpose),
      this.digest(phone, code, purpose),
      this.configService.smsMaxAttempts,
    );
  }

  private digest(phone: string, code: string, purpose: VerificationPurpose): string {
    return createHmac("sha256", this.configService.jwtSecret)
      .update(`${purpose}:${phone}:${code}`)
      .digest("hex");
  }

  private otpKey(phone: string, purpose: VerificationPurpose): string {
    return `auth:otp:${purpose}:${phone}`;
  }

  private attemptsKey(phone: string, purpose: VerificationPurpose): string {
    return `auth:otp:attempts:${purpose}:${phone}`;
  }

  private cooldownKey(phone: string, purpose: VerificationPurpose): string {
    return `auth:otp:cooldown:${purpose}:${phone}`;
  }

  private hourlyKey(phone: string, purpose: VerificationPurpose): string {
    return `auth:otp:hour:${purpose}:${phone}`;
  }

  private subjectHourlyKey(subject: string, purpose: VerificationPurpose): string {
    return `auth:otp:subject-hour:${purpose}:${subject}`;
  }

  private throwTooManyRequests(): never {
    throw new ApiException(
      "RATE_LIMIT_EXCEEDED",
      "验证码发送过于频繁",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
