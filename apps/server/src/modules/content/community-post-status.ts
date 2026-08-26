import { ADMIN_CONTENT_POST_STATUS } from "@petcare/shared-types";
import type { CommunityPostStatus } from "@petcare/shared-types";

const statuses = new Set<string>(Object.values(ADMIN_CONTENT_POST_STATUS));

/** Maps the retired draft value to pending while rejecting unknown persisted states. */
export function normalizeCommunityPostStatus(status: string): CommunityPostStatus {
  const normalized = status === "draft" ? ADMIN_CONTENT_POST_STATUS.PENDING : status;

  if (!statuses.has(normalized)) {
    throw new Error(`Unsupported community post status: ${status}`);
  }

  return normalized as CommunityPostStatus;
}
