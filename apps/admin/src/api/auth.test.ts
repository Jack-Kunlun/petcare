import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  axiosMocks.client.mockClear();
  axiosMocks.client.post.mockClear();
});

describe("Admin Axios response boundary", () => {
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

    await expect(onRejected(error)).rejects.toBe(error);

    expect(axiosMocks.client.post).not.toHaveBeenCalledWith("/auth/refresh");
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

    await expect(onRejected(error)).rejects.toBe(error);

    expect(axiosMocks.client.post).not.toHaveBeenCalledWith("/auth/refresh");
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

      await expect(onRejected(error)).rejects.toBe(error);

      expect(axiosMocks.client.post).not.toHaveBeenCalledWith("/auth/refresh");
    },
  );
});
