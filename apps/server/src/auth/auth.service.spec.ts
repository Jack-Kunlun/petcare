import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { CaptchaService } from "./captcha.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { VerificationCodeService } from "./verification-code.service";

const activeAdmin = {
  id: "user-1",
  username: "admin",
  phone: "13800138000",
  nickname: "系统管理员",
  status: "active",
  passwordHash: "$argon2id$v=19$test",
  roles: [
    {
      role: {
        roleName: "super_admin",
        isActive: true,
        permissions: [
          { permission: { permissionCode: "system.view" } },
          { permission: { permissionCode: "system.publish" } },
        ],
      },
    },
  ],
};
const activeDisputeResolver = {
  ...activeAdmin,
  id: "resolver-1",
  username: "resolver",
  phone: "17679141879",
  roles: [{ role: { roleName: "complaint_resolver", isActive: true, permissions: [] } }],
};

describe("AuthService", () => {
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let passwordService: { verify: jest.Mock };
  let verificationCodeService: { send: jest.Mock; verifyAndConsume: jest.Mock };
  let tokenService: { issue: jest.Mock; consumeRefresh: jest.Mock; revoke: jest.Mock };
  let captchaService: { verifyAndConsume: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(activeAdmin),
        findUnique: jest.fn().mockResolvedValue(activeAdmin),
      },
    };
    passwordService = { verify: jest.fn().mockResolvedValue(true) };
    verificationCodeService = {
      send: jest.fn().mockResolvedValue(undefined),
      verifyAndConsume: jest.fn().mockResolvedValue(true),
    };
    tokenService = {
      issue: jest.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh" }),
      consumeRefresh: jest.fn().mockResolvedValue({ userId: "user-1", sessionId: "session-1" }),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    captchaService = { verifyAndConsume: jest.fn().mockResolvedValue(true) };
    service = new AuthService(
      prisma as unknown as PrismaService,
      passwordService as unknown as PasswordService,
      verificationCodeService as unknown as VerificationCodeService,
      tokenService as unknown as TokenService,
      captchaService as unknown as CaptchaService,
    );
  });

  it("logs in with either a username or phone identifier", async () => {
    const result = await service.loginWithPassword("admin", "Correct-Horse-Battery-Staple!42");

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ phone: "admin" }, { username: "admin" }] },
      }),
    );
    expect(passwordService.verify).toHaveBeenCalledWith(
      activeAdmin.passwordHash,
      "Correct-Horse-Battery-Staple!42",
    );
    expect(result).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      user: {
        id: "user-1",
        username: "admin",
        phone: "13800138000",
        nickname: "系统管理员",
        roles: ["super_admin"],
        permissions: ["system.view", "system.publish"],
      },
    });
  });

  it("allows an active ordinary RBAC administrator to log in", async () => {
    prisma.user.findFirst.mockResolvedValue(activeDisputeResolver);

    await expect(
      service.loginWithPassword("resolver", "Correct-Horse-Battery-Staple!42"),
    ).resolves.toMatchObject({
      user: {
        id: "resolver-1",
        roles: ["complaint_resolver"],
      },
    });
  });

  it("excludes orphan database permissions from the password login response", async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...activeAdmin,
      roles: [
        {
          role: {
            ...activeAdmin.roles[0].role,
            permissions: [
              { permission: { permissionCode: "system.view" } },
              { permission: { permissionCode: "retired.permission" } },
            ],
          },
        },
      ],
    });

    await expect(
      service.loginWithPassword("admin", "Correct-Horse-Battery-Staple!42"),
    ).resolves.toMatchObject({
      user: { permissions: ["system.view"] },
    });
  });

  it.each([
    ["missing account", null, true],
    ["wrong password", activeAdmin, false],
    ["inactive account", { ...activeAdmin, status: "inactive" }, true],
    ["non administrator", { ...activeAdmin, roles: [] }, true],
  ])("returns one generic error for %s", async (_label, databaseUser, passwordValid) => {
    prisma.user.findFirst.mockResolvedValue(databaseUser);
    passwordService.verify.mockResolvedValue(passwordValid);

    await expect(service.loginWithPassword("admin", "wrong-password-value")).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
      clientMessage: "账号或凭据错误",
      status: 401,
    });
  });

  it("logs in with a consumed SMS verification code", async () => {
    const result = await service.loginWithSms("13800138000", "246810");

    expect(verificationCodeService.verifyAndConsume).toHaveBeenCalledWith("13800138000", "246810");
    expect(result.accessToken).toBe("access");
  });

  it("does not reveal whether a phone belongs to an administrator when sending a code", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.sendSmsCode("13800138000", "0123456789abcdef", "2345")).resolves.toEqual({
      message: "如果该手机号可用于后台登录，验证码将会发送",
    });
    expect(captchaService.verifyAndConsume).toHaveBeenCalledWith("0123456789abcdef", "2345");
    expect(verificationCodeService.send).not.toHaveBeenCalled();
  });

  it("rejects an invalid captcha before looking up an administrator", async () => {
    captchaService.verifyAndConsume.mockResolvedValue(false);

    await expect(
      service.sendSmsCode("13800138000", "0123456789abcdef", "2345"),
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_CAPTCHA",
      clientMessage: "图形验证码错误或已过期",
      status: 400,
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(verificationCodeService.send).not.toHaveBeenCalled();
  });

  it("sends an SMS only after consuming a valid captcha", async () => {
    await service.sendSmsCode("13800138000", "0123456789abcdef", "2345");

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        phone: "13800138000",
        status: "active",
        roles: { some: { role: { isActive: true } } },
      },
      select: { id: true },
    });
    expect(verificationCodeService.send).toHaveBeenCalledWith("13800138000");
    expect(captchaService.verifyAndConsume.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.user.findFirst.mock.invocationCallOrder[0],
    );
  });

  it("consumes the old refresh session before issuing a new session", async () => {
    const result = await service.refresh("old-refresh-token");

    expect(tokenService.consumeRefresh).toHaveBeenCalledWith("old-refresh-token");
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
    expect(result.refreshToken).toBe("refresh");
  });

  it("returns only active administrator roles and their permission codes for authorization", async () => {
    prisma.user.findFirst.mockResolvedValue({
      roles: [
        {
          role: {
            roleName: "config_admin",
            permissions: [
              { permission: { permissionCode: "system.view" } },
              { permission: { permissionCode: "system.publish" } },
            ],
          },
        },
      ],
    });

    await expect(service.getCurrentUserAuthorization("user-1")).resolves.toEqual({
      roles: ["config_admin"],
      permissions: ["system.view", "system.publish"],
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: "user-1",
        status: "active",
        roles: { some: { role: { isActive: true } } },
      },
      select: {
        roles: {
          where: { role: { isActive: true } },
          select: {
            role: {
              select: {
                roleName: true,
                permissions: {
                  select: { permission: { select: { permissionCode: true } } },
                },
              },
            },
          },
        },
      },
    });
  });

  it("keeps role names but excludes duplicate and orphan database permissions from authorization", async () => {
    prisma.user.findFirst.mockResolvedValue({
      roles: [
        {
          role: {
            roleName: "config_admin",
            permissions: [
              { permission: { permissionCode: "system.view" } },
              { permission: { permissionCode: "retired.permission" } },
            ],
          },
        },
        {
          role: {
            roleName: "config_admin",
            permissions: [{ permission: { permissionCode: "system.view" } }],
          },
        },
      ],
    });

    await expect(service.getCurrentUserAuthorization("user-1")).resolves.toEqual({
      roles: ["config_admin", "config_admin"],
      permissions: ["system.view"],
    });
  });
});
