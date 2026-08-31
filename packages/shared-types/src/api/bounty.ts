import type { PaginatedResponse } from "./response";

/** Service categories supported by the first bounty release. */
export const BOUNTY_SERVICE_TYPE = {
  /** In-home feeding and basic cleanup. */
  FEEDING: "feeding",
  /** Outdoor dog walking. */
  WALKING: "walking",
  /** In-home play and companionship. */
  PLAYING: "playing",
} as const;

/** Service category accepted by bounty APIs. */
export type BountyServiceType = (typeof BOUNTY_SERVICE_TYPE)[keyof typeof BOUNTY_SERVICE_TYPE];

/** User-facing labels for bounty service categories. */
export const BOUNTY_SERVICE_TYPE_LABELS: Record<BountyServiceType, string> = {
  [BOUNTY_SERVICE_TYPE.FEEDING]: "上门喂养",
  [BOUNTY_SERVICE_TYPE.WALKING]: "遛狗",
  [BOUNTY_SERVICE_TYPE.PLAYING]: "陪玩",
};

/** Persisted states used by bounty orders. */
export const BOUNTY_STATUS = {
  /** The owner is waiting to confirm one qualified provider. */
  OPEN: "pending_confirm",
  /** The owner has confirmed exactly one provider. */
  CONFIRMED: "confirmed",
  /** The confirmed provider is performing the service. */
  IN_PROGRESS: "in_progress",
  /** The order is paused for dispute handling. */
  DISPUTED: "disputed",
  /** The service has completed. */
  COMPLETED: "completed",
  /** The order was cancelled before completion. */
  CANCELLED: "cancelled",
} as const;

/** Persisted bounty order state exposed by APIs. */
export type BountyStatus = (typeof BOUNTY_STATUS)[keyof typeof BOUNTY_STATUS];

/** User-facing labels for persisted bounty order states. */
export const BOUNTY_STATUS_LABELS: Record<BountyStatus, string> = {
  [BOUNTY_STATUS.OPEN]: "待确认服务者",
  [BOUNTY_STATUS.CONFIRMED]: "已确认服务者",
  [BOUNTY_STATUS.IN_PROGRESS]: "服务中",
  [BOUNTY_STATUS.DISPUTED]: "争议处理中",
  [BOUNTY_STATUS.COMPLETED]: "已完成",
  [BOUNTY_STATUS.CANCELLED]: "已取消",
};

/** Persisted states used by a provider's intent for one bounty. */
export const BOUNTY_INTENT_STATUS = {
  /** The provider is waiting for the owner to decide. */
  PENDING: "pending",
  /** The owner selected this provider. */
  CONFIRMED: "confirmed",
  /** The owner selected a different provider. */
  REJECTED: "rejected",
} as const;

/** Persisted provider-intent state exposed by APIs. */
export type BountyIntentStatus = (typeof BOUNTY_INTENT_STATUS)[keyof typeof BOUNTY_INTENT_STATUS];

/** User-facing labels for provider-intent states. */
export const BOUNTY_INTENT_STATUS_LABELS: Record<BountyIntentStatus, string> = {
  [BOUNTY_INTENT_STATUS.PENDING]: "等待主人确认",
  [BOUNTY_INTENT_STATUS.CONFIRMED]: "主人已确认",
  [BOUNTY_INTENT_STATUS.REJECTED]: "已由其他服务者接单",
};

/** Shared validation and pagination limits for the first bounty release. */
export const BOUNTY_LIMITS = {
  /** Minimum bounty amount in integer cents. */
  AMOUNT_MIN_CENTS: 100,
  /** Maximum bounty amount in integer cents. */
  AMOUNT_MAX_CENTS: 100_000,
  /** Maximum private service-address length after trimming. */
  ADDRESS_MAX_LENGTH: 200,
  /** Maximum private owner-remark length after trimming. */
  REMARK_MAX_LENGTH: 500,
  /** Maximum number of bounties returned in one page. */
  PAGE_SIZE_MAX: 50,
} as const;

/** Stable bounty errors used by clients for recovery behavior. */
export const BOUNTY_ERROR_CODE = {
  /** Commercial routes are intentionally disabled in the current environment. */
  FEATURE_DISABLED: "BOUNTY_FEATURE_DISABLED",
  /** The bounty, pet, or owner-scoped resource cannot be found. */
  NOT_FOUND: "BOUNTY_NOT_FOUND",
  /** Bounty input is invalid even outside HTTP validation. */
  VALIDATION_FAILED: "BOUNTY_VALIDATION_FAILED",
  /** The atomic bounty write failed for an unexpected persistence reason. */
  CREATION_FAILED: "BOUNTY_CREATION_FAILED",
  /** The current account has no complete persisted provider qualification. */
  PROVIDER_NOT_ELIGIBLE: "BOUNTY_PROVIDER_NOT_ELIGIBLE",
  /** A bounty owner cannot submit a provider intent for their own bounty. */
  OWN_BOUNTY_FORBIDDEN: "BOUNTY_OWN_INTENT_FORBIDDEN",
  /** The bounty no longer accepts new provider intents or confirmation. */
  NOT_OPEN: "BOUNTY_NOT_OPEN",
  /** A different provider already won the unique confirmation race. */
  CONFIRMATION_CONFLICT: "BOUNTY_CONFIRMATION_CONFLICT",
  /** The provider intent could not be persisted. */
  INTENT_FAILED: "BOUNTY_INTENT_FAILED",
  /** The unique provider confirmation could not be persisted. */
  CONFIRMATION_FAILED: "BOUNTY_CONFIRMATION_FAILED",
  /** The authenticated account is inactive. */
  ACCOUNT_DISABLED: "AUTH_ACCOUNT_DISABLED",
} as const;

