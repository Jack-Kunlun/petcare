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

/** Persisted state exposed by the Cycle 5 open-bounty flow. */
export const BOUNTY_STATUS = {
  /** The owner is waiting for a qualified provider in a later cycle. */
  OPEN: "pending_confirm",
} as const;

/** Open state used by Cycle 5 bounty responses. */
export type BountyStatus = (typeof BOUNTY_STATUS)[keyof typeof BOUNTY_STATUS];

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
  /** Current order state. */
  status: string;
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
