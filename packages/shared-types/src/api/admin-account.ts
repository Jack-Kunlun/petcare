/** Stable errors returned by administrator self-service account operations. */
export const ADMIN_ACCOUNT_ERROR_CODE = {
  PASSWORD_REUSED: "ACCOUNT_PASSWORD_REUSED",
  CURRENT_PASSWORD_INVALID: "ACCOUNT_CURRENT_PASSWORD_INVALID",
  PASSWORD_NOT_CONFIGURED: "ACCOUNT_PASSWORD_NOT_CONFIGURED",
  CONCURRENT_UPDATE: "ACCOUNT_CONCURRENT_UPDATE",
  AVATAR_INVALID_TYPE: "AVATAR_INVALID_TYPE",
  AVATAR_FILE_TOO_LARGE: "AVATAR_FILE_TOO_LARGE",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
} as const;

/** Current administrator's self-service profile. */
export interface AdminAccountProfile {
  /** User UUID. */
  id: string;
  /** Login name, or null when none is configured. */
  username: string | null;
  /** Server-masked login phone number. */
  maskedPhone: string;
  /** Administrator-facing display name. */
  nickname: string;
  /** Public avatar URL, or null for the default avatar. */
  avatar: string | null;
  /** Current account status. */
  status: string;
  /** Names of active backend roles. */
  roles: string[];
  /** ISO timestamp when the account was created. */
  createdAt: string;
}

/** Editable administrator profile fields. */
export interface UpdateAdminAccountProfileRequest {
  /** New display nickname after server normalization. */
  nickname: string;
}

/** Password rotation request; confirmation remains a UI-only field. */
export interface UpdateAdminAccountPasswordRequest {
  /** Password currently configured on the account. */
  currentPassword: string;
  /** Replacement password with at least twelve characters. */
  newPassword: string;
}

/** Result of a successful public-avatar replacement. */
export interface AdminAvatarResponse {
  /** Newly active public avatar URL. */
  avatar: string;
}
