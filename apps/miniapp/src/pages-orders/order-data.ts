import type { MyBounty, MyBountyIntentBounty } from "@petcare/shared-types";
import { getMyBounties, getMyBountyIntents } from "@/api/bounties";

export type OrderRole = "owner" | "provider";
export type OrderBounty = MyBounty | MyBountyIntentBounty;

export interface OrderRecord {
  role: OrderRole;
  bounty: OrderBounty;
  createdAt: string;
}

const ORDER_LOOKUP_PAGE_SIZE = 50;

async function findOwnedOrder(bountyId: string, page = 1): Promise<OrderRecord | null> {
  const response = await getMyBounties({ page, pageSize: ORDER_LOOKUP_PAGE_SIZE });
  const bounty = response.list.find((item) => item.id === bountyId);

  if (bounty) {
    return { role: "owner", bounty, createdAt: bounty.createdAt };
  }

  return page >= Math.ceil(response.total / response.pageSize)
    ? null
    : findOwnedOrder(bountyId, page + 1);
}

async function findProviderOrder(bountyId: string, page = 1): Promise<OrderRecord | null> {
  const response = await getMyBountyIntents({ page, pageSize: ORDER_LOOKUP_PAGE_SIZE });
  const intent = response.list.find(
    (item) => item.status === "confirmed" && item.bounty.id === bountyId,
  );

  if (intent) {
    return { role: "provider", bounty: intent.bounty, createdAt: intent.createdAt };
  }

  return page >= Math.ceil(response.total / response.pageSize)
    ? null
    : findProviderOrder(bountyId, page + 1);
}

/** Finds an order only in the authenticated owner's or confirmed provider's real projections. */
export async function findOrderRecord(
  bountyId: string,
  preferredRole?: OrderRole,
): Promise<OrderRecord | null> {
  if (preferredRole === "owner") {
    return findOwnedOrder(bountyId);
  }

  if (preferredRole === "provider") {
    return findProviderOrder(bountyId);
  }

  const [ownerResult, providerResult] = await Promise.allSettled([
    findOwnedOrder(bountyId),
    findProviderOrder(bountyId),
  ]);

  if (ownerResult.status === "fulfilled" && ownerResult.value) {
    return ownerResult.value;
  }

  if (providerResult.status === "fulfilled" && providerResult.value) {
    return providerResult.value;
  }

  if (ownerResult.status === "rejected") {
    throw ownerResult.reason;
  }

  if (providerResult.status === "rejected") {
    throw providerResult.reason;
  }

  return null;
}
