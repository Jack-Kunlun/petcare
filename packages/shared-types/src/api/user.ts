// packages/shared-types/src/api/user.ts

/** Public profile fields that never disclose a stored address. */
export interface PublicUserProfile {
  /** Coarse public region; null until a trusted region source exists. */
  region: string | null;
  /** Optional user-entered public biography. */
  bio: string | null;
}

/** Public user detail returned without private account metadata. */
export interface PublicUser {
  /** User identifier. */
  id: string;
  /** Public display name. */
  nickname: string;
  /** Public avatar URL, or null when the default avatar should be used. */
  avatar: string | null;
  /** Public business identity. */
  userType: string;
  /** Public details are returned only for active accounts. */
  status: "active";
  /** Optional public profile. */
  profile: PublicUserProfile | null;
}
