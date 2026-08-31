import { describe, expect, expectTypeOf, it } from "vitest";
import {
  BOUNTY_ERROR_CODE,
  BOUNTY_INTENT_STATUS,
  BOUNTY_INTENT_STATUS_LABELS,
  BOUNTY_LIMITS,
  BOUNTY_SERVICE_TYPE,
  BOUNTY_SERVICE_TYPE_LABELS,
  BOUNTY_SOP_EVIDENCE_KIND,
  BOUNTY_SOP_LIMITS,
  BOUNTY_STATUS,
  BOUNTY_STATUS_LABELS,
  type BountySop,
  type CreateBountyRequest,
  type MyBounty,
  type MyBountyIntent,
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
    expect(BOUNTY_STATUS.CONFIRMED).toBe("confirmed");
    expect(BOUNTY_STATUS_LABELS[BOUNTY_STATUS.CONFIRMED]).toBe("已确认服务者");
    expect(BOUNTY_INTENT_STATUS_LABELS[BOUNTY_INTENT_STATUS.PENDING]).toBe("等待主人确认");
    expect(BOUNTY_LIMITS).toMatchObject({
      AMOUNT_MIN_CENTS: 100,
      AMOUNT_MAX_CENTS: 100_000,
      PAGE_SIZE_MAX: 50,
    });
    expect(BOUNTY_SOP_EVIDENCE_KIND).toEqual({ PHOTO: "photo", VIDEO: "video" });
    expect(BOUNTY_SOP_LIMITS).toMatchObject({
      STEP_COUNT: 5,
      MAX_PHOTOS_PER_STEP: 9,
      MAX_VIDEOS_PER_STEP: 1,
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
      provider: null,
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

  it("keeps provider intent identity, state, and confirmation-scoped privacy explicit", () => {
    const intent: MyBountyIntent = {
      id: "33333333-3333-4333-8333-333333333333",
      status: BOUNTY_INTENT_STATUS.PENDING,
      createdAt: "2026-08-31T02:00:00.000Z",
      bounty: {
        id: "22222222-2222-4222-8222-222222222222",
        serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
        serviceTime: "2026-09-02T02:00:00.000Z",
        amountCents: 5_000,
        status: BOUNTY_STATUS.OPEN,
        expiresAt: "2026-09-01T02:00:00.000Z",
        owner: { nickname: "小萌", avatar: null },
        pet: { name: "米米", breed: "英短", coverImage: null },
        address: null,
        remark: null,
      },
    };

    expect(intent).toMatchObject({
      status: "pending",
      bounty: { status: "pending_confirm", address: null, remark: null },
    });
    expect(BOUNTY_ERROR_CODE.PROVIDER_NOT_ELIGIBLE).toBe("BOUNTY_PROVIDER_NOT_ELIGIBLE");
    expectTypeOf(intent).toEqualTypeOf<MyBountyIntent>();
  });

  it("describes an ordered private SOP without exposing writable configuration", () => {
    const sop: BountySop = {
      orderId: "22222222-2222-4222-8222-222222222222",
      orderStatus: BOUNTY_STATUS.CONFIRMED,
      currentStepNumber: 1,
      canExecute: true,
      steps: [
        {
          stepNumber: 1,
          stepName: "进门消毒",
          instruction: "完成消毒并拍照",
          expectedDurationMinutes: 2,
          minimumPhotoCount: 1,
          videoRequired: false,
          photos: [],
          videos: [],
          completedAt: null,
        },
      ],
    };

    expect(sop).toMatchObject({ currentStepNumber: 1, canExecute: true });
    expect(BOUNTY_ERROR_CODE.SOP_STEP_CONFLICT).toBe("BOUNTY_SOP_STEP_CONFLICT");
    expectTypeOf(sop).toEqualTypeOf<BountySop>();
  });
});
