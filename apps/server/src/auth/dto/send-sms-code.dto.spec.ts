import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SendSmsCodeDto } from "./send-sms-code.dto";

describe("SendSmsCodeDto", () => {
  it("accepts a phone with a captcha identifier and four digits from 2 through 9", async () => {
    const dto = plainToInstance(SendSmsCodeDto, {
      phone: "17679141878",
      captchaId: "0123456789abcdef",
      captchaCode: "2345",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    ["short identifier", { captchaId: "short", captchaCode: "2345" }],
    ["ambiguous digit", { captchaId: "0123456789abcdef", captchaCode: "2015" }],
    ["letters", { captchaId: "0123456789abcdef", captchaCode: "ABCD" }],
  ])("rejects %s", async (_label, captchaFields) => {
    const dto = plainToInstance(SendSmsCodeDto, {
      phone: "17679141878",
      ...captchaFields,
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
