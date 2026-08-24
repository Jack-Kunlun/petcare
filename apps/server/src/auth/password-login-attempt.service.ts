import { createHmac } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";

@Injectable()
export class PasswordLoginAttemptService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async assertAllowed(identifier: string): Promise<void> {
    const allowed = await this.redis.consumeFixedWindow(
      this.key(identifier),
      this.config.authPasswordMaxAttempts,
      this.config.authPasswordWindowSeconds,
    );

    if (!allowed) {
      throw new ApiException(
        "RATE_LIMIT_EXCEEDED",
        "登录尝试过于频繁，请稍后重试",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  clear(identifier: string): Promise<void> {
    return this.redis.del(this.key(identifier));
  }

  private key(identifier: string): string {
    const normalized = identifier.normalize("NFKC").trim().toLowerCase();
    const digest = createHmac("sha256", this.config.jwtSecret).update(normalized).digest("hex");

    return `auth:password:attempts:${digest}`;
  }
}
