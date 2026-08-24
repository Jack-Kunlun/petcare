import { beforeEach, describe, expect, it, vi } from "vitest";
import { onSessionExpired } from "../auth/session-expired";

const axiosMocks = vi.hoisted(() => {
  const requestUse = vi.fn();
  const responseUse = vi.fn();
  const client = Object.assign(vi.fn(), {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: requestUse },
      response: { use: responseUse },
    },
  });

  return { client, requestUse, responseUse };
});

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => axiosMocks.client),
  },
}));

function createExpiredSessionError(config: Record<string, unknown>) {
  return {
    config,
    response: {
      status: 401,
      data: { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" },
    },
  };
}

beforeEach(async () => {
  axiosMocks.client.mockClear();
  axiosMocks.client.post.mockClear();

  const authModule = await import("./auth");

  authModule.setAccessToken("test-access-token");
});

describe("Admin Axios response boundary", () => {
  it("returns the SMS cooldown after a protected send", async () => {
    const sent = {
      message: "如果该手机号可用于后台登录，验证码将会发送",
      cooldownSeconds: 60,
    };

    axiosMocks.client.post.mockResolvedValue({ data: sent });
    const authModule = await import("./auth");

    await expect(
      authModule.sendSmsCode("13800138000", "0123456789abcdef", "2345"),
    ).resolves.toEqual(sent);
    expect(axiosMocks.client.post).toHaveBeenCalledWith("/auth/sms/send", {
      phone: "13800138000",
      captchaId: "0123456789abcdef",
      captchaCode: "2345",
    });
  });

  it("unwraps successful envelopes before auth functions consume them", async () => {
    await import("./auth");
    const onFulfilled = axiosMocks.responseUse.mock.calls[0]?.[0] as (response: {
      status: number;
      data: unknown;
    }) => { status: number; data: unknown };
    const response = {
      status: 200,
      data: {
        code: "SUCCESS",
        message: "操作成功",
        data: { accessToken: "access" },
        meta: {
          requestId: "request-1",
          timestamp: "2026-07-22T14:00:00.000Z",
        },
      },
    };

    expect(onFulfilled(response).data).toEqual({ accessToken: "access" });
  });

  it("leaves 204 responses untouched", async () => {
    await import("./auth");
    const onFulfilled = axiosMocks.responseUse.mock.calls[0]?.[0] as (response: {
      status: number;
      data: unknown;
    }) => { status: number; data: unknown };
    const response = { status: 204, data: "" };

    expect(onFulfilled(response).data).toBe("");
  });

  it("refreshes and retries only expired sessions", async () => {
    await import("./auth");
    const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (error: {
      config: {
        headers: { has: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
        url: string;
      };
      response: { data: { code: string }; status: number };
    }) => Promise<unknown>;
    const request = {
      headers: { has: vi.fn(() => true), set: vi.fn() },
      url: "/admin/account/profile",
    };

    axiosMocks.client.post.mockResolvedValue({ data: { accessToken: "refreshed-access" } });
    axiosMocks.client.mockResolvedValue({ data: { id: "admin-1" } });

    await expect(
      onRejected({
        config: request,
        response: { data: { code: "AUTH_SESSION_EXPIRED" }, status: 401 },
      }),
    ).resolves.toEqual({ data: { id: "admin-1" } });

    expect(axiosMocks.client.post).toHaveBeenCalledTimes(1);
    expect(axiosMocks.client.post).toHaveBeenCalledWith("/auth/refresh");
    expect(request.headers.set).toHaveBeenCalledWith("Authorization", "Bearer refreshed-access");
    expect(axiosMocks.client).toHaveBeenCalledWith(request);
  });

  it("emits one session event when refresh cannot recover an authenticated request", async () => {
    await import("./auth");
    const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (
      error: Record<string, unknown>,
    ) => Promise<unknown>;
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    const refreshError = {
      response: {
        status: 401,
        data: { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" },
      },
    };

    axiosMocks.client.post.mockRejectedValue(refreshError);

    await expect(
      onRejected({
        config: {
          headers: { has: vi.fn(() => true), set: vi.fn() },
          url: "/admin/account/profile",
        },
        response: {
          status: 401,
          data: { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" },
        },
      }),
    ).rejects.toBe(refreshError);
    expect(listener).toHaveBeenCalledWith("登录状态已失效");
    unsubscribe();
  });

  it("emits one session event for concurrent requests sharing a failed refresh", async () => {
    await import("./auth");
    const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (
      error: Record<string, unknown>,
    ) => Promise<unknown>;
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    const refreshError = {
      response: {
        status: 401,
        data: { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" },
      },
    };
    const createError = () => ({
      config: {
        headers: { has: vi.fn(() => true), set: vi.fn() },
        url: "/admin/account/profile",
      },
      response: {
        status: 401,
        data: { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" },
      },
    });

    axiosMocks.client.post.mockRejectedValue(refreshError);
    const firstRequest = onRejected(createError());
    const secondRequest = onRejected(createError());

    await expect(firstRequest).rejects.toBe(refreshError);
    await expect(secondRequest).rejects.toBe(refreshError);
    expect(axiosMocks.client.post).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("登录状态已失效");
    unsubscribe();
  });

  it("emits a session event when a retried protected request expires again", async () => {
    await import("./auth");
    const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (
      error: Record<string, unknown>,
    ) => Promise<unknown>;
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    const error = {
      config: {
        headers: { has: vi.fn(() => true), set: vi.fn() },
        url: "/admin/account/profile",
        _authRetried: true,
      },
      response: {
        status: 401,
        data: { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" },
      },
    };

    await expect(onRejected(error)).rejects.toBe(error);

    expect(axiosMocks.client.post).not.toHaveBeenCalledWith("/auth/refresh");
    expect(listener).toHaveBeenCalledWith("登录状态已失效");
    unsubscribe();
  });

  it("emits one session event when concurrent retried requests expire after a shared refresh", async () => {
    const authModule = await import("./auth");
    const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (
      error: Record<string, unknown>,
    ) => Promise<unknown>;
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    const retryRejecters: Array<(reason?: unknown) => void> = [];
    const createRequest = () => ({
      headers: { has: vi.fn(() => true), set: vi.fn() },
      url: "/admin/account/profile",
    });

    authModule.setAccessToken("active-access");
    axiosMocks.client.post.mockResolvedValue({ data: { accessToken: "refreshed-access" } });
    axiosMocks.client.mockImplementation(
      () => new Promise((_, reject: (reason?: unknown) => void) => retryRejecters.push(reject)),
    );

    const firstRequest = createRequest();
    const secondRequest = createRequest();
    const firstInitialAttempt = onRejected(createExpiredSessionError(firstRequest));
    const secondInitialAttempt = onRejected(createExpiredSessionError(secondRequest));

    await vi.waitFor(() => {
      expect(axiosMocks.client.post).toHaveBeenCalledTimes(1);
      expect(axiosMocks.client).toHaveBeenCalledTimes(2);
      expect(retryRejecters).toHaveLength(2);
    });

    const firstRetryError = createExpiredSessionError(firstRequest);
    const secondRetryError = createExpiredSessionError(secondRequest);
    const firstRetryAttempt = onRejected(firstRetryError);
    const secondRetryAttempt = onRejected(secondRetryError);

    await expect(firstRetryAttempt).rejects.toBe(firstRetryError);
    await expect(secondRetryAttempt).rejects.toBe(secondRetryError);
    retryRejecters[0]?.(firstRetryError);
    retryRejecters[1]?.(secondRetryError);
    await expect(firstInitialAttempt).rejects.toBe(firstRetryError);
    await expect(secondInitialAttempt).rejects.toBe(secondRetryError);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("登录状态已失效");
    unsubscribe();
  });

  it("does not refresh or emit when explicit logout reports an expired session", async () => {
    await import("./auth");
    const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (error: {
      config: {
        headers: { has: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
        url: string;
      };
      response: { data: { code: string; message: string }; status: number };
    }) => Promise<unknown>;
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    const error = {
      config: {
        headers: { has: vi.fn(() => true), set: vi.fn() },
        url: "/auth/logout",
        _authRetried: true,
      },
      response: {
        status: 401,
        data: { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" },
      },
    };

    axiosMocks.client.post.mockRejectedValue(error);

    await expect(onRejected(error)).rejects.toBe(error);
    expect(axiosMocks.client.post).not.toHaveBeenCalledWith("/auth/refresh");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does not refresh requests sent without an access token", async () => {
    await import("./auth");
    const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (error: {
      config: {
        headers: { has: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
        url: string;
      };
      response: { data: { code: string }; status: number };
    }) => Promise<unknown>;
    const error = {
      config: {
        headers: { has: vi.fn(() => false), set: vi.fn() },
        url: "/admin/account/profile",
      },
      response: { data: { code: "AUTH_SESSION_EXPIRED" }, status: 401 },
    };
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(onRejected(error)).rejects.toBe(error);

    expect(axiosMocks.client.post).not.toHaveBeenCalledWith("/auth/refresh");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("rejects business 401 responses without refreshing", async () => {
    await import("./auth");
    const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (error: {
      config: { headers: { set: ReturnType<typeof vi.fn> }; url: string };
      response: { data: { code: string }; status: number };
    }) => Promise<unknown>;
    const error = {
      config: { headers: { set: vi.fn() }, url: "/admin/account/password" },
      response: { data: { code: "ACCOUNT_CURRENT_PASSWORD_INVALID" }, status: 401 },
    };
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(onRejected(error)).rejects.toBe(error);

    expect(axiosMocks.client.post).not.toHaveBeenCalledWith("/auth/refresh");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it.each(["/auth/login/password", "/auth/login/sms", "/auth/refresh"])(
    "does not refresh failed authentication requests to %s",
    async (url) => {
      await import("./auth");
      const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (error: {
        config: { headers: { set: ReturnType<typeof vi.fn> }; url: string };
        response: { data: { code: string }; status: number };
      }) => Promise<unknown>;
      const error = {
        config: { headers: { set: vi.fn() }, url },
        response: { data: { code: "AUTH_SESSION_EXPIRED" }, status: 401 },
      };
      const listener = vi.fn();
      const unsubscribe = onSessionExpired(listener);

      await expect(onRejected(error)).rejects.toBe(error);

      expect(axiosMocks.client.post).not.toHaveBeenCalledWith("/auth/refresh");
      expect(listener).not.toHaveBeenCalled();
      unsubscribe();
    },
  );
});
