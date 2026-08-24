import type { MiniappUserProfile } from "@petcare/shared-types";

export function isMainlandChinaMobile(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(value);
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
