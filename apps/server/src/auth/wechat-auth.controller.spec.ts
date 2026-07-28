import { WechatAuthController } from "./wechat-auth.controller";
import { WechatAuthService } from "./wechat-auth.service";

describe("WechatAuthController", () => {
  const wechatAuthService = {
    login: jest.fn(),
    bindPhone: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
  };
  let controller: WechatAuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WechatAuthController(wechatAuthService as unknown as WechatAuthService);
  });

  it("delegates login codes without accepting an openid", async () => {
    wechatAuthService.login.mockResolvedValue({
      status: "phone_required",
      bindToken: "bind-token",
    });

    await expect(controller.login({ loginCode: "login-code" })).resolves.toEqual({
      status: "phone_required",
      bindToken: "bind-token",
    });
    expect(wechatAuthService.login).toHaveBeenCalledWith("login-code");
  });

  it("delegates phone binding challenges", async () => {
    wechatAuthService.bindPhone.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      user: { id: "user-1" },
    });

    await controller.bindPhone({
      bindToken: "bind-token",
      phoneCode: "phone-code",
    });

    expect(wechatAuthService.bindPhone).toHaveBeenCalledWith("bind-token", "phone-code");
  });

  it("passes refresh tokens in the request body", async () => {
    await controller.refresh({ refreshToken: "refresh-token" });

    expect(wechatAuthService.refresh).toHaveBeenCalledWith("refresh-token");
  });

  it("returns 204-compatible logout behavior", async () => {
    await expect(controller.logout({ refreshToken: "refresh-token" })).resolves.toBeUndefined();
    expect(wechatAuthService.logout).toHaveBeenCalledWith("refresh-token");
  });

  it("loads the current user from the access token subject", async () => {
    wechatAuthService.getCurrentUser.mockResolvedValue({ id: "user-1" });

    await controller.me({ user: { sub: "user-1" } } as never);

    expect(wechatAuthService.getCurrentUser).toHaveBeenCalledWith("user-1");
  });

  it("rejects a current-user request without a token subject", async () => {
    expect(() => controller.me({ user: {} } as never)).toThrow(
      expect.objectContaining({
        code: "AUTH_SESSION_EXPIRED",
        status: 401,
      }),
    );
  });
});
