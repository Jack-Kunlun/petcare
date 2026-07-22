import { describe, expect, it } from "vitest";
import { ApiClientError, toApiClientError, unwrapApiResponse } from "./http";

describe("shared API response boundary", () => {
  it("returns domain data from a successful envelope", () => {
    expect(
      unwrapApiResponse<{ id: string }>({
        code: "SUCCESS",
        message: "操作成功",
        data: { id: "order-1" },
        meta: {
          requestId: "request-1",
          timestamp: "2026-07-22T14:00:00.000Z",
        },
      }),
    ).toEqual({ id: "order-1" });
  });

  it("rejects malformed successful responses", () => {
    expect(() => unwrapApiResponse({ code: 200, data: {} })).toThrowError(
      expect.objectContaining({
        name: "ApiClientError",
        code: "INVALID_RESPONSE",
        requestId: "unknown",
      }),
    );
  });

  it("creates a typed client error from an error envelope", () => {
    const error = toApiClientError(
      {
        code: "RESOURCE_NOT_FOUND",
        message: "资源不存在",
        data: null,
        meta: {
          requestId: "request-2",
          timestamp: "2026-07-22T14:00:00.000Z",
        },
      },
      404,
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      message: "资源不存在",
      requestId: "request-2",
      status: 404,
    });
  });
});
