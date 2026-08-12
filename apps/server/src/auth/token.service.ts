import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import {
  AccessTokenPayload,
  AuthTokens,
  RefreshTokenPayload,
  SessionPrincipal,
} from "./auth.types";
import { SessionValidationService } from "./session-validation.service";

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly sessionValidationService: SessionValidationService,
  ) {}

  async issue(principal: SessionPrincipal): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const accessPayload: AccessTokenPayload = {
      sub: principal.userId,
      sid: sessionId,
      sessionVersion: principal.sessionVersion,
      username: principal.username,
      phone: principal.phone,
      roles: principal.roles,
      type: "access",
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: principal.userId,
      sid: sessionId,
      sessionVersion: principal.sessionVersion,
      type: "refresh",
    };
    const signOptions = { secret: this.configService.jwtSecret };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        ...signOptions,
        expiresIn: this.configService.jwtAccessExpiresIn as JwtSignOptions["expiresIn"],
      }),
      this.jwtService.signAsync(refreshPayload, {
        ...signOptions,
        expiresIn: this.configService.jwtRefreshExpiresIn as JwtSignOptions["expiresIn"],
      }),
    ]);

    await this.redisService.set(
      this.sessionKey(sessionId),
      this.digest(refreshToken),
      this.configService.refreshTokenTtlSeconds,
    );

    return { accessToken, refreshToken };
  }

  async consumeRefresh(refreshToken: string): Promise<{ userId: string; sessionId: string }> {
    const payload = await this.verifyRefresh(refreshToken);

    await this.sessionValidationService.assertActiveVersion(payload.sub, payload.sessionVersion);
    const key = this.sessionKey(payload.sid);
    const storedDigest = await this.redisService.getAndDelete(key);

    if (!storedDigest || !this.digestMatches(storedDigest, this.digest(refreshToken))) {
      throw this.unauthorized();
    }

    return { userId: payload.sub, sessionId: payload.sid };
  }

  async revoke(refreshToken: string): Promise<void> {
    try {
      const payload = await this.verifyRefresh(refreshToken);

      await this.revokeSession(payload.sid);
    } catch {
      return;
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.redisService.del(this.sessionKey(sessionId));
  }

  private async verifyRefresh(refreshToken: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.jwtSecret,
      });

      if (
        payload.type !== "refresh" ||
        !payload.sub ||
        !payload.sid ||
        !Number.isInteger(payload.sessionVersion)
      ) {
        throw this.unauthorized();
      }

      return payload;
    } catch {
      throw this.unauthorized();
    }
  }

  private digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private digestMatches(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private sessionKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException("登录状态已失效");
  }
}
