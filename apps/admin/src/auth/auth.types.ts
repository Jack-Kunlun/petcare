import type {
  AdminLoginResponse,
  AdminRefreshResponse,
  AdminSessionUser,
  CaptchaChallenge as SharedCaptchaChallenge,
} from "@petcare/shared-types";

/** @deprecated 业务契约定义在 @petcare/shared-types，此别名仅保留认证状态层兼容性。 */
export type AdminUser = AdminSessionUser;

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type LoginResponse = AdminLoginResponse;
export type RefreshResponse = AdminRefreshResponse;
export type CaptchaChallenge = SharedCaptchaChallenge;
