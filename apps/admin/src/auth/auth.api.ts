import type { ApiErrorResponse } from "@petcare/shared-types";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { unwrapApiResponse } from "../api/api-response";
import { AdminUser, CaptchaChallenge, LoginResponse, RefreshResponse } from "./auth.types";

type RetriableRequest = InternalAxiosRequestConfig & { _authRetried?: boolean };

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
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
    const isRefreshRequest = request?.url?.includes("/auth/refresh");

    if (error.response?.status !== 401 || !request || request._authRetried || isRefreshRequest) {
      return Promise.reject(error);
    }

    request._authRetried = true;
    refreshPromise ??= apiClient
      .post<RefreshResponse>("/auth/refresh")
      .then((response) => {
        setAccessToken(response.data.accessToken);

        return response.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });

    const token = await refreshPromise;

    request.headers.set("Authorization", `Bearer ${token}`);

    return apiClient(request);
  },
);

export async function refreshSession(): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>("/auth/refresh");

  setAccessToken(response.data.accessToken);

  return response.data;
}

export async function getCurrentUser(): Promise<AdminUser> {
  const response = await apiClient.get<AdminUser>("/auth/me");

  return response.data;
}

export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>("/auth/login/password", {
    identifier,
    password,
  });

  setAccessToken(response.data.accessToken);

  return response.data;
}

export async function loginWithSms(phone: string, code: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>("/auth/login/sms", { phone, code });

  setAccessToken(response.data.accessToken);

  return response.data;
}

export async function getCaptcha(): Promise<CaptchaChallenge> {
  const response = await apiClient.get<CaptchaChallenge>("/auth/captcha");

  return response.data;
}

export async function sendSmsCode(
  phone: string,
  captchaId: string,
  captchaCode: string,
): Promise<void> {
  await apiClient.post("/auth/sms/send", { phone, captchaId, captchaCode });
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
  clearAccessToken();
}
