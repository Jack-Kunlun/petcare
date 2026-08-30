import type {
  BountyListQuery,
  CreateBountyRequest,
  MyBounty,
  MyBountyListResponse,
  PublicBounty,
  PublicBountyListResponse,
} from "@petcare/shared-types";
import { authorizedRequest } from "../state/session";
import { rawRequest } from "./request";

function queryString(query: BountyListQuery): string {
  return `page=${query.page}&pageSize=${query.pageSize}`;
}

/** Reads one public page through the anonymous-safe Server projection. */
export function getPublicBounties(query: BountyListQuery): Promise<PublicBountyListResponse> {
  return rawRequest(`/bounties?${queryString(query)}`);
}

/** Reads one anonymous-safe public bounty detail. */
export function getPublicBounty(id: string): Promise<PublicBounty> {
  return rawRequest(`/bounties/${encodeURIComponent(id)}`);
}

/** Reads one authenticated owner's private bounty page. */
export function getMyBounties(query: BountyListQuery): Promise<MyBountyListResponse> {
  return authorizedRequest(`/bounties/mine?${queryString(query)}`);
}

/** Creates one exact-price bounty owned by the authenticated account. */
export function createBounty(request: CreateBountyRequest): Promise<MyBounty> {
  return authorizedRequest("/bounties", { method: "POST", data: request });
}
