import type {
  MyBounty,
  MyBountyIntent,
  MyBountyIntentBounty,
  MyBountyIntentListResponse,
  MyBountyListResponse,
} from "@petcare/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findOrderRecord } from "./order-data";

const bountyApi = vi.hoisted(() => ({
  getMyBounties: vi.fn(),
  getMyBountyIntents: vi.fn(),
}));

vi.mock("@/api/bounties", () => bountyApi);

const ownerBounty: MyBounty = {
  id: "owner-order",
  serviceType: "feeding",
  serviceTime: "2026-10-20T08:00:00.000Z",
  amountCents: 5800,
  status: "confirmed",
  address: "真实地址",
  remark: null,
  expiresAt: "2026-10-21T08:00:00.000Z",
  createdAt: "2026-10-17T08:00:00.000Z",
  pet: { id: "pet-1", name: "豆包", breed: "柯基", coverImage: null },
  provider: null,
};

const providerBounty: MyBountyIntentBounty = {
  id: "provider-order",
  serviceType: "walking",
  serviceTime: "2026-10-20T09:00:00.000Z",
  amountCents: 4200,
  status: "in_progress",
  expiresAt: "2026-10-21T09:00:00.000Z",
  owner: { nickname: "宠物主人", avatar: null },
  pet: { name: "咪咪", breed: "狸花猫", coverImage: null },
  address: "确认后返回的地址",
  remark: null,
};

function ownerResponse(list: MyBounty[], total: number, page: number): MyBountyListResponse {
  return { list, total, page, pageSize: 50 };
}

function intentResponse(
  list: MyBountyIntent[],
  total = list.length,
  page = 1,
): MyBountyIntentListResponse {
  return { list, total, page, pageSize: 50 };
}

afterEach(() => vi.resetAllMocks());

describe("order data projection", () => {
  it("finds an owner's real order across the owner list pages", async () => {
    bountyApi.getMyBounties
      .mockResolvedValueOnce(ownerResponse([], 51, 1))
      .mockResolvedValueOnce(ownerResponse([ownerBounty], 51, 2));

    const record = await findOrderRecord("owner-order", "owner");

    expect(record).toEqual({
      role: "owner",
      bounty: ownerBounty,
      createdAt: ownerBounty.createdAt,
    });
    expect(bountyApi.getMyBounties).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 50 });
    expect(bountyApi.getMyBounties).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 50 });
    expect(bountyApi.getMyBountyIntents).not.toHaveBeenCalled();
  });

  it("does not treat a pending provider intent as an order", async () => {
    const pendingIntent: MyBountyIntent = {
      id: "intent-1",
      status: "pending",
      createdAt: "2026-10-17T08:00:00.000Z",
      bounty: { ...providerBounty, id: "provider-order" },
    };

    bountyApi.getMyBountyIntents.mockResolvedValueOnce(intentResponse([pendingIntent]));

    const record = await findOrderRecord("provider-order", "provider");

    expect(record).toBeNull();
    expect(bountyApi.getMyBounties).not.toHaveBeenCalled();
  });

  it("projects only an owner's or a confirmed provider's server-returned order", async () => {
    const confirmedIntent: MyBountyIntent = {
      id: "intent-2",
      status: "confirmed",
      createdAt: "2026-10-17T08:30:00.000Z",
      bounty: providerBounty,
    };

    bountyApi.getMyBounties.mockResolvedValueOnce(ownerResponse([], 0, 1));
    bountyApi.getMyBountyIntents.mockResolvedValueOnce(intentResponse([confirmedIntent]));

    const record = await findOrderRecord("provider-order");

    expect(record).toEqual({
      role: "provider",
      bounty: providerBounty,
      createdAt: confirmedIntent.createdAt,
    });
  });
});
