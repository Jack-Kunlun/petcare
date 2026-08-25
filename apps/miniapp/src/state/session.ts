import type { MiniappUserProfile, WechatSession } from "@petcare/shared-types";
import { reactive } from "vue";
import { loginWithWechat, logoutWechatSession, refreshWechatSession } from "../api/auth";
import { MiniappApiError, rawRequest, rawUpload } from "../api/request";
import type { RawRequestOptions } from "../api/request";

export const STORAGE_KEY = {
  sessionCommitted: "petcare.sessionCommitted",
  accessToken: "petcare.accessToken",
  refreshToken: "petcare.refreshToken",
  user: "petcare.user",
  manualLogout: "petcare.manualLogout",
} as const;

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: MiniappUserProfile | null;
  bootstrapped: boolean;
}

export const session = reactive<SessionState>({
  accessToken: null,
  refreshToken: null,
  user: null,
  bootstrapped: false,
});

let sessionRevision = 0;
let interactiveLoginCommitRevision = 0;
let refreshAttempt: { revision: number; promise: Promise<void> } | null = null;

function readStoredString(key: string): string | null {
  const value = uni.getStorageSync(key);

  return typeof value === "string" && value.length > 0 ? value : null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStoredUser(value: unknown): value is MiniappUserProfile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const user = value as Partial<MiniappUserProfile>;

  return (
    typeof user.id === "string" &&
    user.id.length > 0 &&
    typeof user.nickname === "string" &&
    isNullableString(user.avatar) &&
    isNullableString(user.phoneMasked) &&
    typeof user.profileComplete === "boolean" &&
    typeof user.userType === "string" &&
    isNullableString(user.region) &&
    isNullableString(user.bio)
  );
}

function hasManualLogout(): boolean {
  return uni.getStorageSync(STORAGE_KEY.manualLogout) === true;
}

function readStoredSession(): WechatSession | null {
  if (hasManualLogout() || uni.getStorageSync(STORAGE_KEY.sessionCommitted) !== true) {
    return null;
  }

  const accessToken = readStoredString(STORAGE_KEY.accessToken);
  const refreshToken = readStoredString(STORAGE_KEY.refreshToken);
  const user = uni.getStorageSync(STORAGE_KEY.user);

  return accessToken && refreshToken && isStoredUser(user)
    ? { accessToken, refreshToken, user }
    : null;
}

function setAnonymousSession(): void {
  session.accessToken = null;
  session.refreshToken = null;
  session.user = null;
}

function clearStoredSession(): void {
  for (const key of [STORAGE_KEY.accessToken, STORAGE_KEY.refreshToken, STORAGE_KEY.user]) {
    try {
      uni.removeStorageSync(key);
    } catch {
      // Keep clearing the other keys; the in-memory state remains anonymous.
    }
  }
}

function invalidateStoredSession(): void {
  try {
    uni.setStorageSync(STORAGE_KEY.sessionCommitted, false);
  } catch {
    // Cleanup can still make a previously committed session incomplete.
  }

  clearStoredSession();
}

function resetSessionAtRevision(revision: number): void {
  if (revision !== sessionRevision) {
    return;
  }

  setAnonymousSession();
  invalidateStoredSession();
}

function rollbackSessionCommit(revision: number, restoreManualLogout: boolean): void {
  if (revision !== sessionRevision) {
    return;
  }

  sessionRevision += 1;
  setAnonymousSession();
  invalidateStoredSession();

  if (restoreManualLogout) {
    try {
      uni.setStorageSync(STORAGE_KEY.manualLogout, true);
    } catch {
      // The failed commit still leaves the reactive session anonymous.
    }
  }
}

