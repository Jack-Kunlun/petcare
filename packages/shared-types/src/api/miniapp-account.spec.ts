import { describe, expect, expectTypeOf, it } from "vitest";
import {
  MINIAPP_ACCOUNT_ERROR_CODE,
  type BindMiniappPhoneRequest,
  type MiniappUserProfile,
} from "./miniapp-account";

describe("miniapp account contract", () => {
  it("keeps full phone numbers out of the profile response", () => {
    const profile: MiniappUserProfile = {
      id: "user-1",
      nickname: "宠友123456",
      avatar: null,
      phoneMasked: "138****8000",
      profileComplete: true,
      userType: "pet_owner",
      region: null,
      bio: null,
    };

    expect(profile.phoneMasked).toBe("138****8000");
    expect("phone" in profile).toBe(false);
    expect(MINIAPP_ACCOUNT_ERROR_CODE.PROFILE_INCOMPLETE).toBe("PROFILE_INCOMPLETE");
    expectTypeOf<BindMiniappPhoneRequest>().toEqualTypeOf<{ phone: string; code: string }>();
  });

  it("publishes stable cancellation recovery codes", () => {
    expect(MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS).toBe("ACTIVE_ORDER_EXISTS");
    expect(MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_REQUIRED).toBe(
      "CANCELLATION_CODE_REQUIRED",
    );
    expect(MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_NOT_REQUIRED).toBe(
      "CANCELLATION_CODE_NOT_REQUIRED",
    );
  });
});
