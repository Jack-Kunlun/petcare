import { describe, expect, it, vi } from "vitest";

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

describe("Admin Axios response boundary", () => {
  it("unwraps successful envelopes before auth functions consume them", async () => {
    await import("./auth.api");
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
    await import("./auth.api");
    const onFulfilled = axiosMocks.responseUse.mock.calls[0]?.[0] as (response: {
      status: number;
      data: unknown;
    }) => { status: number; data: unknown };
    const response = { status: 204, data: "" };

    expect(onFulfilled(response).data).toBe("");
  });
});
