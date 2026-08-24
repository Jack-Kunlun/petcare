import { WechatAuthController } from "./wechat-auth.controller";
import { WechatAuthService } from "./wechat-auth.service";

describe("WechatAuthController", () => {
  const wechatAuthService = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };
  let controller: WechatAuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WechatAuthController(wechatAuthService as unknown as WechatAuthService);
  });

  it("delegates login codes without accepting an openid", async () => {
    wechatAuthService.login.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: { id: "user-1", phoneMasked: null, profileComplete: false },
    });

    await expect(controller.login({ loginCode: "login-code" })).resolves.toMatchObject({
      accessToken: "access-token",
      user: { id: "user-1", phoneMasked: null, profileComplete: false },
    });
    expect(wechatAuthService.login).toHaveBeenCalledWith("login-code");
  });

  it("passes refresh tokens in the request body", async () => {
    await controller.refresh({ refreshToken: "refresh-token" });

    expect(wechatAuthService.refresh).toHaveBeenCalledWith("refresh-token");
  });

  it("returns 204-compatible logout behavior", async () => {
    await expect(controller.logout({ refreshToken: "refresh-token" })).resolves.toBeUndefined();
    expect(wechatAuthService.logout).toHaveBeenCalledWith("refresh-token");
  });
});
