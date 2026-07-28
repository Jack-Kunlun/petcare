export interface MiniappUser {
  id: string;
  phone: string;
  nickname: string;
  avatar: string | null;
  userType: string;
}

export interface WechatSession {
  accessToken: string;
  refreshToken: string;
  user: MiniappUser;
}

export interface WechatLoginRequest {
  loginCode: string;
}

export type WechatLoginResult =
  ({ status: "authenticated" } & WechatSession) | { status: "phone_required"; bindToken: string };

export interface WechatBindPhoneRequest {
  bindToken: string;
  phoneCode: string;
}

export interface WechatRefreshRequest {
  refreshToken: string;
}

export type WechatLogoutRequest = WechatRefreshRequest;
