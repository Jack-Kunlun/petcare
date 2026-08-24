import { ConfigService } from "../config/config.service";
import { WechatApiClient } from "./wechat-api.client";

describe("WechatApiClient", () => {
  const config = {
    wechatAppId: "wx1234567890abcdef",
    wechatAppSecret: "0123456789abcdef0123456789abcdef",
  } as ConfigService;
  let client: WechatApiClient;

  beforeEach(() => {
    jest.restoreAllMocks();
    client = new WechatApiClient(config);
  });

  it("exchanges a login code without exposing credentials in the result", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ openid: "openid-1", session_key: "session-key" }), {
        status: 200,
      }),
    );

    await expect(client.exchangeLoginCode("login-code")).resolves.toEqual({
      openid: "openid-1",
      sessionKey: "session-key",
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/sns/jscode2session?"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("maps a rejected login code to a stable authentication error", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ errcode: 40029, errmsg: "invalid code" }), { status: 200 }),
      );

    await expect(client.exchangeLoginCode("bad-code")).rejects.toMatchObject({
      code: "AUTH_WECHAT_LOGIN_FAILED",
      status: 401,
    });
  });

  it.each([
    ["missing configuration", { wechatAppId: "", wechatAppSecret: "" } as ConfigService],
    ["network failure", config],
  ])("maps %s to a stable upstream error", async (_name, testConfig) => {
    if (testConfig === config) {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("network failed"));
    }

    const testClient = new WechatApiClient(testConfig);

    await expect(testClient.exchangeLoginCode("login-code")).rejects.toMatchObject({
      code: "WECHAT_SERVICE_UNAVAILABLE",
      status: 503,
    });
  });
});
