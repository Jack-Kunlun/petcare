import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { AccessTokenPayload } from "./auth.types";
import { JwtStrategy } from "./jwt.strategy";
import { SessionValidationService } from "./session-validation.service";

describe("JwtStrategy", () => {
  const config = {
    jwtSecret: "test-jwt-secret-that-is-at-least-32-characters",
  } as ConfigService;
  let sessionValidation: { assertActiveVersion: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    sessionValidation = { assertActiveVersion: jest.fn().mockResolvedValue(undefined) };
    strategy = new JwtStrategy(config, sessionValidation as unknown as SessionValidationService);
  });

  it("accepts a current access session without requiring an administrator role", async () => {
    const payload = {
      sub: "user-1",
      sid: "session-1",
      sessionVersion: 3,
      username: null,
      phone: "17679141878",
      roles: [],
      type: "access" as const,
    };

    await expect(strategy.validate(payload)).resolves.toEqual(payload);
    expect(sessionValidation.assertActiveVersion).toHaveBeenCalledWith("user-1", 3);
  });

  it("rejects an access token without a session id", async () => {
    await expect(
      strategy.validate({
        sub: "user-1",
        sessionVersion: 3,
        username: null,
        phone: "17679141878",
        roles: [],
        type: "access",
      } as unknown as AccessTokenPayload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionValidation.assertActiveVersion).not.toHaveBeenCalled();
  });

  it("rejects a stale session version", async () => {
    const staleSession = new UnauthorizedException("登录状态已失效");

    sessionValidation.assertActiveVersion.mockRejectedValue(staleSession);

    await expect(
      strategy.validate({
        sub: "user-1",
        sid: "session-1",
        sessionVersion: 2,
        username: null,
        phone: "17679141878",
        roles: [],
        type: "access",
      }),
    ).rejects.toBe(staleSession);
  });
});
