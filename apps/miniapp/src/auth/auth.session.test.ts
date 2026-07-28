import { WechatSession } from "@petcare/shared-types";
import Taro from "@tarojs/taro";
import { apiRequest, MiniappApiError } from "../api/request";
import * as authApi from "./auth.api";
import {
  clearStoredSession,
  loadStoredSession,
  requestWithSession,
  restoreSession,
  saveStoredSession,
} from "./auth.session";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorage: jest.fn(),
    setStorage: jest.fn(),
    removeStorage: jest.fn(),
  },
}));

jest.mock("../api/request", () => {
  const actual = jest.requireActual("../api/request");

  return { ...actual, apiRequest: jest.fn() };
});

jest.mock("./auth.api", () => ({
  refreshWechatSession: jest.fn(),
}));

const oldSession: WechatSession = {
  accessToken: "old-access",
  refreshToken: "old-refresh",
  user: {
    id: "user-1",
    phone: "17679141878",
    nickname: "宠友1878",
    avatar: null,
    userType: "pet_owner",
  },
};
const newSession: WechatSession = {
  ...oldSession,
  accessToken: "new-access",
  refreshToken: "new-refresh",
};

describe("auth session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Taro.getStorage).mockResolvedValue({
      data: oldSession,
      errMsg: "getStorage:ok",
    });
    jest.mocked(Taro.setStorage).mockResolvedValue({ errMsg: "setStorage:ok" });
    jest.mocked(Taro.removeStorage).mockResolvedValue({
      errMsg: "removeStorage:ok",
    });
  });

  it("reads, writes, and clears the versioned session key", async () => {
    await expect(loadStoredSession()).resolves.toEqual(oldSession);
    await saveStoredSession(newSession);
    await clearStoredSession();

    expect(Taro.getStorage).toHaveBeenCalledWith({
      key: "petcare.auth.session.v1",
    });
    expect(Taro.setStorage).toHaveBeenCalledWith({
      key: "petcare.auth.session.v1",
      data: newSession,
    });
    expect(Taro.removeStorage).toHaveBeenCalledWith({
      key: "petcare.auth.session.v1",
    });
  });

  it("does not refresh when storage has no session", async () => {
    jest.mocked(Taro.getStorage).mockResolvedValue({
      data: undefined,
      errMsg: "getStorage:ok",
    });

    await expect(restoreSession()).resolves.toBeNull();
    expect(authApi.refreshWechatSession).not.toHaveBeenCalled();
  });

  it("restores and stores a rotated session", async () => {
    jest.mocked(authApi.refreshWechatSession).mockResolvedValue(newSession);

    await expect(restoreSession()).resolves.toEqual(newSession);
    expect(authApi.refreshWechatSession).toHaveBeenCalledWith("old-refresh");
    expect(Taro.setStorage).toHaveBeenCalledWith({
      key: "petcare.auth.session.v1",
      data: newSession,
    });
  });

  it("clears an expired stored session", async () => {
    jest
      .mocked(authApi.refreshWechatSession)
      .mockRejectedValue(new MiniappApiError("AUTH_SESSION_EXPIRED", "expired", "r1", 401));

    await expect(restoreSession()).resolves.toBeNull();
    expect(Taro.removeStorage).toHaveBeenCalled();
  });

  it("shares one refresh across concurrent unauthorized requests", async () => {
    jest.mocked(authApi.refreshWechatSession).mockResolvedValue(newSession);
    jest
      .mocked(apiRequest)
      .mockRejectedValueOnce(new MiniappApiError("AUTH_SESSION_EXPIRED", "expired", "r1", 401))
      .mockRejectedValueOnce(new MiniappApiError("AUTH_SESSION_EXPIRED", "expired", "r2", 401))
      .mockResolvedValueOnce({ ok: 1 })
      .mockResolvedValueOnce({ ok: 2 });

    await expect(
      Promise.all([requestWithSession("/one"), requestWithSession("/two")]),
    ).resolves.toEqual([{ ok: 1 }, { ok: 2 }]);
    expect(authApi.refreshWechatSession).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledTimes(4);
  });

  it("clears storage and preserves the original auth error when refresh fails", async () => {
    const authError = new MiniappApiError("AUTH_SESSION_EXPIRED", "expired", "r1", 401);

    jest.mocked(apiRequest).mockRejectedValueOnce(authError);
    jest
      .mocked(authApi.refreshWechatSession)
      .mockRejectedValue(new MiniappApiError("AUTH_SESSION_EXPIRED", "refresh failed", "r2", 401));

    await expect(requestWithSession("/protected")).rejects.toBe(authError);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(Taro.removeStorage).toHaveBeenCalled();
  });
});
