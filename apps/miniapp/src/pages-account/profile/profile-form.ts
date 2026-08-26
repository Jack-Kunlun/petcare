import type { MiniappUserProfile } from "@petcare/shared-types";

export interface EditableProfileForm {
  nickname: string;
  region: string;
  bio: string;
}

export function isMainlandChinaMobile(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(value);
}

/** Reports whether any text field differs from the last persisted profile. */
export function isProfileFormDirty(
  current: EditableProfileForm,
  persisted: EditableProfileForm,
): boolean {
  return (
    current.nickname !== persisted.nickname ||
    current.region !== persisted.region ||
    current.bio !== persisted.bio
  );
}

export function mergeProfileResponse(
  current: MiniappUserProfile,
  response: MiniappUserProfile,
  operation: "avatar" | "save" | "bind",
): MiniappUserProfile {
  if (operation === "avatar") {
    return { ...current, avatar: response.avatar };
  }

  if (operation === "save") {
    return {
      ...current,
      nickname: response.nickname,
      region: response.region,
      bio: response.bio,
    };
  }

  return {
    ...current,
    phoneMasked: response.phoneMasked,
    profileComplete: response.profileComplete,
  };
}
