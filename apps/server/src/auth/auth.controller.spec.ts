import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "../config/config.service";
import { AccessTokenGuard } from "./access-token.guard";
import { AdminGuard } from "./admin.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CaptchaService } from "./captcha.service";
import { REFRESH_COOKIE, refreshCookieOptions } from "./refresh-cookie";

describe("AuthController", () => {
  const user = {
    id: "user-1",
    username: "admin",
    phone: "13800138000",
    nickname: "系统管理员",
    roles: ["super_admin"],
    permissions: ["system.view", "system.publish"],
  };
  let authService: {
    sendSmsCode: jest.Mock;
    loginWithPassword: jest.Mock;
    loginWithSms: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    getCurrentUser: jest.Mock;
  };
  let response: { cookie: jest.Mock; clearCookie: jest.Mock };
  let captchaService: { create: jest.Mock };
  let controller: AuthController;

  beforeEach(() => {
    authService = {
      sendSmsCode: jest.fn().mockResolvedValue({ message: "sent" }),
      loginWithPassword: jest
        .fn()
        .mockResolvedValue({ accessToken: "access", refreshToken: "refresh", user }),
      loginWithSms: jest
        .fn()
        .mockResolvedValue({ accessToken: "access", refreshToken: "refresh", user }),
      refresh: jest
        .fn()
        .mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh", user }),
      logout: jest.fn().mockResolvedValue(undefined),
      getCurrentUser: jest.fn().mockResolvedValue(user),
    };
    response = { cookie: jest.fn(), clearCookie: jest.fn() };
    captchaService = {
      create: jest.fn().mockResolvedValue({
        captchaId: "0123456789abcdef",
        image: "data:image/svg+xml;base64,PHN2Zy8+",
        expiresIn: 300,
      }),
    };
    const config = {
      nodeEnv: "development",
      refreshTokenTtlSeconds: 604800,
      smsSendCooldownSeconds: 60,
    } as ConfigService;

    controller = new AuthController(
      authService as unknown as AuthService,
      config,
      captchaService as unknown as CaptchaService,
    );
  });

  it("creates a graphical captcha challenge", async () => {
    await expect(controller.getCaptcha()).resolves.toEqual({
      captchaId: "0123456789abcdef",
      image: "data:image/svg+xml;base64,PHN2Zy8+",
      expiresIn: 300,
    });
  });

  it("forwards graphical captcha fields when sending an SMS code", async () => {
    await controller.sendSmsCode({
      phone: "13800138000",
      captchaId: "0123456789abcdef",
      captchaCode: "2345",
    });

    expect(authService.sendSmsCode).toHaveBeenCalledWith("13800138000", "0123456789abcdef", "2345");
  });

  it("returns the configured cooldown after an accepted SMS request", async () => {
    await expect(
      controller.sendSmsCode({
        phone: "13800138000",
        captchaId: "0123456789abcdef",
        captchaCode: "2345",
      }),
    ).resolves.toEqual({ message: "sent", cooldownSeconds: 60 });
  });

  it("sets a secure-by-default refresh cookie and omits it from the response body", async () => {
    const result = await controller.loginWithPassword(
      { identifier: "admin", password: "Correct-Horse-Battery-Staple!42" },
      response as never,
    );

    expect(response.cookie).toHaveBeenCalledWith(REFRESH_COOKIE, "refresh", {
      ...refreshCookieOptions({ nodeEnv: "development" } as ConfigService),
      maxAge: 604800000,
    });
    expect(result).toEqual({ accessToken: "access", user });
  });

  it("rotates the refresh cookie", async () => {
    const result = await controller.refresh(
      { cookies: { [REFRESH_COOKIE]: "old-refresh" } } as never,
      response as never,
    );

    expect(authService.refresh).toHaveBeenCalledWith("old-refresh");
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      "new-refresh",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result.accessToken).toBe("new-access");
  });

  it("rejects refresh without a cookie", async () => {
    await expect(
      controller.refresh({ cookies: {} } as never, response as never),
    ).rejects.toMatchObject({
      code: "AUTH_SESSION_EXPIRED",
      clientMessage: "登录状态已失效",
    });
  });

  it("revokes the session and clears the refresh cookie", async () => {
    await controller.logout(
      { cookies: { [REFRESH_COOKIE]: "refresh" } } as never,
      response as never,
    );

    expect(authService.logout).toHaveBeenCalledWith("refresh");
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      refreshCookieOptions({ nodeEnv: "development" } as ConfigService),
    );
  });

  it("keeps refresh cookies limited to auth routes and enables secure delivery in production", () => {
    expect(refreshCookieOptions({ nodeEnv: "production" } as ConfigService)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/api/auth",
    });
  });

  it("returns only safe current-user fields", async () => {
    await expect(controller.me({ user: { sub: "user-1" } } as never)).resolves.toEqual(user);
  });

  it("allows any authenticated RBAC administrator to load their own profile", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.me) as unknown[];

    expect(guards).toContain(AccessTokenGuard);
    expect(guards).not.toContain(AdminGuard);
  });
});
