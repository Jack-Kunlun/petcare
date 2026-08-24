import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginWithWechat, refreshWechatSession } from "../api/auth";
import { MiniappApiError, rawRequest } from "../api/request";
import {
  authorizedRequest,
  bootstrapSession,
  clearSession,
  loginInteractively,
  requireProfile,
  session,
  STORAGE_KEY,
} from "./session";

vi.mock("../api/auth", () => ({
  loginWithWechat: vi.fn(),
  refreshWechatSession: vi.fn(),
}));

vi.mock("../api/request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/request")>();

  return {
    ...actual,
    rawRequest: vi.fn(),
    rawUpload: vi.fn(),
  };
});

interface LoginOptions {
  success?: (result: { code: string }) => void;
  fail?: (result: { errMsg: string }) => void;
}

const accessError = () => new MiniappApiError(401, "AUTH_SESSION_EXPIRED", "登录已过期");
const storage = new Map<string, unknown>();
const getStorageSync = vi.fn((key: string) => storage.get(key));
const setStorageSync = vi.fn((key: string, value: unknown) => storage.set(key, value));
const removeStorageSync = vi.fn((key: string) => storage.delete(key));
const login = vi.fn();
const navigateTo = vi.fn();

const storedSession = {
  accessToken: "old-access-token",
  refreshToken: "old-refresh-token",
  user: {
    id: "user-1",
    nickname: "宠友123456",
    avatar: null,
    phoneMasked: null,
    profileComplete: false,
    userType: "pet_owner",
    region: null,
    bio: null,
  },
};

const refreshedSession = {
  ...storedSession,
  accessToken: "new-access-token",
  refreshToken: "new-refresh-token",
};

const interactiveSession = {
  ...storedSession,
  accessToken: "interactive-access-token",
  refreshToken: "interactive-refresh-token",
  user: { ...storedSession.user, nickname: "新登录用户" },
};

const rawRequestMock = vi.mocked(rawRequest);
const loginWithWechatMock = vi.mocked(loginWithWechat);
const refreshWechatSessionMock = vi.mocked(refreshWechatSession);

function seedStoredSession(publish = true): void {
  if (publish) {
    Object.assign(session, storedSession);
  }

  storage.set("petcare.sessionCommitted", true);
  storage.set("petcare.accessToken", storedSession.accessToken);
  storage.set("petcare.refreshToken", storedSession.refreshToken);
  storage.set("petcare.user", storedSession.user);
}

