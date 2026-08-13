import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import { SessionValidationService } from "./session-validation.service";
import { TokenService } from "./token.service";

class InMemorySessionRedis {
  readonly values = new Map<string, string>();

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async getAndDelete(key: string): Promise<string | null> {
    const value = this.values.get(key) ?? null;

    this.values.delete(key);

    return value;
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.values.delete(key);
    }
  }
}

describe("TokenService", () => {
  const jwtSecret = "test-jwt-secret-that-is-at-least-32-characters";
  const principal = {
    userId: "user-1",
    username: "admin",
    phone: "13800138000",
    roles: ["super_admin"],
    sessionVersion: 2,
  };
  let jwtService: JwtService;
  let redis: InMemorySessionRedis;
  let sessionValidation: { assertActiveVersion: jest.Mock };
  let service: TokenService;

  beforeEach(() => {
    jwtService = new JwtService();
    redis = new InMemorySessionRedis();
    sessionValidation = { assertActiveVersion: jest.fn().mockResolvedValue(undefined) };
    const config = {
      jwtSecret,
      jwtAccessExpiresIn: "15m",
      jwtRefreshExpiresIn: "7d",
      refreshTokenTtlSeconds: 604800,
    } as ConfigService;

    service = new TokenService(
      jwtService,
      redis as unknown as RedisService,
      config,
      sessionValidation as unknown as SessionValidationService,
    );
  });

  it("issues typed access and refresh tokens and stores only a refresh digest", async () => {
    const tokens = await service.issue(principal);
    const accessPayload = await jwtService.verifyAsync(tokens.accessToken, { secret: jwtSecret });
    const refreshPayload = await jwtService.verifyAsync(tokens.refreshToken, { secret: jwtSecret });

    expect(accessPayload).toMatchObject({
      sub: "user-1",
      sid: refreshPayload.sid,
      sessionVersion: 2,
      type: "access",
      roles: ["super_admin"],
    });
    expect(refreshPayload).toMatchObject({
      sub: "user-1",
      sid: accessPayload.sid,
      sessionVersion: 2,
      type: "refresh",
    });
    expect(redis.values.get(`auth:session:${refreshPayload.sid}`)).toBeDefined();
    expect(redis.values.get(`auth:session:${refreshPayload.sid}`)).not.toBe(tokens.refreshToken);
  });

  it("consumes a refresh session exactly once", async () => {
    const tokens = await service.issue(principal);

    await expect(service.consumeRefresh(tokens.refreshToken)).resolves.toMatchObject({
      userId: "user-1",
    });
    await expect(service.consumeRefresh(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a refresh token whose account session version is stale", async () => {
    const tokens = await service.issue(principal);

    sessionValidation.assertActiveVersion.mockRejectedValue(new UnauthorizedException());

    await expect(service.consumeRefresh(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("allows only one concurrent refresh rotation", async () => {
    const tokens = await service.issue(principal);
    const results = await Promise.allSettled([
      service.consumeRefresh(tokens.refreshToken),
      service.consumeRefresh(tokens.refreshToken),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("revokes a refresh session during logout", async () => {
    const tokens = await service.issue(principal);

    await service.revoke(tokens.refreshToken);

    await expect(service.consumeRefresh(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("revokes only the selected session by id", async () => {
    const firstTokens = await service.issue(principal);
    const secondTokens = await service.issue(principal);
    const firstPayload = await jwtService.verifyAsync(firstTokens.refreshToken, { secret: jwtSecret });
    const secondPayload = await jwtService.verifyAsync(secondTokens.refreshToken, { secret: jwtSecret });

    await service.revokeSession(firstPayload.sid);

    expect(redis.values.has(`auth:session:${firstPayload.sid}`)).toBe(false);
    expect(redis.values.has(`auth:session:${secondPayload.sid}`)).toBe(true);
  });
});
