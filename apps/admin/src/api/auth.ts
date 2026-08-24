import type {
  AdminLoginResponse,
  AdminRefreshResponse,
  AdminSessionUser,
  ApiErrorResponse,
  CaptchaChallenge,
  PasswordLoginRequest,
  SendSmsCodeRequest,
  SendSmsCodeResponse,
  SmsLoginRequest,
} from "@petcare/shared-types";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { emitSessionExpired } from "../auth/session-expired";
import { readApiErrorMessage, unwrapApiResponse } from "./api-response";

type RetriableRequest = InternalAxiosRequestConfig & { _authRetried?: boolean };

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

/** 设置仅保存在内存中的访问令牌。 */
export function setAccessToken(token: string): void {
  accessToken = token;
}

/** 清除内存中的访问令牌。 */
export function clearAccessToken(): void {
  accessToken = null;
}

function handleExpiredSession(error: AxiosError<ApiErrorResponse>): void {
  const message = readApiErrorMessage(error);

  clearAccessToken();
  emitSessionExpired(message);
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (response.status !== 204) {
      response.data = unwrapApiResponse(response.data);
    }

    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const request = error.config as RetriableRequest | undefined;
    const isAuthenticationRequest =
      request?.url?.includes("/auth/refresh") ||
      request?.url?.includes("/auth/login/") ||
      request?.url?.includes("/auth/logout");
    const isExpiredSession =
      error.response?.status === 401 && error.response.data?.code === "AUTH_SESSION_EXPIRED";

    if (
      !isExpiredSession ||
      !request ||
      isAuthenticationRequest ||
      !request.headers.has("Authorization")
    ) {
      return Promise.reject(error);
    }

    if (request._authRetried) {
      handleExpiredSession(error);

      return Promise.reject(error);
    }

    request._authRetried = true;
    refreshPromise ??= apiClient
      .post<AdminRefreshResponse>("/auth/refresh")
      .then((response) => {
        setAccessToken(response.data.accessToken);

        return response.data.accessToken;
      })
      .catch((refreshError) => {
        handleExpiredSession(refreshError as AxiosError<ApiErrorResponse>);

        return Promise.reject(refreshError);
      })
      .finally(() => {
        refreshPromise = null;
      });

    try {
      const token = await refreshPromise;

      request.headers.set("Authorization", `Bearer ${token}`);

      return apiClient(request);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

/** 使用刷新令牌恢复管理员登录态。 */
export async function refreshSession(): Promise<AdminRefreshResponse> {
  const response = await apiClient.post<AdminRefreshResponse>("/auth/refresh");

  setAccessToken(response.data.accessToken);

  return response.data;
}

/** 获取当前登录管理员。 */
export async function getCurrentUser(): Promise<AdminSessionUser> {
  const response = await apiClient.get<AdminSessionUser>("/auth/me");

  return response.data;
}

/** 使用手机号或账号与密码登录。 */
export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<AdminLoginResponse> {
  const request: PasswordLoginRequest = {
    identifier,
    password,
  };
  const response = await apiClient.post<AdminLoginResponse>("/auth/login/password", request);

  setAccessToken(response.data.accessToken);

  return response.data;
}

/** 使用手机号和短信验证码登录。 */
export async function loginWithSms(phone: string, code: string): Promise<AdminLoginResponse> {
  const request: SmsLoginRequest = { phone, code };
  const response = await apiClient.post<AdminLoginResponse>("/auth/login/sms", request);

  setAccessToken(response.data.accessToken);

  return response.data;
}

/** 获取发送短信验证码前所需的图形验证码。 */
export async function getCaptcha(): Promise<CaptchaChallenge> {
  const response = await apiClient.get<CaptchaChallenge>("/auth/captcha");

  return response.data;
}

/** 校验图形验证码并向指定手机号发送短信验证码。 */
export async function sendSmsCode(
  phone: string,
  captchaId: string,
  captchaCode: string,
): Promise<SendSmsCodeResponse> {
  const request: SendSmsCodeRequest = { phone, captchaId, captchaCode };
  const response = await apiClient.post<SendSmsCodeResponse>("/auth/sms/send", request);

  return response.data;
}

/** 注销当前管理员会话并清除本地访问令牌。 */
export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
  clearAccessToken();
}
