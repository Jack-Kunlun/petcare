import { HttpStatus } from "@nestjs/common";
import { PasswordService } from "../../auth/password.service";
import { TokenService } from "../../auth/token.service";
import { AppLogger } from "../../logging/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import { PublicAvatarStorage } from "../../public-avatar-storage/public-avatar-storage.types";
import { AdminAccountService } from "./admin-account.service";

describe("AdminAccountService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const transaction = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const passwordService = { verify: jest.fn(), hash: jest.fn() };
  const tokenService = { revokeSession: jest.fn() };
  const logger = { write: jest.fn() };
  const avatarStorage = { upload: jest.fn(), delete: jest.fn() };
  const service = new AdminAccountService(
    prisma as unknown as PrismaService,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
    logger as unknown as AppLogger,
    avatarStorage as unknown as PublicAvatarStorage,
  );
  const mutationContext = { userId: "user-1", sessionId: "session-1", requestId: "request-1" };

  beforeEach(() => jest.clearAllMocks());

  it("returns the current administrator profile without sensitive persisted fields", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "admin",
      phone: "17679141878",
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
      maskedPhone: "176****1878",
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

  it("trims a nickname before persisting it and returns the latest safe profile", async () => {
    prisma.user.update.mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "admin",
      phone: "17679141878",
      nickname: "值班管理员",
      avatar: null,
      status: "active",
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
      roles: [{ role: { roleName: "operator" } }],
    });

    await expect(service.updateProfile("user-1", "  值班管理员  ")).resolves.toEqual({
      id: "user-1",
      username: "admin",
      maskedPhone: "176****1878",
      nickname: "值班管理员",
      avatar: null,
      status: "active",
      roles: ["operator"],
      createdAt: "2026-07-22T00:00:00.000Z",
    });

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
    ).rejects.toMatchObject({
      code: "ACCOUNT_PASSWORD_NOT_CONFIGURED",
      status: HttpStatus.CONFLICT,
    });
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
    ).rejects.toMatchObject({
      code: "ACCOUNT_CURRENT_PASSWORD_INVALID",
      status: HttpStatus.UNAUTHORIZED,
    });
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

  it("keeps a completed password change successful when session revocation is unavailable", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: "old-hash", sessionVersion: 2 });
    passwordService.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    passwordService.hash.mockResolvedValue("new-hash");
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    tokenService.revokeSession.mockRejectedValue(new Error("Redis unavailable"));

    await expect(
      service.changePassword(mutationContext, {
        currentPassword: "Current-password-1",
        newPassword: "Replacement-password-2",
      }),
    ).resolves.toBeUndefined();

    expect(logger.write).toHaveBeenCalledWith("error", "admin_account.session_revoke_failed", {
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

  it("stores the new avatar before atomically swapping the record and then removes the old managed object", async () => {
    const file = {
      body: Buffer.from("png-avatar"),
      contentType: "image/png" as const,
      extension: "png" as const,
    };

    avatarStorage.upload.mockResolvedValue({
      objectKey: "public/admin-avatars/user-1/new.png",
      publicUrl: "https://cdn.example.com/new.png",
    });
    transaction.user.findUnique.mockResolvedValue({
      avatarObjectKey: "public/admin-avatars/user-1/old.png",
    });
    transaction.user.update.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation((operation) => operation(transaction));

    await expect(service.replaceAvatar(mutationContext, file)).resolves.toEqual({
      avatar: "https://cdn.example.com/new.png",
    });

    expect(avatarStorage.upload).toHaveBeenCalledWith({ userId: "user-1", ...file });
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        avatar: "https://cdn.example.com/new.png",
        avatarObjectKey: "public/admin-avatars/user-1/new.png",
      },
    });
    expect(avatarStorage.delete).toHaveBeenCalledWith("public/admin-avatars/user-1/old.png");
    expect(logger.write).toHaveBeenCalledWith("info", "admin_account.avatar_updated", {
      userId: "user-1",
      result: "success",
      requestId: "request-1",
    });
  });

  it("deletes the newly uploaded object and rethrows when the avatar record swap fails", async () => {
    const databaseError = new Error("database unavailable");
    const file = {
      body: Buffer.from("png-avatar"),
      contentType: "image/png" as const,
      extension: "png" as const,
    };

    avatarStorage.upload.mockResolvedValue({
      objectKey: "public/admin-avatars/user-1/new.png",
      publicUrl: "https://cdn.example.com/new.png",
    });
    prisma.$transaction.mockRejectedValue(databaseError);
    avatarStorage.delete.mockRejectedValue(new Error("cleanup unavailable"));

    await expect(service.replaceAvatar(mutationContext, file)).rejects.toBe(databaseError);

    expect(avatarStorage.delete).toHaveBeenCalledWith("public/admin-avatars/user-1/new.png");
    expect(logger.write).toHaveBeenCalledWith("error", "admin_account.avatar_cleanup_failed", {
      userId: "user-1",
      objectKey: "public/admin-avatars/user-1/new.png",
    });
  });

  it("logs an old-avatar cleanup failure while retaining the successfully replaced avatar", async () => {
    const file = {
      body: Buffer.from("png-avatar"),
      contentType: "image/png" as const,
      extension: "png" as const,
    };

    avatarStorage.upload.mockResolvedValue({
      objectKey: "public/admin-avatars/user-1/new.png",
      publicUrl: "https://cdn.example.com/new.png",
    });
    transaction.user.findUnique.mockResolvedValue({
      avatarObjectKey: "public/admin-avatars/user-1/old.png",
    });
    transaction.user.update.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation((operation) => operation(transaction));
    avatarStorage.delete.mockRejectedValue(new Error("cleanup unavailable"));

    await expect(service.replaceAvatar(mutationContext, file)).resolves.toEqual({
      avatar: "https://cdn.example.com/new.png",
    });

    expect(logger.write).toHaveBeenCalledWith("error", "admin_account.avatar_cleanup_failed", {
      userId: "user-1",
      objectKey: "public/admin-avatars/user-1/old.png",
    });
  });

  it("retries a serializable avatar swap conflict up to the successful third attempt", async () => {
    const file = {
      body: Buffer.from("png-avatar"),
      contentType: "image/png" as const,
      extension: "png" as const,
    };
    const serializationConflict = { code: "P2034" };

    avatarStorage.upload.mockResolvedValue({
      objectKey: "public/admin-avatars/user-1/new.png",
      publicUrl: "https://cdn.example.com/new.png",
    });
    transaction.user.findUnique.mockResolvedValue({ avatarObjectKey: null });
    transaction.user.update.mockResolvedValue(undefined);
    prisma.$transaction
      .mockRejectedValueOnce(serializationConflict)
      .mockRejectedValueOnce(serializationConflict)
      .mockImplementationOnce((operation) => operation(transaction));

    await expect(service.replaceAvatar(mutationContext, file)).resolves.toEqual({
      avatar: "https://cdn.example.com/new.png",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.$transaction).toHaveBeenNthCalledWith(
      3,
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" }),
    );
    expect(avatarStorage.delete).not.toHaveBeenCalled();
  });

  it("compensates the new object and returns a stable conflict after three serializable failures", async () => {
    const file = {
      body: Buffer.from("png-avatar"),
      contentType: "image/png" as const,
      extension: "png" as const,
    };

    avatarStorage.upload.mockResolvedValue({
      objectKey: "public/admin-avatars/user-1/new.png",
      publicUrl: "https://cdn.example.com/new.png",
    });
    prisma.$transaction.mockRejectedValue({ code: "P2034" });

    await expect(service.replaceAvatar(mutationContext, file)).rejects.toMatchObject({
      code: "ACCOUNT_CONCURRENT_UPDATE",
      status: HttpStatus.CONFLICT,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(avatarStorage.delete).toHaveBeenCalledWith("public/admin-avatars/user-1/new.png");
  });

  it("clears the database avatar before best-effort deletion of its old managed object", async () => {
    const sequence: string[] = [];

    transaction.user.findUnique.mockResolvedValue({
      avatarObjectKey: "public/admin-avatars/user-1/old.png",
    });
    transaction.user.update.mockImplementation(async () => {
      sequence.push("database");
    });
    prisma.$transaction.mockImplementation((operation) => operation(transaction));
    avatarStorage.delete.mockImplementation(async () => {
      sequence.push("storage");
      throw new Error("cleanup unavailable");
    });

    await expect(service.deleteAvatar(mutationContext)).resolves.toBeUndefined();

    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { avatar: null, avatarObjectKey: null },
    });
    expect(avatarStorage.delete).toHaveBeenCalledWith("public/admin-avatars/user-1/old.png");
    expect(sequence).toEqual(["database", "storage"]);
    expect(logger.write).toHaveBeenCalledWith("error", "admin_account.avatar_cleanup_failed", {
      userId: "user-1",
      objectKey: "public/admin-avatars/user-1/old.png",
    });
    expect(logger.write).toHaveBeenCalledWith("info", "admin_account.avatar_deleted", {
      userId: "user-1",
      result: "success",
      requestId: "request-1",
    });
  });

  it("does not delete an externally hosted avatar whose object key is null", async () => {
    const file = {
      body: Buffer.from("png-avatar"),
      contentType: "image/png" as const,
      extension: "png" as const,
    };

    avatarStorage.upload.mockResolvedValue({
      objectKey: "public/admin-avatars/user-1/new.png",
      publicUrl: "https://cdn.example.com/new.png",
    });
    transaction.user.findUnique.mockResolvedValue({
      avatar: "https://external.example.com/avatar.png",
      avatarObjectKey: null,
    });
    transaction.user.update.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation((operation) => operation(transaction));

    await expect(service.replaceAvatar(mutationContext, file)).resolves.toEqual({
      avatar: "https://cdn.example.com/new.png",
    });

    expect(avatarStorage.delete).not.toHaveBeenCalled();
  });

  it("clears a default avatar without issuing a storage deletion", async () => {
    transaction.user.findUnique.mockResolvedValue({ avatarObjectKey: null });
    transaction.user.update.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation((operation) => operation(transaction));

    await expect(service.deleteAvatar(mutationContext)).resolves.toBeUndefined();

    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { avatar: null, avatarObjectKey: null },
    });
    expect(avatarStorage.delete).not.toHaveBeenCalled();
  });
});
