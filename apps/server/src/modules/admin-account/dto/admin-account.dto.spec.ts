import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateAdminAccountProfileDto } from "./admin-account.dto";

describe("UpdateAdminAccountProfileDto", () => {
  it("accepts a non-empty nickname up to thirty characters", async () => {
    const dto = plainToInstance(UpdateAdminAccountProfileDto, { nickname: "运营管理员" });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    ["an empty nickname", ""],
    ["a nickname longer than thirty characters", "a".repeat(31)],
    ["a non-string nickname", 1],
  ])("rejects %s", async (_label, nickname) => {
    const dto = plainToInstance(UpdateAdminAccountProfileDto, { nickname });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
