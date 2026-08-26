import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AdminContentPostStateDto } from "./admin-community-post.dto";

describe("AdminContentPostStateDto", () => {
  it("accepts a strict timestamp and trims an optional reason", async () => {
    const dto = plainToInstance(AdminContentPostStateDto, {
      expectedUpdatedAt: "2026-08-26T08:00:00.000Z",
      reason: "  包含联系方式  ",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.reason).toBe("包含联系方式");
  });

  it.each([
    ["non-strict timestamp", { expectedUpdatedAt: "yesterday" }],
    ["blank reason", { reason: " " }],
    ["overlong reason", { reason: "x".repeat(501) }],
  ])("rejects %s", async (_description, override) => {
    const dto = plainToInstance(AdminContentPostStateDto, {
      expectedUpdatedAt: "2026-08-26T08:00:00.000Z",
      ...override,
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
