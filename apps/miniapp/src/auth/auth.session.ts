import { WechatSession } from "@petcare/shared-types";
import Taro from "@tarojs/taro";
import { ApiRequestOptions, apiRequest, MiniappApiError } from "../api/request";
import * as authApi from "./auth.api";

const SESSION_KEY = "petcare.auth.session.v1";
let refreshPromise: Promise<WechatSession> | null = null;

export async function loadStoredSession(): Promise<WechatSession | null> {
  try {
    const result = await Taro.getStorage<WechatSession>({ key: SESSION_KEY });

    return isWechatSession(result.data) ? result.data : null;
  } catch {
    return null;
  }
}

export async function saveStoredSession(session: WechatSession): Promise<void> {
  await Taro.setStorage({ key: SESSION_KEY, data: session });
}

export async function clearStoredSession(): Promise<void> {
  try {
    await Taro.removeStorage({ key: SESSION_KEY });
  } catch {
    return;
  }
}

export async function restoreSession(): Promise<WechatSession | null> {
  const session = await loadStoredSession();

  if (!session) {
    return null;
  }

  try {
    return await refreshOnce(session.refreshToken);
  } catch {
    await clearStoredSession();

    return null;
  }
}

export async function requestWithSession<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const session = await loadStoredSession();

  if (!session) {
    return apiRequest<T>(path, options);
  }

  try {
    return await authorizedRequest<T>(path, options, session.accessToken);
  } catch (error) {
    if (!isExpiredAuthError(error)) {
      throw error;
    }

    try {
      const rotatedSession = await refreshOnce(session.refreshToken);

      return authorizedRequest<T>(path, options, rotatedSession.accessToken);
    } catch {
      await clearStoredSession();
      throw error;
    }
  }
}

async function refreshOnce(refreshToken: string): Promise<WechatSession> {
  if (!refreshPromise) {
    refreshPromise = authApi
      .refreshWechatSession(refreshToken)
      .then(async (session) => {
        await saveStoredSession(session);

        return session;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function authorizedRequest<T>(
  path: string,
  options: ApiRequestOptions,
  accessToken: string,
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    header: {
      ...options.header,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function isExpiredAuthError(error: unknown): error is MiniappApiError {
  return (
    error instanceof MiniappApiError &&
    (error.status === 401 || error.code === "AUTH_SESSION_EXPIRED")
  );
}

function isWechatSession(value: unknown): value is WechatSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<WechatSession>;

  return (
    typeof session.accessToken === "string" &&
    typeof session.refreshToken === "string" &&
    Boolean(session.user) &&
    typeof session.user?.id === "string" &&
    typeof session.user.phone === "string"
  );
}
