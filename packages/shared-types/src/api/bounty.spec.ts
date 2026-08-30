import { describe, expect, expectTypeOf, it } from "vitest";
import {
  BOUNTY_ERROR_CODE,
  BOUNTY_LIMITS,
  BOUNTY_SERVICE_TYPE,
  BOUNTY_SERVICE_TYPE_LABELS,
  BOUNTY_STATUS,
  type CreateBountyRequest,
  type MyBounty,
  type PublicBounty,
} from "./bounty";

describe("bounty contracts", () => {
  it("keeps controlled values, cents, and privacy projections explicit", () => {
    expect(BOUNTY_SERVICE_TYPE_LABELS).toEqual({
      feeding: "上门喂养",
      walking: "遛狗",
      playing: "陪玩",
    });
    expect(Object.values(BOUNTY_SERVICE_TYPE)).toEqual(["feeding", "walking", "playing"]);
    expect(BOUNTY_STATUS.OPEN).toBe("pending_confirm");
    expect(BOUNTY_LIMITS).toMatchObject({
      AMOUNT_MIN_CENTS: 100,
      AMOUNT_MAX_CENTS: 100_000,
      PAGE_SIZE_MAX: 50,
    });
    expect(BOUNTY_ERROR_CODE.FEATURE_DISABLED).toBe("BOUNTY_FEATURE_DISABLED");

    const input: CreateBountyRequest = {
      petId: "11111111-1111-4111-8111-111111111111",
      serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
      serviceTime: "2026-09-02T02:00:00.000Z",
      amountCents: 5_000,
      address: "上海市示例地址",
      remark: "请换水",
    };
    const ownerOnly: MyBounty = {
      id: "22222222-2222-4222-8222-222222222222",
      serviceType: input.serviceType,
      serviceTime: input.serviceTime,
      amountCents: input.amountCents,
      status: BOUNTY_STATUS.OPEN,
      address: input.address,
      remark: input.remark ?? null,
      expiresAt: "2026-09-01T02:00:00.000Z",
      createdAt: "2026-08-30T02:00:00.000Z",
      pet: { id: input.petId, name: "米米", breed: "英短", coverImage: null },
    };
    const publicBounty: PublicBounty = {
      id: ownerOnly.id,
      serviceType: ownerOnly.serviceType,
      serviceTime: ownerOnly.serviceTime,
      amountCents: ownerOnly.amountCents,
      status: BOUNTY_STATUS.OPEN,
      expiresAt: ownerOnly.expiresAt,
      owner: { nickname: "小萌", avatar: null },
      pet: { name: ownerOnly.pet.name, breed: ownerOnly.pet.breed, coverImage: null },
    };

    expect(Object.keys(publicBounty).sort()).not.toContain("address");
    expect(Object.keys(publicBounty).sort()).not.toContain("remark");
    expect(ownerOnly).toMatchObject({ address: "上海市示例地址", remark: "请换水" });
    expectTypeOf(publicBounty).toEqualTypeOf<PublicBounty>();
  });
});
