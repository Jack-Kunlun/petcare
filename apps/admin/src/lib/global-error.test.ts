import { beforeEach, describe, expect, it } from "vitest";
import { dismissGlobalError, getGlobalErrorSnapshot, showGlobalError } from "./global-error";

describe("global error store", () => {
  beforeEach(() => dismissGlobalError());

  it("keeps the first normal error and drops later normal errors", () => {
    showGlobalError("第一个错误");
    showGlobalError("第二个错误");

    expect(getGlobalErrorSnapshot()?.message).toBe("第一个错误");
  });

  it("lets a session error replace the current error", () => {
    showGlobalError("普通错误");
    showGlobalError("登录状态已失效", "session");
    showGlobalError("稍后的普通错误");

    expect(getGlobalErrorSnapshot()).toMatchObject({
      message: "登录状态已失效",
      priority: "session",
    });
  });
});
