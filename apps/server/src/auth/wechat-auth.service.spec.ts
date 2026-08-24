import { RedisService } from "../config/redis.service";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "./token.service";
import { WechatApiClient } from "./wechat-api.client";
import { WechatAuthService } from "./wechat-auth.service";

function createActiveUser(phone: string | null = "13800138000") {
  return {
    id: "user-1",
    openid: "openid-1",
    phone,
    username: null,
    nickname: "宠友1878",
    avatar: null,
    sessionVersion: 0,
    userType: "pet_owner",
    status: "active",
    roles: [],
  };
}

const activeUser = createActiveUser();

describe("WechatAuthService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const redis = {
    set: jest.fn(),
    getAndDelete: jest.fn(),
  };
  const wechatApiClient = {
    exchangeLoginCode: jest.fn(),
    getPhoneNumber: jest.fn(),
  };
  const tokenService = {
    issue: jest.fn(),
    consumeRefresh: jest.fn(),
    revoke: jest.fn(),
  };
  let usersByOpenid: Record<string, typeof activeUser | null>;
  let usersByPhone: Record<string, typeof activeUser | null>;
  let service: WechatAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    usersByOpenid = {};
    usersByPhone = {};
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { openid?: string; phone?: string; id?: string } }) => {
        if (where.openid) {
          return usersByOpenid[where.openid] ?? null;
        }

        if (where.phone) {
          return usersByPhone[where.phone] ?? null;
        }

        return where.id === activeUser.id ? activeUser : null;
      },
    );
    prisma.user.create.mockResolvedValue(activeUser);
    prisma.user.update.mockResolvedValue(activeUser);
    prisma.$transaction.mockImplementation((callback: (client: typeof prisma) => unknown) =>
      callback(prisma),
    );
    redis.set.mockResolvedValue(undefined);
    redis.getAndDelete.mockResolvedValue("openid-1");
    wechatApiClient.exchangeLoginCode.mockResolvedValue({
      openid: "openid-1",
      sessionKey: "session-key",
    });
    wechatApiClient.getPhoneNumber.mockResolvedValue("13800138000");
    tokenService.issue.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });
    tokenService.consumeRefresh.mockResolvedValue({
      userId: "user-1",
      sessionId: "session-1",
    });
    tokenService.revoke.mockResolvedValue(undefined);

    service = new WechatAuthService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      wechatApiClient as unknown as WechatApiClient,
      tokenService as unknown as TokenService,
    );
  });

  it("issues a session for an existing openid", async () => {
    usersByOpenid["openid-1"] = activeUser;

    await expect(service.login("login-code")).resolves.toEqual({
      status: "authenticated",
      accessToken: "access",
      refreshToken: "refresh",
      user: {
        id: "user-1",
        phoneMasked: "138****8000",
        profileComplete: true,
        nickname: "宠友1878",
        avatar: null,
        userType: "pet_owner",
        region: null,
        bio: null,
      },
    });
    expect(tokenService.issue).toHaveBeenCalledWith(expect.objectContaining({ sessionVersion: 0 }));
  });

  it("issues an unbound active session without leaking a phone", async () => {
    usersByOpenid["openid-1"] = createActiveUser(null);

    const result = await service.login("login-code");

    expect(result).toMatchObject({
      status: "authenticated",
      accessToken: "access",
      refreshToken: "refresh",
      user: {
        id: "user-1",
        phoneMasked: null,
        profileComplete: false,
      },
    });
    expect(result).not.toHaveProperty("user.phone");
  });

  it("stores a short-lived binding challenge without creating a user", async () => {
    const result = await service.login("login-code");

    expect(result).toEqual({
      status: "phone_required",
      bindToken: expect.any(String),
    });
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:wechat-bind:[a-f0-9]{64}$/),
      "openid-1",
      300,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates a pet owner for a new authorized phone", async () => {
    await expect(service.bindPhone("bind-token", "phone-code")).resolves.toMatchObject({
      status: "authenticated",
      accessToken: "access",
      user: { phoneMasked: "138****8000", profileComplete: true, nickname: "宠友1878" },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          openid: "openid-1",
          phone: "13800138000",
          nickname: "宠友1878",
          userType: "pet_owner",
        }),
      }),
    );
  });

  it("binds an unbound existing phone account without replacing its data or roles", async () => {
    const existingPhoneUser = {
      ...activeUser,
      openid: null,
      nickname: "已有用户",
      roles: [{ role: { roleName: "super_admin", isActive: true } }],
    };

    usersByPhone["13800138000"] = existingPhoneUser as typeof activeUser;
    prisma.user.update.mockResolvedValue(existingPhoneUser);

    await expect(service.bindPhone("bind-token", "phone-code")).resolves.toMatchObject({
      user: { id: "user-1", nickname: "已有用户" },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { openid: "openid-1" },
      }),
    );
    expect(tokenService.issue).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ["super_admin"] }),
    );
  });

  it.each([
    ["the phone belongs to another openid", null, { ...activeUser, openid: "openid-2" }],
    ["the openid belongs to another phone", { ...activeUser, phone: "17679141879" }, null],
  ])("rejects an account conflict when %s", async (_name, openidUser, phoneUser) => {
    usersByOpenid["openid-1"] = openidUser;
    usersByPhone["13800138000"] = phoneUser;

    await expect(service.bindPhone("bind-token", "phone-code")).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_CONFLICT",
      status: 409,
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects disabled accounts", async () => {
    usersByPhone["13800138000"] = { ...activeUser, status: "banned" };

    await expect(service.bindPhone("bind-token", "phone-code")).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_DISABLED",
      status: 403,
    });
  });

  it("authorizes the phone before atomically consuming the bind token", async () => {
    const callOrder: string[] = [];

    wechatApiClient.getPhoneNumber.mockImplementation(async () => {
      callOrder.push("phone");

      return "13800138000";
    });
    redis.getAndDelete.mockImplementation(async () => {
      callOrder.push("consume");

      return null;
    });

    await expect(service.bindPhone("bind-token", "phone-code")).rejects.toMatchObject({
      code: "AUTH_BIND_TOKEN_EXPIRED",
      status: 401,
    });
    expect(callOrder).toEqual(["phone", "consume"]);
  });

  it("maps unique constraint races to an account conflict", async () => {
    prisma.user.create.mockRejectedValue({ code: "P2002" });

    await expect(service.bindPhone("bind-token", "phone-code")).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_CONFLICT",
      status: 409,
    });
  });

  it("rotates refresh tokens after loading an active account", async () => {
    await expect(service.refresh("old-refresh")).resolves.toMatchObject({
      accessToken: "access",
      refreshToken: "refresh",
    });
    expect(tokenService.consumeRefresh).toHaveBeenCalledWith("old-refresh");
    expect(tokenService.issue).toHaveBeenCalled();
  });

  it("distinguishes a missing session account from a disabled account", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.getCurrentUser("missing-user")).rejects.toMatchObject({
      code: "AUTH_SESSION_EXPIRED",
      status: 401,
    });

    prisma.user.findUnique.mockResolvedValueOnce({ ...activeUser, status: "inactive" });

    await expect(service.getCurrentUser("user-1")).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_DISABLED",
      status: 403,
    });
  });

  it("delegates logout without leaking token validation details", async () => {
    await expect(service.logout("refresh-token")).resolves.toBeUndefined();
    expect(tokenService.revoke).toHaveBeenCalledWith("refresh-token");
  });
});
