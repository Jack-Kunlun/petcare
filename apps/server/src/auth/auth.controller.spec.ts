import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CaptchaService } from "./captcha.service";

describe("AuthController", () => {
  const user = {
    id: "user-1",
    username: "admin",
    phone: "17679141878",
    nickname: "系统管理员",
    roles: ["super_admin"],
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
    const config = { nodeEnv: "development", refreshTokenTtlSeconds: 604800 } as ConfigService;

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
      phone: "17679141878",
      captchaId: "0123456789abcdef",
      captchaCode: "2345",
    });

    expect(authService.sendSmsCode).toHaveBeenCalledWith("17679141878", "0123456789abcdef", "2345");
  });

  it("sets a secure-by-default refresh cookie and omits it from the response body", async () => {
    const result = await controller.loginWithPassword(
      { identifier: "admin", password: "Correct-Horse-Battery-Staple!42" },
      response as never,
    );

    expect(response.cookie).toHaveBeenCalledWith("petcare_refresh_token", "refresh", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/api/auth",
      maxAge: 604800000,
    });
    expect(result).toEqual({ accessToken: "access", user });
  });

  it("rotates the refresh cookie", async () => {
    const result = await controller.refresh(
      { cookies: { petcare_refresh_token: "old-refresh" } } as never,
      response as never,
    );

    expect(authService.refresh).toHaveBeenCalledWith("old-refresh");
    expect(response.cookie).toHaveBeenCalledWith(
      "petcare_refresh_token",
      "new-refresh",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result.accessToken).toBe("new-access");
  });

  it("rejects refresh without a cookie", async () => {
    await expect(
      controller.refresh({ cookies: {} } as never, response as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("revokes the session and clears the refresh cookie", async () => {
    await controller.logout(
      { cookies: { petcare_refresh_token: "refresh" } } as never,
      response as never,
    );

    expect(authService.logout).toHaveBeenCalledWith("refresh");
    expect(response.clearCookie).toHaveBeenCalledWith("petcare_refresh_token", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/api/auth",
    });
  });

  it("returns only safe current-user fields", async () => {
    await expect(controller.me({ user: { sub: "user-1" } } as never)).resolves.toEqual(user);
  });
});