function persistSession(
  nextSession: WechatSession,
  revision: number,
  clearManualLogout = false,
): boolean {
  if (revision !== sessionRevision) {
    return false;
  }

  let restoreManualLogout = false;

  try {
    if (clearManualLogout) {
      restoreManualLogout = uni.getStorageSync(STORAGE_KEY.manualLogout) === true;
    }

    uni.setStorageSync(STORAGE_KEY.sessionCommitted, false);
    uni.setStorageSync(STORAGE_KEY.accessToken, nextSession.accessToken);
    uni.setStorageSync(STORAGE_KEY.refreshToken, nextSession.refreshToken);
    uni.setStorageSync(STORAGE_KEY.user, nextSession.user);

    if (clearManualLogout) {
      uni.removeStorageSync(STORAGE_KEY.manualLogout);
    }

    uni.setStorageSync(STORAGE_KEY.sessionCommitted, true);
  } catch (error) {
    rollbackSessionCommit(revision, restoreManualLogout);
    throw error;
  }

  session.accessToken = nextSession.accessToken;
  session.refreshToken = nextSession.refreshToken;
  session.user = nextSession.user;

  return true;
}

export function clearSession(manualLogout = false): void {
  if (manualLogout) {
    uni.setStorageSync(STORAGE_KEY.manualLogout, true);
  }

  sessionRevision += 1;
  setAnonymousSession();
  invalidateStoredSession();
}

export async function logout(): Promise<void> {
  const interactiveLoginRevision = interactiveLoginCommitRevision;

  try {
    const refreshToken = readStoredString(STORAGE_KEY.refreshToken);

    if (refreshToken) {
      await logoutWechatSession(refreshToken);
    }
  } catch {
    // Remote revocation and storage reads cannot prevent the local logout.
  } finally {
    if (interactiveLoginRevision === interactiveLoginCommitRevision) {
      clearSession(true);
    }
  }
}

/** Finishes a successful server cancellation without making a redundant logout request. */
export function completeCancellation(cancelledUserId: string): boolean {
  if (session.user && session.user.id !== cancelledUserId) {
    return false;
  }

  try {
    clearSession(true);
  } catch (error) {
    clearSession(false);
    throw error;
  }

  return true;
}

function refreshSession(refreshToken: string): Promise<void> {
  const revision = sessionRevision;

  if (!refreshAttempt || refreshAttempt.revision !== revision) {
    const promise = refreshWechatSession(refreshToken)
      .then((nextSession) => {
        persistSession(nextSession, revision);
      })
      .catch((error: unknown) => {
        resetSessionAtRevision(revision);
        throw error;
      })
      .finally(() => {
        if (refreshAttempt?.promise === promise) {
          refreshAttempt = null;
        }
      });

    refreshAttempt = { revision, promise };
  }

  return refreshAttempt.promise;
}

function getWechatLoginCode(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    uni.login({
      provider: "weixin",
      success(result) {
        if (result.code) {
          resolve(result.code);
        } else {
          reject(new Error("微信登录未返回临时凭证"));
        }
      },
      fail(error) {
        reject(new Error(error.errMsg || "微信登录失败"));
      },
    });
  });
}

async function createWechatSession(revision: number, clearManualLogout = false): Promise<boolean> {
  const nextSession = await loginWithWechat(await getWechatLoginCode());

  return persistSession(nextSession, revision, clearManualLogout);
}

export async function bootstrapSession(): Promise<void> {
  const revision = ++sessionRevision;

  session.bootstrapped = false;

  try {
    if (hasManualLogout()) {
      return;
    }

    const refreshToken = readStoredSession()?.refreshToken ?? null;

    if (refreshToken) {
      try {
        await refreshSession(refreshToken);

        return;
      } catch {
        if (revision !== sessionRevision) {
          return;
        }

        // A failed restore falls through to silent WeChat login.
      }
    } else {
      resetSessionAtRevision(revision);
    }

    try {
      await createWechatSession(revision);
    } catch {
      resetSessionAtRevision(revision);
    }
  } finally {
    session.bootstrapped = true;
  }
}

