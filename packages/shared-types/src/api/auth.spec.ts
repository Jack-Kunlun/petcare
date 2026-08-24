import { expect, it } from "vitest";
import type { SendSmsCodeResponse } from "./auth";

it("defines the SMS cooldown returned by Server", () => {
  const response: SendSmsCodeResponse = {
    message: "如果该手机号可用于后台登录，验证码将会发送",
    cooldownSeconds: 60,
  };

  expect(response.cooldownSeconds).toBe(60);
});