function resolveUniLogin(code = "wechat-code"): void {
  login.mockImplementationOnce((options: LoginOptions) => options.success?.({ code }));
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("miniapp session", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    getStorageSync.mockImplementation((key) => storage.get(key));
    setStorageSync.mockImplementation((key, value) => storage.set(key, value));
    removeStorageSync.mockImplementation((key) => storage.delete(key));
    rawRequestMock.mockReset();
    loginWithWechatMock.mockReset();
    refreshWechatSessionMock.mockReset();
    Object.assign(session, {
      accessToken: null,
      refreshToken: null,
      user: null,
      bootstrapped: false,
    });
    vi.stubGlobal("uni", {
      getStorageSync,
      setStorageSync,
      removeStorageSync,
      login,
      navigateTo,
    });
  });

  it("shares one refresh across concurrent 401 responses", async () => {
    seedStoredSession();
    refreshWechatSessionMock.mockResolvedValue(refreshedSession);
    rawRequestMock
      .mockRejectedValueOnce(accessError())
      .mockRejectedValueOnce(accessError())
      .mockResolvedValueOnce({ id: "first" })
      .mockResolvedValueOnce({ id: "second" });

    const first = authorizedRequest<{ id: string }>("/users/me");
    const second = authorizedRequest<{ id: string }>("/users/me");

    await expect(Promise.all([first, second])).resolves.toEqual([
      { id: "first" },
      { id: "second" },
    ]);
    expect(refreshWechatSessionMock).toHaveBeenCalledTimes(1);
    expect(rawRequestMock).toHaveBeenCalledTimes(4);
  });

  it("replays at most once and clears the session after a second 401", async () => {
    seedStoredSession();
    refreshWechatSessionMock.mockResolvedValue(refreshedSession);
    rawRequestMock.mockRejectedValueOnce(accessError()).mockRejectedValueOnce(accessError());

    await expect(authorizedRequest("/users/me")).rejects.toMatchObject({ statusCode: 401 });

    expect(refreshWechatSessionMock).toHaveBeenCalledTimes(1);
    expect(rawRequestMock).toHaveBeenCalledTimes(2);
    expect(session.user).toBeNull();
  });

  it("clears stored tokens when refresh fails", async () => {
    seedStoredSession();
    rawRequestMock.mockRejectedValueOnce(accessError());
    refreshWechatSessionMock.mockRejectedValueOnce(new Error("offline"));

    await expect(authorizedRequest("/users/me")).rejects.toThrow("offline");

    expect(storage.has("petcare.accessToken")).toBe(false);
    expect(storage.has("petcare.refreshToken")).toBe(false);
    expect(storage.has("petcare.user")).toBe(false);
    expect(session.user).toBeNull();
  });

  it("restores a persisted refresh token before trying silent login", async () => {
    seedStoredSession(false);
    refreshWechatSessionMock.mockResolvedValue(refreshedSession);

    await bootstrapSession();

    expect(refreshWechatSessionMock).toHaveBeenCalledWith(storedSession.refreshToken);
    expect(login).not.toHaveBeenCalled();
    expect(session).toMatchObject({ ...refreshedSession, bootstrapped: true });
  });

  it("suppresses silent login after a manual logout", async () => {
    storage.set("petcare.manualLogout", true);

    await bootstrapSession();

    expect(refreshWechatSessionMock).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
    expect(session.bootstrapped).toBe(true);
  });

  it("uses silent uni.login when no refresh token exists", async () => {
    resolveUniLogin();
    loginWithWechatMock.mockResolvedValue(refreshedSession);

    await bootstrapSession();

    expect(loginWithWechatMock).toHaveBeenCalledWith("wechat-code");
    expect(session).toMatchObject({ ...refreshedSession, bootstrapped: true });
  });

  it("clears manualLogout only after an interactive login succeeds", async () => {
    storage.set("petcare.manualLogout", true);
    resolveUniLogin();
    loginWithWechatMock.mockResolvedValue(refreshedSession);

    await loginInteractively();

    expect(removeStorageSync).toHaveBeenCalledWith("petcare.manualLogout");
    expect(session.user).toEqual(refreshedSession.user);
  });

  it("rolls back an interactive login when session storage throws", async () => {
    storage.set("petcare.manualLogout", true);
    resolveUniLogin();
    loginWithWechatMock.mockResolvedValue(interactiveSession);
    setStorageSync.mockImplementation((key, value) => {
      storage.set(key, value);

      if (key === "petcare.user") {
        throw new Error("storage full");
      }

      return storage;
    });

    await expect(loginInteractively()).rejects.toThrow("storage full");

    expect(session).toMatchObject({ accessToken: null, refreshToken: null, user: null });
    expect(storage.has("petcare.accessToken")).toBe(false);
    expect(storage.has("petcare.refreshToken")).toBe(false);
    expect(storage.has("petcare.user")).toBe(false);
    expect(storage.get("petcare.manualLogout")).toBe(true);
  });

  it("rolls back an interactive login when clearing manualLogout throws", async () => {
    storage.set("petcare.manualLogout", true);
    resolveUniLogin();
    loginWithWechatMock.mockResolvedValue(interactiveSession);
    removeStorageSync.mockImplementation((key) => {
      if (key === "petcare.manualLogout") {
        throw new Error("manualLogout storage failed");
      }

      return storage.delete(key);
    });

    await expect(loginInteractively()).rejects.toThrow("manualLogout storage failed");

    expect(session).toMatchObject({ accessToken: null, refreshToken: null, user: null });
    expect(storage.has("petcare.accessToken")).toBe(false);
    expect(storage.has("petcare.refreshToken")).toBe(false);
    expect(storage.has("petcare.user")).toBe(false);
    expect(storage.get("petcare.manualLogout")).toBe(true);
  });

  it("keeps partial storage inert when rollback cleanup fails", async () => {
    seedStoredSession();
    rawRequestMock.mockRejectedValueOnce(accessError());
    refreshWechatSessionMock.mockResolvedValueOnce(refreshedSession);
    setStorageSync.mockImplementation((key, value) => {
      storage.set(key, value);

      if (key === STORAGE_KEY.user) {
        throw new Error("storage full");
      }

      return storage;
    });
    removeStorageSync.mockImplementation(() => {
      throw new Error("cleanup failed");
    });

    await expect(authorizedRequest("/users/me")).rejects.toThrow("storage full");

    expect(storage.get("petcare.sessionCommitted")).toBe(false);
    expect(session).toMatchObject({ accessToken: null, refreshToken: null, user: null });

    setStorageSync.mockImplementation((key, value) => storage.set(key, value));
    removeStorageSync.mockImplementation((key) => storage.delete(key));
    refreshWechatSessionMock.mockReset();
    resolveUniLogin();
    loginWithWechatMock.mockResolvedValueOnce(interactiveSession);

    await bootstrapSession();

    expect(refreshWechatSessionMock).not.toHaveBeenCalled();
    expect(loginWithWechatMock).toHaveBeenCalledWith("wechat-code");
    expect(session).toMatchObject(interactiveSession);
  });

  it("keeps manualLogout when interactive login fails", async () => {
    storage.set("petcare.manualLogout", true);
    login.mockImplementationOnce((options: LoginOptions) =>
      options.fail?.({ errMsg: "login:fail" }),
    );

    await expect(loginInteractively()).rejects.toThrow("login:fail");

    expect(storage.get("petcare.manualLogout")).toBe(true);
    expect(removeStorageSync).not.toHaveBeenCalledWith("petcare.manualLogout");
  });

  it("does not claim manual logout when persisting its intent fails", () => {
    seedStoredSession();
    setStorageSync.mockImplementation((key, value) => {
      if (key === STORAGE_KEY.manualLogout) {
        throw new Error("logout intent failed");
      }

      return storage.set(key, value);
    });

    expect(() => clearSession(true)).toThrow("logout intent failed");

    expect(removeStorageSync).not.toHaveBeenCalled();
    expect(storage.get(STORAGE_KEY.sessionCommitted)).toBe(true);
    expect(storage.has(STORAGE_KEY.manualLogout)).toBe(false);
    expect(session).toMatchObject(storedSession);
  });

  it("records manual logout before invalidation and tolerates cleanup failures", async () => {
    seedStoredSession();
    removeStorageSync.mockImplementation(() => {
      throw new Error("cleanup failed");
    });

    expect(() => clearSession(true)).not.toThrow();

    expect(setStorageSync.mock.calls.slice(0, 2)).toEqual([
      [STORAGE_KEY.manualLogout, true],
      [STORAGE_KEY.sessionCommitted, false],
    ]);
    expect(storage.get(STORAGE_KEY.manualLogout)).toBe(true);
    expect(storage.get(STORAGE_KEY.sessionCommitted)).toBe(false);
    expect(storage.get(STORAGE_KEY.accessToken)).toBe(storedSession.accessToken);
    expect(session).toMatchObject({ accessToken: null, refreshToken: null, user: null });

    await bootstrapSession();

    expect(refreshWechatSessionMock).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
  });

  it("ignores a stale refresh success after manual logout", async () => {
    seedStoredSession();

    const refresh = deferred<typeof refreshedSession>();

    refreshWechatSessionMock.mockReturnValue(refresh.promise);
    rawRequestMock.mockRejectedValueOnce(accessError()).mockResolvedValueOnce({ id: "ignored" });

    const pending = authorizedRequest<{ id: string }>("/users/me");

    await vi.waitFor(() => expect(refreshWechatSessionMock).toHaveBeenCalledTimes(1));

    clearSession(true);
    refresh.resolve(refreshedSession);

    await expect(pending).resolves.toEqual({ id: "ignored" });
    expect(session).toMatchObject({ accessToken: null, refreshToken: null, user: null });
    expect(storage.get("petcare.manualLogout")).toBe(true);
  });

  it("does not refresh when a request receives its 401 after manual logout", async () => {
    seedStoredSession();

    const request = deferred<never>();

    rawRequestMock.mockReturnValueOnce(request.promise);
    refreshWechatSessionMock.mockRejectedValueOnce(new Error("unexpected refresh"));

    const pending = authorizedRequest("/users/me");

    clearSession(true);
    request.reject(accessError());

    await expect(pending).rejects.toMatchObject({ statusCode: 401 });
    expect(refreshWechatSessionMock).not.toHaveBeenCalled();
    expect(session).toMatchObject({ accessToken: null, refreshToken: null, user: null });
    expect(storage.get(STORAGE_KEY.manualLogout)).toBe(true);
    expect(storage.get(STORAGE_KEY.sessionCommitted)).toBe(false);
  });

  it("keeps a newer interactive login when a stale refresh fails", async () => {
    seedStoredSession();

    const refresh = deferred<typeof refreshedSession>();

    refreshWechatSessionMock.mockReturnValue(refresh.promise);
    rawRequestMock.mockRejectedValueOnce(accessError());

    const pending = authorizedRequest("/users/me");

    await vi.waitFor(() => expect(refreshWechatSessionMock).toHaveBeenCalledTimes(1));

    resolveUniLogin();
    loginWithWechatMock.mockResolvedValue(interactiveSession);
    await loginInteractively();
    refresh.reject(new Error("stale refresh failed"));

    await expect(pending).rejects.toThrow("stale refresh failed");
    expect(session).toMatchObject(interactiveSession);
    expect(storage.get("petcare.accessToken")).toBe(interactiveSession.accessToken);
    expect(storage.get("petcare.refreshToken")).toBe(interactiveSession.refreshToken);
  });

  it("routes anonymous and incomplete users while allowing a complete profile", async () => {
    await expect(requireProfile("/pages-bounty/publish/step1")).resolves.toBe(false);
    expect(navigateTo).toHaveBeenLastCalledWith({ url: "/pages/auth/index" });

    Object.assign(session, storedSession);
    await expect(requireProfile("//outside.example/path")).resolves.toBe(false);
    expect(navigateTo).toHaveBeenLastCalledWith({
      url: "/pages-account/profile/edit?returnUrl=%2Fpages%2Fprofile%2Findex",
    });

    session.user = { ...storedSession.user, profileComplete: true };
    await expect(requireProfile("/pages-bounty/publish/step1")).resolves.toBe(true);
  });
});
