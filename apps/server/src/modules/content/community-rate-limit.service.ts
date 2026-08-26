import { HttpStatus, Injectable } from "@nestjs/common";
import { COMMUNITY_RATE_LIMIT_ERROR_CODE } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { RedisService } from "../../config/redis.service";

/** Enforces fail-closed fixed windows before community writes reach storage. */
@Injectable()
export class CommunityRateLimitService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  /** Consumes one community post creation allowance for the author. */
  assertPostCreateAllowed(authorId: string): Promise<void> {
    return this.assertAllowed(
      `community:post:create:${authorId}`,
      this.config.communityPostMaxAttempts,
      this.config.communityPostWindowSeconds,
      COMMUNITY_RATE_LIMIT_ERROR_CODE.POST_RATE_LIMITED,
      "动态发布过于频繁，请稍后重试",
    );
  }

  /** Consumes one community media upload allowance for the owner. */
  assertMediaUploadAllowed(ownerId: string): Promise<void> {
    return this.assertAllowed(
      `community:media:upload:${ownerId}`,
      this.config.communityMediaMaxAttempts,
      this.config.communityMediaWindowSeconds,
      COMMUNITY_RATE_LIMIT_ERROR_CODE.MEDIA_RATE_LIMITED,
      "图片上传过于频繁，请稍后重试",
    );
  }

  private async assertAllowed(
    key: string,
    maxAttempts: number,
    windowSeconds: number,
    code: string,
    message: string,
  ): Promise<void> {
    let allowed: boolean;

    try {
      allowed = await this.redis.consumeFixedWindow(key, maxAttempts, windowSeconds);
    } catch {
      throw new ApiException(
        COMMUNITY_RATE_LIMIT_ERROR_CODE.UNAVAILABLE,
        "社区发布保护暂时不可用，请稍后重试",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!allowed) {
      throw new ApiException(code, message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
