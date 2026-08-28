import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  BindMiniappPhoneDto,
  CancelMiniappAccountDto,
  SendMiniappPhoneCodeDto,
  UpdateMiniappProfileDto,
} from "./miniapp-account.dto";

describe("Miniapp account DTOs", () => {
  it("accepts nullable profile fields and rejects omitted ones", async () => {
    const valid = plainToInstance(UpdateMiniappProfileDto, {
      nickname: "家长甲",
      region: null,
      bio: null,
    });
    const missing = plainToInstance(UpdateMiniappProfileDto, { nickname: "家长甲" });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(missing)).resolves.not.toHaveLength(0);
  });

  it("accepts only mainland mobile numbers and six-digit codes", async () => {
    await expect(
      validate(plainToInstance(SendMiniappPhoneCodeDto, { phone: "13800138000" })),
    ).resolves.toHaveLength(0);
    await expect(
      validate(plainToInstance(SendMiniappPhoneCodeDto, { phone: "12345" })),
    ).resolves.not.toHaveLength(0);
    await expect(
      validate(plainToInstance(BindMiniappPhoneDto, { phone: "13800138000", code: "123456" })),
    ).resolves.toHaveLength(0);
    await expect(
      validate(plainToInstance(BindMiniappPhoneDto, { phone: "13800138000", code: "12345x" })),
    ).resolves.not.toHaveLength(0);
  });

  it.each([
    [SendMiniappPhoneCodeDto, { phone: "+8613800138000" }],
    [SendMiniappPhoneCodeDto, { phone: "008613800138000" }],
    [BindMiniappPhoneDto, { phone: "+8613800138000", code: "123456" }],
    [BindMiniappPhoneDto, { phone: "008613800138000", code: "123456" }],
  ])("rejects non-canonical phone representation %#", async (Dto, input) => {
    await expect(validate(plainToInstance(Dto, input))).resolves.not.toHaveLength(0);
  });

  it("accepts an omitted or six-digit cancellation code and rejects other bodies", async () => {
    await expect(validate(plainToInstance(CancelMiniappAccountDto, {}))).resolves.toHaveLength(0);
    await expect(
      validate(plainToInstance(CancelMiniappAccountDto, { code: "123456" })),
    ).resolves.toHaveLength(0);
    await expect(
      validate(plainToInstance(CancelMiniappAccountDto, { code: "12345x" })),
    ).resolves.not.toHaveLength(0);
    await expect(
      validate(plainToInstance(CancelMiniappAccountDto, { code: null })),
    ).resolves.not.toHaveLength(0);
  });
});
