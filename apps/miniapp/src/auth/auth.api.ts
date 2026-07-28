import { WechatLoginResult, WechatSession } from "@petcare/shared-types";
import { apiRequest } from "../api/request";

export function loginWithWechat(loginCode: string): Promise<WechatLoginResult> {
  return apiRequest("/auth/wechat/login", {
    method: "POST",
    data: { loginCode },
  });
}

export function bindWechatPhone(
  bindToken: string,
  phoneCode: string,
): Promise<WechatSession & { status: "authenticated" }> {
  return apiRequest("/auth/wechat/bind-phone", {
    method: "POST",
    data: { bindToken, phoneCode },
  });
}

export function refreshWechatSession(refreshToken: string): Promise<WechatSession> {
  return apiRequest("/auth/wechat/refresh", {
    method: "POST",
    data: { refreshToken },
  });
}

export function logoutWechatSession(refreshToken: string): Promise<void> {
  return apiRequest("/auth/wechat/logout", {
    method: "POST",
    data: { refreshToken },
  });
}
