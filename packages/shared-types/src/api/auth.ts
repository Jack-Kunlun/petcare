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
/** 后台管理员的登录态用户信息。 */
export interface AdminSessionUser {
  /** 管理员唯一标识。 */
  id: string;
  /** 管理员登录账号；未设置时为 null。 */
  username: string | null;
  /** 管理员登录及联系手机号。 */
  phone: string;
  /** 管理员展示昵称。 */
  nickname: string;
  /** Current public avatar URL, or null for the default avatar. */
  avatar: string | null;
  /** 管理员拥有的角色编码。 */
  roles: string[];
  /** 当前活动角色合并后的权限代码，用于前端可见性与路由提示。 */
  permissions: string[];
}

/** 密码登录请求。 */
export interface PasswordLoginRequest {
  /** 手机号或账号。 */
  identifier: string;
  /** 登录密码。 */
  password: string;
}

/** 短信验证码登录请求。 */
export interface SmsLoginRequest {
  /** 登录手机号。 */
  phone: string;
  /** 短信验证码。 */
  code: string;
}

/** 发送短信验证码请求。 */
export interface SendSmsCodeRequest {
  /** 接收验证码的手机号。 */
  phone: string;
  /** 图形验证码挑战标识。 */
  captchaId: string;
  /** 用户输入的图形验证码。 */
  captchaCode: string;
}

/** 管理员登录响应。 */
export interface AdminLoginResponse {
  /** 用于访问受保护接口的短期令牌。 */
  accessToken: string;
  /** 当前登录管理员。 */
  user: AdminSessionUser;
}

/** 刷新登录态响应。 */
export interface AdminRefreshResponse {
  /** 新签发的短期访问令牌。 */
  accessToken: string;
}

/** 图形验证码挑战。 */
export interface CaptchaChallenge {
  /** 图形验证码挑战标识。 */
  captchaId: string;
  /** 可直接展示的验证码图片数据。 */
  image: string;
  /** 验证码剩余有效时间，单位为秒。 */
  expiresIn: number;
}
