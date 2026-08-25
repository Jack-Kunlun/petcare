import type { PublicUser } from "@petcare/shared-types";
import type { AxiosInstance } from "axios";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { UserAPI } from "./user";

describe("UserAPI public detail", () => {
  it("returns the unwrapped public user without a nested user object", async () => {
    const publicUser: PublicUser = {
      id: "user-1",
      nickname: "小白家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      profile: { region: null, bio: "喜欢猫咪" },
    };
    const get = vi.fn().mockResolvedValue({ data: publicUser });
    const api = new UserAPI({ get } as unknown as AxiosInstance);

    const response = await api.getUserDetail("user-1");

    expect(get).toHaveBeenCalledWith("/users/user-1");
    expect(response).toEqual(publicUser);
    expect(response).not.toHaveProperty("user");
    expectTypeOf(response).toEqualTypeOf<PublicUser>();
  });
});
