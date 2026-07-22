import { describe, expect, it } from "vitest";
import { errorResponse, successResponse } from "./response";

const meta = {
  requestId: "req-contract-1",
  timestamp: "2026-07-22T14:00:00.000Z",
};

describe("API response contract", () => {
  it("creates the unified success envelope", () => {
    expect(successResponse({ id: "user-1" }, meta)).toEqual({
      code: "SUCCESS",
      message: "操作成功",
      data: { id: "user-1" },
      meta,
    });
  });

  it("creates the unified error envelope", () => {
    expect(errorResponse("AUTH_INVALID_CREDENTIALS", "账号或凭据错误", meta)).toEqual({
      code: "AUTH_INVALID_CREDENTIALS",
      message: "账号或凭据错误",
      data: null,
      meta,
    });
  });
});
