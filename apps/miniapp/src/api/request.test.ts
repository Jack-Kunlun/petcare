import Taro from "@tarojs/taro";
import { apiRequest, MiniappApiError } from "./request";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
  },
}));

describe("apiRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("unwraps a successful API envelope", async () => {
    jest.mocked(Taro.request).mockResolvedValue({
      statusCode: 200,
      data: {
        code: "SUCCESS",
        message: "操作成功",
        data: { value: 1 },
        meta: {
          requestId: "request-1",
          timestamp: "2026-07-28T00:00:00.000Z",
        },
      },
      header: {},
      cookies: [],
      errMsg: "request:ok",
    });

    await expect(apiRequest<{ value: number }>("/health")).resolves.toEqual({
      value: 1,
    });
    expect(Taro.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost:3000/health",
        method: "GET",
      }),
    );
  });

  it("maps an API error envelope to a stable error", async () => {
    jest.mocked(Taro.request).mockResolvedValue({
      statusCode: 401,
      data: {
        code: "AUTH_SESSION_EXPIRED",
        message: "登录状态已失效",
        data: null,
        meta: {
          requestId: "request-2",
          timestamp: "2026-07-28T00:00:00.000Z",
        },
      },
      header: {},
      cookies: [],
      errMsg: "request:ok",
    });

    await expect(apiRequest("/auth/wechat/me")).rejects.toEqual(
      expect.objectContaining({
        name: "MiniappApiError",
        code: "AUTH_SESSION_EXPIRED",
        status: 401,
        requestId: "request-2",
      }),
    );
  });

  it("rejects an invalid response structure without exposing request data", async () => {
    jest.mocked(Taro.request).mockResolvedValue({
      statusCode: 502,
      data: "<html>bad gateway</html>",
      header: {},
      cookies: [],
      errMsg: "request:ok",
    });

    await expect(
      apiRequest("/auth/wechat/login", {
        method: "POST",
        data: { loginCode: "secret-login-code" },
      }),
    ).rejects.toEqual(
      new MiniappApiError("INVALID_RESPONSE", "服务响应异常，请稍后重试", "unknown", 502),
    );
  });

  it("returns undefined for an empty 204 response", async () => {
    jest.mocked(Taro.request).mockResolvedValue({
      statusCode: 204,
      data: "",
      header: {},
      cookies: [],
      errMsg: "request:ok",
    });

    await expect(apiRequest<void>("/auth/wechat/logout", { method: "POST" })).resolves.toBe(
      undefined,
    );
  });
});
