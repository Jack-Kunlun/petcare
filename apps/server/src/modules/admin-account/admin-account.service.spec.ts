import { PasswordService } from "../../auth/password.service";
import { TokenService } from "../../auth/token.service";
import { AppLogger } from "../../logging/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminAccountService } from "./admin-account.service";

describe("AdminAccountService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const passwordService = { verify: jest.fn(), hash: jest.fn() };
  const tokenService = { revokeSession: jest.fn() };
  const logger = { write: jest.fn() };
  const service = new AdminAccountService(
    prisma as unknown as PrismaService,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
    logger as unknown as AppLogger,
  );

  beforeEach(() => jest.clearAllMocks());

  it("returns the current administrator profile without sensitive persisted fields", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "admin",
      phone: "13800138000",
      nickname: "系统管理员",
      avatar: null,
      status: "active",
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
      passwordHash: "must-not-leak",
      avatarObjectKey: "must-not-leak",
      sessionVersion: 4,
      roles: [{ role: { roleName: "operator" } }],
    });

    await expect(service.getProfile("user-1")).resolves.toEqual({
      id: "user-1",
      username: "admin",
      maskedPhone: "138****8000",
      nickname: "系统管理员",
      avatar: null,
      status: "active",
      roles: ["operator"],
      createdAt: "2026-07-22T00:00:00.000Z",
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.not.objectContaining({
        passwordHash: true,
        avatarObjectKey: true,
        sessionVersion: true,
      }),
    });
  });

  it("does not expose a malformed short stored phone number", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: null,
      phone: "123",
      nickname: "管理员",
      avatar: null,
      status: "active",
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
      roles: [],
    });

    await expect(service.getProfile("user-1")).resolves.toMatchObject({ maskedPhone: "****" });
  });

  it("trims a nickname before persisting it", async () => {
    prisma.user.update.mockResolvedValue(undefined);

    await service.updateProfile("user-1", "  值班管理员  ");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { nickname: "值班管理员" },
    });
  });

  it("rejects control characters after normalizing a nickname", async () => {
    await expect(service.updateProfile("user-1", "值班\n管理员")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects password rotation when no password is configured", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: null, sessionVersion: 2 });

    await expect(
      service.changePassword(
        { userId: "user-1", sessionId: "session-1", requestId: "request-1" },
        { currentPassword: "Current-password-1", newPassword: "Replacement-password-2" },
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_PASSWORD_NOT_CONFIGURED" });
    expect(passwordService.verify).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password before checking reuse", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: "old-hash", sessionVersion: 2 });
    passwordService.verify.mockResolvedValueOnce(false);

    await expect(
      service.changePassword(
        { userId: "user-1", sessionId: "session-1", requestId: "request-1" },
        { currentPassword: "Wrong-password-1", newPassword: "Replacement-password-2" },
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_CURRENT_PASSWORD_INVALID" });
    expect(passwordService.verify).toHaveBeenCalledTimes(1);
  });

  it("rejects a replacement password that matches the current hash", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: "old-hash", sessionVersion: 2 });
    passwordService.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await expect(
      service.changePassword(
        { userId: "user-1", sessionId: "session-1", requestId: "request-1" },
        { currentPassword: "Current-password-1", newPassword: "Current-password-1" },
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_PASSWORD_REUSED" });
    expect(passwordService.hash).not.toHaveBeenCalled();
  });

  it("rotates the password with an optimistic version predicate and revokes only this session", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: "old-hash", sessionVersion: 2 });
    passwordService.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    passwordService.hash.mockResolvedValue("new-hash");
    prisma.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.changePassword(
        { userId: "user-1", sessionId: "session-1", requestId: "request-1" },
        { currentPassword: "Current-password-1", newPassword: "Replacement-password-2" },
      ),
    ).resolves.toBeUndefined();

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", passwordHash: "old-hash", sessionVersion: 2 },
      data: { passwordHash: "new-hash", sessionVersion: { increment: 1 } },
    });
    expect(tokenService.revokeSession).toHaveBeenCalledWith("session-1");
    expect(logger.write).toHaveBeenCalledWith("info", "admin_account.password_changed", {
      userId: "user-1",
      sessionId: "session-1",
      requestId: "request-1",
    });
  });

  it("returns a stable conflict when another password rotation wins the optimistic update", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: "old-hash", sessionVersion: 2 });
    passwordService.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    passwordService.hash.mockResolvedValue("new-hash");
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.changePassword(
        { userId: "user-1", sessionId: "session-1", requestId: "request-1" },
        { currentPassword: "Current-password-1", newPassword: "Replacement-password-2" },
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_CONCURRENT_UPDATE" });
    expect(tokenService.revokeSession).not.toHaveBeenCalled();
  });
});
