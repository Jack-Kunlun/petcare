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
