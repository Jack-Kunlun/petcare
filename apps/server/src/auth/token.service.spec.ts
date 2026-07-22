import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import { TokenService } from "./token.service";

class InMemorySessionRedis {
  readonly values = new Map<string, string>();

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
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
    phone: "17679141878",
    roles: ["super_admin"],
  };
  let jwtService: JwtService;
  let redis: InMemorySessionRedis;
  let service: TokenService;

  beforeEach(() => {
    jwtService = new JwtService();
    redis = new InMemorySessionRedis();
    const config = {
      jwtSecret,
      jwtAccessExpiresIn: "15m",
      jwtRefreshExpiresIn: "7d",
      refreshTokenTtlSeconds: 604800,
    } as ConfigService;

    service = new TokenService(jwtService, redis as unknown as RedisService, config);
  });

  it("issues typed access and refresh tokens and stores only a refresh digest", async () => {
    const tokens = await service.issue(principal);
    const accessPayload = await jwtService.verifyAsync(tokens.accessToken, { secret: jwtSecret });
    const refreshPayload = await jwtService.verifyAsync(tokens.refreshToken, { secret: jwtSecret });

    expect(accessPayload).toMatchObject({ sub: "user-1", type: "access", roles: ["super_admin"] });
    expect(refreshPayload).toMatchObject({ sub: "user-1", type: "refresh" });
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

  it("revokes a refresh session during logout", async () => {
    const tokens = await service.issue(principal);

    await service.revoke(tokens.refreshToken);

    await expect(service.consumeRefresh(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
