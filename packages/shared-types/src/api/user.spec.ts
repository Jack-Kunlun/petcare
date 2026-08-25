import { describe, expect, expectTypeOf, it } from "vitest";
import type { GetUserResponse, PublicUser } from "./user";

describe("public user contract", () => {
  it("contains only explicitly public fields", () => {
    const user: PublicUser = {
      id: "user-1",
      nickname: "小白家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      profile: { region: null, bio: "喜欢猫咪" },
    };

    expect(Object.keys(user).sort()).toEqual([
      "avatar",
      "id",
      "nickname",
      "profile",
      "status",
      "userType",
    ]);
    expect(Object.keys(user.profile ?? {}).sort()).toEqual(["bio", "region"]);
    expect(user).not.toHaveProperty("phone");
    expect(user).not.toHaveProperty("role");
    expect(user).not.toHaveProperty("createdAt");
    expect(user).not.toHaveProperty("updatedAt");
    expect(user.profile).not.toHaveProperty("address");
    expectTypeOf<GetUserResponse>().toEqualTypeOf<PublicUser>();
  });
});
