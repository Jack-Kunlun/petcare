import type { WechatSession } from "@petcare/shared-types";
import { rawRequest } from "./request";

export function loginWithWechat(loginCode: string): Promise<WechatSession> {
  return rawRequest<WechatSession>("/auth/wechat/login", {
    method: "POST",
    data: { loginCode },
  });
}

export function refreshWechatSession(refreshToken: string): Promise<WechatSession> {
  return rawRequest<WechatSession>("/auth/wechat/refresh", {
    method: "POST",
    data: { refreshToken },
  });
}

export async function logoutWechatSession(refreshToken: string): Promise<void> {
  await rawRequest<void>("/auth/wechat/logout", {
    method: "POST",
    data: { refreshToken },
  });
}
