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

  it("reads a server message from an Axios-shaped error", () => {
    expect(readApiErrorMessage({ response: { data: { message: "文章状态已变化" } } })).toBe(
      "文章状态已变化",
    );
    expect(readApiErrorMessage(new Error("internal detail"))).toBe("请求失败，请稍后重试");
  });
});