/** Complete owner input for one exact-price bounty. */
export interface CreateBountyRequest {
  /** Owner-controlled pet profile identifier. */
  petId: string;
  /** Controlled requested service category. */
  serviceType: BountyServiceType;
  /** Future ISO 8601 service time. */
  serviceTime: string;
  /** Exact bounty amount in integer cents. */
  amountCents: number;
  /** Private service address visible only to the owner in Cycle 5. */
  address: string;
  /** Optional private service note visible only to the owner in Cycle 5. */
  remark?: string | null;
}

/** Owner identity safe for unauthenticated bounty discovery. */
export interface PublicBountyOwner {
  /** Current public nickname. */
  nickname: string;
  /** Current public avatar URL, or null when unavailable. */
  avatar: string | null;
}

/** Provider identity visible to a bounty owner after an intent is submitted. */
export interface BountyProviderSummary {
  /** Provider account identifier used for the fulfillment relation. */
  id: string;
  /** Current public nickname. */
  nickname: string;
  /** Current public avatar URL, or null when unavailable. */
  avatar: string | null;
}

/** Pet summary safe for unauthenticated bounty discovery. */
export interface PublicBountyPet {
  /** Pet display name. */
  name: string;
  /** User-entered breed label. */
  breed: string;
  /** First public pet image, or null when unavailable. */
  coverImage: string | null;
}

/** Anonymous-safe projection of one open, unexpired bounty. */
export interface PublicBounty {
  /** Bounty order identifier. */
  id: string;
  /** Controlled requested service category. */
  serviceType: BountyServiceType;
  /** ISO 8601 requested service time. */
  serviceTime: string;
  /** Exact bounty amount in integer cents. */
  amountCents: number;
  /** Current open-bounty state. */
  status: BountyStatus;
  /** ISO 8601 discovery expiry time. */
  expiresAt: string;
  /** Public owner display identity. */
  owner: PublicBountyOwner;
  /** Public pet display summary. */
  pet: PublicBountyPet;
}

/** Owner-only pet reference returned with a private bounty. */
export interface MyBountyPet extends PublicBountyPet {
  /** Owner-controlled pet profile identifier. */
  id: string;
}

/** Private bounty projection returned only to its authenticated owner. */
export interface MyBounty {
  /** Bounty order identifier. */
  id: string;
  /** Controlled requested service category. */
  serviceType: BountyServiceType;
  /** ISO 8601 requested service time. */
  serviceTime: string;
  /** Exact bounty amount in integer cents. */
  amountCents: number;
  /** Current persisted bounty order state. */
  status: BountyStatus;
  /** Private service address. */
  address: string;
  /** Private owner note, or null when omitted. */
  remark: string | null;
  /** ISO 8601 discovery expiry time. */
  expiresAt: string;
  /** ISO 8601 creation time. */
  createdAt: string;
  /** Owner-controlled pet summary. */
  pet: MyBountyPet;
  /** Uniquely confirmed provider, or null while the owner is still deciding. */
  provider: BountyProviderSummary | null;
}

/** Current account's server-derived ability to submit bounty intents. */
export interface BountyProviderEligibility {
  /** True only when the active account and all persisted qualification gates pass. */
  eligible: boolean;
}

/** One provider intent visible only to the bounty owner. */
export interface OwnerBountyIntent {
  /** Provider-intent identifier. */
  id: string;
  /** Current intent decision state. */
  status: BountyIntentStatus;
  /** ISO 8601 submission time. */
  createdAt: string;
  /** Public provider identity needed for the owner's decision. */
  provider: BountyProviderSummary;
}

/** Bounty projection returned with the current provider's own intent. */
export interface MyBountyIntentBounty {
  /** Bounty order identifier. */
  id: string;
  /** Controlled requested service category. */
  serviceType: BountyServiceType;
  /** ISO 8601 requested service time. */
  serviceTime: string;
  /** Exact bounty amount in integer cents. */
  amountCents: number;
  /** Current persisted bounty order state. */
  status: BountyStatus;
  /** ISO 8601 discovery expiry time. */
  expiresAt: string;
  /** Public owner display identity. */
  owner: PublicBountyOwner;
  /** Public pet display summary. */
  pet: PublicBountyPet;
  /** Private address exposed only after this provider is confirmed. */
  address: string | null;
  /** Private owner note exposed only after this provider is confirmed. */
  remark: string | null;
}

/** One intent submitted by the authenticated provider. */
export interface MyBountyIntent {
  /** Provider-intent identifier reused by idempotent submissions. */
  id: string;
  /** Current intent decision state. */
  status: BountyIntentStatus;
  /** ISO 8601 first submission time. */
  createdAt: string;
  /** Bounty data with confirmation-scoped private fields. */
  bounty: MyBountyIntentBounty;
}

/** Shared page query used by public and owner-only bounty lists. */
export interface BountyListQuery {
  /** One-based page number. */
  page: number;
  /** Requested page size bounded by the shared maximum. */
  pageSize: number;
}

/** Paginated anonymous-safe open-bounty list. */
export type PublicBountyListResponse = PaginatedResponse<PublicBounty>;

/** Paginated owner-only bounty list. */
export type MyBountyListResponse = PaginatedResponse<MyBounty>;

/** Paginated owner-only provider-intent list for one bounty. */
export type OwnerBountyIntentListResponse = PaginatedResponse<OwnerBountyIntent>;

/** Paginated list of intents submitted by the authenticated provider. */
export type MyBountyIntentListResponse = PaginatedResponse<MyBountyIntent>;
