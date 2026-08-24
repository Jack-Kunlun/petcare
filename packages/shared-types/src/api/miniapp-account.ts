/** Stable Miniapp account errors used by clients for recovery behavior. */
export const MINIAPP_ACCOUNT_ERROR_CODE = {
  /** The current account must bind a verified phone before restricted actions. */
  PROFILE_INCOMPLETE: "PROFILE_INCOMPLETE",
  /** The requested phone is already bound to another account. */
  PHONE_ALREADY_BOUND: "PHONE_ALREADY_BOUND",
  /** The requested phone conflicts with the current account state. */
  PHONE_CONFLICT: "PHONE_CONFLICT",
  /** The submitted SMS verification code is invalid or expired. */
  VERIFICATION_CODE_INVALID: "VERIFICATION_CODE_INVALID",
  /** The account cannot be cancelled while it has an active order. */
  ACTIVE_ORDER_EXISTS: "ACTIVE_ORDER_EXISTS",
} as const;

/** Current Miniapp profile without a raw phone number. */
export interface MiniappUserProfile {
  /** User identifier. */
  id: string;
  /** User-selected or generated display name. */
  nickname: string;
  /** Public avatar URL, or null when the bundled default should be used. */
  avatar: string | null;
  /** Masked verified phone number, or null before binding. */
  phoneMasked: string | null;
  /** Whether the verified-phone requirement is satisfied. */
  profileComplete: boolean;
  /** Current business user type. */
  userType: string;
  /** Optional user-entered region. */
  region: string | null;
  /** Optional user-entered biography. */
  bio: string | null;
}

/** Editable text profile fields. */
export interface UpdateMiniappProfileRequest {
  /** Display name after trimming, 1 to 24 characters. */
  nickname: string;
  /** Optional region text. */
  region: string | null;
  /** Optional biography text. */
  bio: string | null;
}

/** Requests a binding code for an unbound account. */
export interface SendMiniappPhoneCodeRequest {
  /** Mainland China mobile number to verify. */
  phone: string;
}

/** Consumes a code and binds the verified phone. */
export interface BindMiniappPhoneRequest {
  /** Mainland China mobile number to bind. */
  phone: string;
  /** Six-digit SMS verification code. */
  code: string;
}

/** Confirms cancellation after any required SMS verification. */
export interface CancelMiniappAccountRequest {
  /** Cancellation SMS code; omitted for accounts without a bound phone. */
  code?: string;
}
