import type {
  WechatLoginRequest,
  WechatLogoutRequest,
  WechatRefreshRequest,
  WechatSession,
} from "@petcare/shared-types";
import { rawRequest } from "./request";

/** Exchanges a WeChat login code for an authenticated Miniapp session. */
export function loginWithWechat(loginCode: string): Promise<WechatSession> {
  return rawRequest<WechatSession>("/auth/wechat/login", {
    method: "POST",
    data: { loginCode } satisfies WechatLoginRequest,
  });
}

/** Rotates a refresh token and restores the authenticated Miniapp session. */
export function refreshWechatSession(refreshToken: string): Promise<WechatSession> {
  return rawRequest<WechatSession>("/auth/wechat/refresh", {
    method: "POST",
    data: { refreshToken } satisfies WechatRefreshRequest,
  });
}

/** Revokes the supplied Miniapp refresh token. */
export async function logoutWechatSession(refreshToken: string): Promise<void> {
  await rawRequest<void>("/auth/wechat/logout", {
    method: "POST",
    data: { refreshToken } satisfies WechatLogoutRequest,
  });
}
