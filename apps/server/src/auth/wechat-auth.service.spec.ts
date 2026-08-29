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
    nickname: phone ? "宠友1878" : "宠友123456",
    avatar: null,
    sessionVersion: 0,
    userType: "pet_owner",
    status: "active",
    profile: null,
    roles: [],
  };
}

const activeUser = createActiveUser();

describe("WechatAuthService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    userProfile: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const wechatApiClient = {
    exchangeLoginCode: jest.fn(),
  };
  const tokenService = {
    issue: jest.fn(),
    consumeRefresh: jest.fn(),
    revoke: jest.fn(),
  };
  let usersByOpenid: Record<string, ReturnType<typeof createActiveUser> | null>;
  let service: WechatAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    usersByOpenid = {};
    prisma.user.findUnique.mockImplementation(
      ({ where }: { where: { openid?: string; id?: string } }) => {
        if (where.openid) {
          return usersByOpenid[where.openid] ?? null;
        }

        return where.id === activeUser.id ? activeUser : null;
      },
    );
    prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...createActiveUser(null),
      ...data,
    }));
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.userProfile.deleteMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation((callback: (client: typeof prisma) => unknown) =>
      callback(prisma),
    );
    wechatApiClient.exchangeLoginCode.mockResolvedValue({
      openid: "openid-1",
      sessionKey: "session-key",
    });
    tokenService.issue.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    tokenService.consumeRefresh.mockResolvedValue({
      userId: "user-1",
      sessionId: "session-1",
    });
    tokenService.revoke.mockResolvedValue(undefined);

    service = new WechatAuthService(
      prisma as unknown as PrismaService,
      wechatApiClient as unknown as WechatApiClient,
      tokenService as unknown as TokenService,
    );
  });

  it("creates an active unbound account and returns a session on first login", async () => {
    const result = await service.login("login-code");

    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-1",
        phoneMasked: null,
        profileComplete: false,
        nickname: expect.stringMatching(/^宠友\d{6}$/),
        avatar: null,
        userType: "pet_owner",
        region: null,
        bio: null,
      },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        openid: "openid-1",
        phone: null,
        nickname: expect.stringMatching(/^宠友\d{6}$/),
        userType: "pet_owner",
        status: "active",
      },
      select: expect.any(Object),
    });
    expect(result.user).not.toHaveProperty("phone");
  });

  it("returns a privacy-safe session for an existing active account", async () => {
    usersByOpenid["openid-1"] = activeUser;

    await expect(service.login("login-code")).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
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
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("re-reads and returns the winning account after a concurrent openid creation", async () => {
    const winner = createActiveUser(null);

    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    prisma.user.create.mockRejectedValueOnce({ code: "P2002" });

    await expect(service.login("login-code")).resolves.toMatchObject({
      accessToken: "access-token",
      user: { id: "user-1", phoneMasked: null, profileComplete: false },
    });
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("releases a legacy cancelled openid and creates a fresh account", async () => {
    usersByOpenid["openid-1"] = { ...activeUser, id: "cancelled-user", status: "inactive" };

    await expect(service.login("login-code")).resolves.toMatchObject({
      user: { id: "user-1" },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "cancelled-user", openid: "openid-1", status: "inactive" },
      data: expect.objectContaining({ openid: null, status: "inactive" }),
    });
    expect(prisma.userProfile.deleteMany).toHaveBeenCalledWith({
      where: { userId: "cancelled-user" },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ openid: "openid-1", status: "active" }),
      }),
    );
  });

  it("rejects a banned openid without creating a replacement", async () => {
    usersByOpenid["openid-1"] = { ...activeUser, status: "banned" };

    await expect(service.login("login-code")).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_DISABLED",
      status: 403,
    });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rotates refresh tokens after loading an active account", async () => {
    await expect(service.refresh("old-refresh")).resolves.toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(tokenService.consumeRefresh).toHaveBeenCalledWith("old-refresh");
    expect(tokenService.issue).toHaveBeenCalled();
  });

  it("delegates logout without leaking token validation details", async () => {
    await expect(service.logout("refresh-token")).resolves.toBeUndefined();
    expect(tokenService.revoke).toHaveBeenCalledWith("refresh-token");
  });
});
