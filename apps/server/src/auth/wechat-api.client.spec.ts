import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import { WechatApiClient } from "./wechat-api.client";

describe("WechatApiClient", () => {
  const config = {
    wechatAppId: "wx1234567890abcdef",
    wechatAppSecret: "0123456789abcdef0123456789abcdef",
  } as ConfigService;
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
  } as unknown as RedisService;
  let client: WechatApiClient;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.mocked(redis.get).mockReset().mockResolvedValue(null);
    jest.mocked(redis.set).mockReset().mockResolvedValue(undefined);
    client = new WechatApiClient(config, redis);
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

  it("uses a cached access token to obtain the authorized phone number", async () => {
    jest.mocked(redis.get).mockResolvedValue("cached-access-token");
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          errcode: 0,
          phone_info: { purePhoneNumber: "17679141878" },
        }),
        { status: 200 },
      ),
    );

    await expect(client.getPhoneNumber("phone-code")).resolves.toBe("17679141878");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("access_token=cached-access-token"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "phone-code" }),
      }),
    );
  });

  it("fetches and caches a missing access token with a safety margin", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/cgi-bin/token")) {
        return new Response(
          JSON.stringify({ access_token: "new-access-token", expires_in: 7200 }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({ errcode: 0, phone_info: { purePhoneNumber: "17679141878" } }),
        { status: 200 },
      );
    });

    await expect(client.getPhoneNumber("phone-code")).resolves.toBe("17679141878");
    expect(redis.set).toHaveBeenCalledWith("auth:wechat:access-token", "new-access-token", 7140);
  });

  it("maps an invalid phone authorization to a stable client error", async () => {
    jest.mocked(redis.get).mockResolvedValue("cached-access-token");
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ errcode: 40001, errmsg: "invalid credential" }), {
        status: 200,
      }),
    );

    await expect(client.getPhoneNumber("bad-phone-code")).rejects.toMatchObject({
      code: "AUTH_PHONE_AUTH_FAILED",
      status: 400,
    });
  });

  it.each([
    ["missing configuration", { wechatAppId: "", wechatAppSecret: "" } as ConfigService],
    ["network failure", config],
  ])("maps %s to a stable upstream error", async (_name, testConfig) => {
    if (testConfig === config) {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("network failed"));
    }

    const testClient = new WechatApiClient(testConfig, redis);

    await expect(testClient.exchangeLoginCode("login-code")).rejects.toMatchObject({
      code: "WECHAT_SERVICE_UNAVAILABLE",
      status: 503,
    });
  });
});
