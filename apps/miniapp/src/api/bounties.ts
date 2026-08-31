import type {
  BountyListQuery,
  BountyProviderEligibility,
  BountySop,
  BountySopEvidenceKind,
  CreateBountyRequest,
  MyBounty,
  MyBountyIntent,
  MyBountyIntentListResponse,
  MyBountyListResponse,
  OwnerBountyIntentListResponse,
  PublicBounty,
  PublicBountyListResponse,
} from "@petcare/shared-types";
import { authorizedRequest, authorizedUpload } from "../state/session";
import { rawRequest } from "./request";
import type { UploadProgressHandler } from "./request";

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

/** Reads the authenticated account's server-derived provider qualification gate. */
export function getBountyProviderEligibility(): Promise<BountyProviderEligibility> {
  return authorizedRequest("/bounties/provider-eligibility");
}

/** Reads provider intents submitted by the authenticated account. */
export function getMyBountyIntents(query: BountyListQuery): Promise<MyBountyIntentListResponse> {
  return authorizedRequest(`/bounties/intents/mine?${queryString(query)}`);
}

/** Reads candidates for one bounty owned by the authenticated account. */
export function getBountyIntents(
  bountyId: string,
  query: BountyListQuery,
): Promise<OwnerBountyIntentListResponse> {
  return authorizedRequest(
    `/bounties/${encodeURIComponent(bountyId)}/intents?${queryString(query)}`,
  );
}

/** Creates or returns the authenticated provider's single intent for one bounty. */
export function submitBountyIntent(bountyId: string): Promise<MyBountyIntent> {
  return authorizedRequest(`/bounties/${encodeURIComponent(bountyId)}/intents`, {
    method: "POST",
  });
}

/** Confirms one candidate for a bounty owned by the authenticated account. */
export function confirmBountyIntent(bountyId: string, intentId: string): Promise<MyBounty> {
  return authorizedRequest(
    `/bounties/${encodeURIComponent(bountyId)}/intents/${encodeURIComponent(intentId)}/confirm`,
    { method: "POST" },
  );
}

/** Reads the frozen SOP for the authenticated owner or confirmed provider. */
export function getBountySop(bountyId: string): Promise<BountySop> {
  return authorizedRequest(`/bounties/${encodeURIComponent(bountyId)}/sop`);
}

/** Uploads one managed photo or MP4 to the current SOP step. */
export function uploadBountySopEvidence(
  bountyId: string,
  stepNumber: number,
  kind: BountySopEvidenceKind,
  filePath: string,
  onProgress?: UploadProgressHandler,
): Promise<BountySop> {
  return authorizedUpload(
    `/bounties/${encodeURIComponent(bountyId)}/sop/steps/${stepNumber}/evidence`,
    filePath,
    "file",
    { kind },
    onProgress,
  );
}

/** Completes the exact current SOP step after its frozen evidence requirements pass. */
export function completeBountySopStep(bountyId: string, stepNumber: number): Promise<BountySop> {
  return authorizedRequest(
    `/bounties/${encodeURIComponent(bountyId)}/sop/steps/${stepNumber}/complete`,
    { method: "POST" },
  );
}

/** Creates one exact-price bounty owned by the authenticated account. */
export function createBounty(request: CreateBountyRequest): Promise<MyBounty> {
  return authorizedRequest("/bounties", { method: "POST", data: request });
}