export async function loginInteractively(): Promise<void> {
  const revision = ++sessionRevision;

  if (await createWechatSession(revision, true)) {
    interactiveLoginCommitRevision += 1;
    session.bootstrapped = true;
  }
}

function authorizationHeaders(
  headers: Record<string, string> | undefined,
  accessToken: string | null,
): Record<string, string> | undefined {
  if (!accessToken) {
    return headers;
  }

  return { ...headers, Authorization: `Bearer ${accessToken}` };
}

function isUnauthorized(error: unknown): error is MiniappApiError {
  return error instanceof MiniappApiError && error.statusCode === 401;
}

async function authorizedOperation<T>(
  operation: (accessToken: string | null) => Promise<T>,
): Promise<T> {
  const revision = sessionRevision;
  const attemptedToken = hasManualLogout()
    ? null
    : (session.accessToken ?? readStoredSession()?.accessToken ?? null);

  try {
    return await operation(attemptedToken);
  } catch (error) {
    if (!isUnauthorized(error)) {
      throw error;
    }

    if (revision !== sessionRevision || hasManualLogout()) {
      throw error;
    }

    if (!session.accessToken || session.accessToken === attemptedToken) {
      const refreshToken = session.refreshToken ?? readStoredSession()?.refreshToken ?? null;

      if (!refreshToken) {
        clearSession(false);
        throw error;
      }

      await refreshSession(refreshToken);
    }

    if (revision !== sessionRevision || hasManualLogout()) {
      throw error;
    }

    try {
      return await operation(session.accessToken);
    } catch (retryError) {
      if (isUnauthorized(retryError)) {
        clearSession(false);
      }

      throw retryError;
    }
  }
}

export function authorizedRequest<T>(path: string, options: RawRequestOptions = {}): Promise<T> {
  return authorizedOperation((accessToken) =>
    rawRequest<T>(path, {
      ...options,
      header: authorizationHeaders(options.header, accessToken),
    }),
  );
}

export function authorizedUpload<T>(
  path: string,
  filePath: string,
  fieldName: string,
  headers: Record<string, string> = {},
): Promise<T> {
  return authorizedOperation((accessToken) =>
    rawUpload<T>(path, filePath, fieldName, authorizationHeaders(headers, accessToken) ?? {}),
  );
}

export interface SessionUserRevision {
  revision: number;
  userId: string | null;
}

export function captureSessionUserRevision(): SessionUserRevision {
  return { revision: sessionRevision, userId: session.user?.id ?? null };
}

export function updateSessionUser(
  user: MiniappUserProfile,
  startedAt: SessionUserRevision,
): boolean {
  if (
    startedAt.revision !== sessionRevision ||
    !startedAt.userId ||
    session.user?.id !== startedAt.userId ||
    user.id !== startedAt.userId
  ) {
    return false;
  }

  session.user = user;

  if (session.accessToken && session.refreshToken) {
    try {
      uni.setStorageSync(STORAGE_KEY.user, user);
    } catch {
      // The next refresh restores the server-authoritative profile.
    }
  }

  return true;
}

export function parseReturnUrl(value: string): string | null {
  let decoded: string;

  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  const path = decoded.split("?", 1)[0];

  if (
    !/^\/pages(?:-[a-z\d]+)?\/[\w./-]+(?:\?[^#\s]*)?$/iu.test(decoded) ||
    path.includes("\\") ||
    path.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }

  return decoded;
}

export function safeReturnUrl(value: string): string {
  return parseReturnUrl(value) ?? "/pages/profile/index";
}

export async function requireProfile(returnUrl: string): Promise<boolean> {
  if (!session.user) {
    await uni.navigateTo({ url: "/pages/auth/index" });

    return false;
  }

  if (!session.user.profileComplete) {
    await uni.navigateTo({
      url: `/pages-account/profile/edit?returnUrl=${encodeURIComponent(safeReturnUrl(returnUrl))}`,
    });

    return false;
  }

  return true;
}
