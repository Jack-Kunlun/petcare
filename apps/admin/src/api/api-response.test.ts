import { describe, expect, it } from "vitest";
import { readApiErrorMessage, unwrapApiResponse } from "./api-response";

describe("Admin API response helpers", () => {
  it("unwraps successful data", () => {
    expect(
      unwrapApiResponse({
        code: "SUCCESS",
        message: "操作成功",
        data: { accessToken: "token" },
        meta: {
          requestId: "request-1",
          timestamp: "2026-07-22T14:00:00.000Z",
        },
      }),
    ).toEqual({ accessToken: "token" });
  });

  it("rejects malformed payloads", () => {
    expect(() => unwrapApiResponse({ accessToken: "legacy-token" })).toThrow("响应格式无效");
  });

  it("reads a safe server error message", () => {
    expect(readApiErrorMessage({ code: "VALIDATION_FAILED", message: "请求参数校验失败" })).toBe(
      "请求参数校验失败",
    );
    expect(readApiErrorMessage(null)).toBe("请求失败");
  });
});
