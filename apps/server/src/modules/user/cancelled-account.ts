/** Removes reusable login identities and public profile fields while retaining relational history. */
export const CANCELLED_ACCOUNT_DATA = {
  openid: null,
  phone: null,
  username: null,
  passwordHash: null,
  nickname: "已注销用户",
  avatar: null,
  avatarObjectKey: null,
  status: "inactive",
  sessionVersion: { increment: 1 },
} as const;
