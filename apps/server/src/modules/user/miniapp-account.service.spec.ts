import { HttpStatus } from "@nestjs/common";
import { MINIAPP_ACCOUNT_ERROR_CODE } from "@petcare/shared-types";
import { VerificationCodeService } from "../../auth/verification-code.service";
import { AppLogger } from "../../logging/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import { PublicAvatarStorage } from "../../public-avatar-storage/public-avatar-storage.types";
import { MiniappAccountService } from "./miniapp-account.service";

describe("MiniappAccountService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    userProfile: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const transaction = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
  };
  const verificationCodeService = {
    send: jest.fn(),
    verifyAndConsume: jest.fn(),
  };
  const logger = { write: jest.fn() };
  const avatarStorage = { upload: jest.fn(), delete: jest.fn() };
  const service = new MiniappAccountService(
    prisma as unknown as PrismaService,
    verificationCodeService as unknown as VerificationCodeService,
    logger as unknown as AppLogger,
    avatarStorage as unknown as PublicAvatarStorage,
  );
  const selectedUser = {
    id: "user-1",
    nickname: "宠友123456",
    avatar: null,
    avatarObjectKey: null,
    phone: "13800138000",
    userType: "pet_owner",
    status: "active",
    profile: { address: "上海市", bio: "爱猫人士" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((operation) => operation(transaction));
  });

  it("returns only a masked phone and the derived completion state", async () => {
    prisma.user.findUnique.mockResolvedValue(selectedUser);

    await expect(service.getProfile("user-1")).resolves.toEqual({
      id: "user-1",
      nickname: "宠友123456",
      avatar: null,
      phoneMasked: "138****8000",
      profileComplete: true,
      userType: "pet_owner",
      region: "上海市",
      bio: "爱猫人士",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.not.objectContaining({ passwordHash: true }),
    });
  });

  it("fails closed when a stored phone is malformed", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...selectedUser, phone: "1767" });

    await expect(service.getProfile("user-1")).resolves.toMatchObject({
      phoneMasked: "****",
      profileComplete: true,
    });
  });

  it("normalizes and persists editable profile text through one atomic user write", async () => {
    prisma.user.update.mockResolvedValue(undefined);
    prisma.userProfile.upsert.mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValue({
      ...selectedUser,
      nickname: "小白家长",
      profile: { address: null, bio: "喜欢猫咪" },
    });

    await expect(
      service.updateProfile("user-1", {
        nickname: "  小白家长  ",
        region: "   ",
        bio: "  喜欢猫咪  ",
      }),
    ).resolves.toMatchObject({ nickname: "小白家长", region: null, bio: "喜欢猫咪" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        nickname: "小白家长",
        profile: {
          upsert: {
            create: { address: null, bio: "喜欢猫咪" },
            update: { address: null, bio: "喜欢猫咪" },
          },
        },
      },
    });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.userProfile.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["nickname", { nickname: "家长\n甲", region: null, bio: null }],
    ["nickname", { nickname: "甲".repeat(25), region: null, bio: null }],
    ["region", { nickname: "家长甲", region: "地区\u0000", bio: null }],
    ["bio", { nickname: "家长甲", region: null, bio: "甲".repeat(201) }],
  ])("rejects invalid %s text", async (_field, input) => {
    await expect(service.updateProfile("user-1", input)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      status: HttpStatus.BAD_REQUEST,
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("sends a user-scoped binding code only while the account is unbound", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ phone: null });
    verificationCodeService.send.mockResolvedValue(undefined);

    await expect(service.sendPhoneCode("user-1", "13800138000")).resolves.toBeUndefined();
    expect(verificationCodeService.send).toHaveBeenCalledWith({
      phone: "13800138000",
      purpose: "miniapp_bind_phone",
      subject: "user-1",
    });

    prisma.user.findUnique.mockResolvedValueOnce({ phone: "13800138000" });
    await expect(service.sendPhoneCode("user-1", "13912345678")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.PHONE_ALREADY_BOUND,
      status: HttpStatus.CONFLICT,
    });
    expect(verificationCodeService.send).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid binding code without updating the account", async () => {
    prisma.user.findUnique.mockResolvedValue({ phone: null });
    verificationCodeService.verifyAndConsume.mockResolvedValue(false);

    await expect(service.bindPhone("user-1", "13800138000", "123456")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.VERIFICATION_CODE_INVALID,
      status: HttpStatus.BAD_REQUEST,
    });
    expect(verificationCodeService.verifyAndConsume).toHaveBeenCalledWith({
      phone: "13800138000",
      code: "123456",
      purpose: "miniapp_bind_phone",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("binds the verified phone with an atomic unbound predicate", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ phone: null })
      .mockResolvedValueOnce({ ...selectedUser });
    verificationCodeService.verifyAndConsume.mockResolvedValue(true);
    transaction.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.bindPhone("user-1", "13800138000", "123456")).resolves.toMatchObject({
      phoneMasked: "138****8000",
      profileComplete: true,
    });
    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", phone: null, status: "active" },
      data: { phone: "13800138000" },
    });
  });

  it("maps a lost unbound-account race to a stable conflict", async () => {
    prisma.user.findUnique.mockResolvedValue({ phone: null });
    verificationCodeService.verifyAndConsume.mockResolvedValue(true);
    transaction.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.bindPhone("user-1", "13800138000", "123456")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.PHONE_ALREADY_BOUND,
      status: HttpStatus.CONFLICT,
    });
  });

  it("maps a unique phone collision to a stable conflict", async () => {
    prisma.user.findUnique.mockResolvedValue({ phone: null });
    verificationCodeService.verifyAndConsume.mockResolvedValue(true);
    prisma.$transaction.mockRejectedValue({ code: "P2002" });

    await expect(service.bindPhone("user-1", "13800138000", "123456")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.PHONE_CONFLICT,
      status: HttpStatus.CONFLICT,
    });
  });

  it("blocks cancellation before sending SMS when an active order exists", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      status: "active",
    });
    prisma.order.count.mockResolvedValue(1);

    await expect(service.sendCancellationCode("user-1")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS,
      status: HttpStatus.CONFLICT,
    });
    expect(verificationCodeService.send).not.toHaveBeenCalled();
  });

  it("sends a cancellation-purpose code only to the active account phone", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      status: "active",
    });
    prisma.order.count.mockResolvedValue(0);

    await expect(service.sendCancellationCode("user-1")).resolves.toBeUndefined();
    expect(verificationCodeService.send).toHaveBeenCalledWith({
      phone: "13800138000",
      purpose: "miniapp_cancel_account",
      subject: "user-1",
    });
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: {
        status: { in: ["pending_confirm", "confirmed", "in_progress", "disputed"] },
        OR: [{ ownerId: "user-1" }, { providerId: "user-1" }],
      },
    });
  });

  it.each([null, { id: "user-1", phone: "13800138000", status: "inactive" }])(
    "rejects missing or inactive accounts before sending a cancellation code %#",
    async (user) => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.sendCancellationCode("user-1")).rejects.toMatchObject({
        code: "AUTH_SESSION_EXPIRED",
        status: HttpStatus.UNAUTHORIZED,
      });
      expect(prisma.order.count).not.toHaveBeenCalled();
      expect(verificationCodeService.send).not.toHaveBeenCalled();
    },
  );

  it("rejects cancellation-code delivery for an unbound account", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: null, status: "active" });

    await expect(service.sendCancellationCode("user-1")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_NOT_REQUIRED,
      status: HttpStatus.BAD_REQUEST,
    });
    expect(prisma.order.count).not.toHaveBeenCalled();
    expect(verificationCodeService.send).not.toHaveBeenCalled();
  });

  it("preserves SMS rate-limit errors for cancellation-code delivery", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      status: "active",
    });
    prisma.order.count.mockResolvedValue(0);
    verificationCodeService.send.mockRejectedValue(
      Object.assign(new Error("rate limited"), {
        code: "RATE_LIMIT_EXCEEDED",
        status: HttpStatus.TOO_MANY_REQUESTS,
      }),
    );

    await expect(service.sendCancellationCode("user-1")).rejects.toMatchObject({
      code: "RATE_LIMIT_EXCEEDED",
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it("requires a cancellation code before touching Redis for a bound account", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      status: "active",
    });
    prisma.order.count.mockResolvedValue(0);

    await expect(service.cancelAccount("user-1")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_REQUIRED,
      status: HttpStatus.BAD_REQUEST,
    });
    expect(verificationCodeService.verifyAndConsume).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid cancellation code without starting a transaction", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      status: "active",
    });
    prisma.order.count.mockResolvedValue(0);
    verificationCodeService.verifyAndConsume.mockResolvedValue(false);

    await expect(service.cancelAccount("user-1", "123456")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.VERIFICATION_CODE_INVALID,
      status: HttpStatus.BAD_REQUEST,
    });
    expect(verificationCodeService.verifyAndConsume).toHaveBeenCalledWith({
      phone: "13800138000",
      code: "123456",
      purpose: "miniapp_cancel_account",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a malformed cancellation code before touching Redis", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      status: "active",
    });
    prisma.order.count.mockResolvedValue(0);

    await expect(service.cancelAccount("user-1", "12345x")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.VERIFICATION_CODE_INVALID,
      status: HttpStatus.BAD_REQUEST,
    });
    expect(verificationCodeService.verifyAndConsume).not.toHaveBeenCalled();
  });

  it("cancels an unbound account without touching Redis", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: null, status: "active" });
    prisma.order.count.mockResolvedValue(0);
    transaction.user.findUnique.mockResolvedValue({ status: "active" });
    transaction.order.count.mockResolvedValue(0);
    transaction.user.update.mockResolvedValue(undefined);

    await expect(service.cancelAccount("user-1")).resolves.toBeUndefined();
    expect(verificationCodeService.verifyAndConsume).not.toHaveBeenCalled();
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { status: "inactive", sessionVersion: { increment: 1 } },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("rejects a supplied code for an unbound account without touching Redis", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: null, status: "active" });
    prisma.order.count.mockResolvedValue(0);

    await expect(service.cancelAccount("user-1", "123456")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_NOT_REQUIRED,
      status: HttpStatus.BAD_REQUEST,
    });
    expect(verificationCodeService.verifyAndConsume).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("cancels a bound account only after consuming its cancellation code", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      status: "active",
    });
    prisma.order.count.mockResolvedValue(0);
    verificationCodeService.verifyAndConsume.mockResolvedValue(true);
    transaction.user.findUnique.mockResolvedValue({ status: "active" });
    transaction.order.count.mockResolvedValue(0);
    transaction.user.update.mockResolvedValue(undefined);

    await expect(service.cancelAccount("user-1", "123456")).resolves.toBeUndefined();
    expect(verificationCodeService.verifyAndConsume).toHaveBeenCalledTimes(1);
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { status: "inactive", sessionVersion: { increment: 1 } },
    });
  });

  it("blocks owner or provider orders before consuming a cancellation code", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      status: "active",
    });
    prisma.order.count.mockResolvedValue(1);

    await expect(service.cancelAccount("user-1", "123456")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS,
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [{ ownerId: "user-1" }, { providerId: "user-1" }],
      }),
    });
    expect(verificationCodeService.verifyAndConsume).not.toHaveBeenCalled();
  });

  it("blocks an order that appears inside the cancellation transaction", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: null, status: "active" });
    prisma.order.count.mockResolvedValue(0);
    transaction.user.findUnique.mockResolvedValue({ status: "active" });
    transaction.order.count.mockResolvedValue(1);

    await expect(service.cancelAccount("user-1")).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS,
      status: HttpStatus.CONFLICT,
    });
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it.each([null, { status: "inactive" }])(
    "rejects a missing or inactive account found inside the transaction %#",
    async (current) => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: null, status: "active" });
      prisma.order.count.mockResolvedValue(0);
      transaction.user.findUnique.mockResolvedValue(current);

      await expect(service.cancelAccount("user-1")).rejects.toMatchObject({
        code: "AUTH_ACCOUNT_DISABLED",
        status: HttpStatus.FORBIDDEN,
      });
      expect(transaction.order.count).not.toHaveBeenCalled();
      expect(transaction.user.update).not.toHaveBeenCalled();
    },
  );

  it("retries the whole serializable cancellation transaction after P2034", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      status: "active",
    });
    prisma.order.count.mockResolvedValue(0);
    verificationCodeService.verifyAndConsume.mockResolvedValue(true);
    transaction.user.findUnique.mockResolvedValue({ status: "active" });
    transaction.order.count.mockResolvedValue(0);
    transaction.user.update.mockResolvedValue(undefined);
    let attempt = 0;

    prisma.$transaction.mockImplementation(async (operation) => {
      attempt += 1;
      const result = await operation(transaction);

      if (attempt === 1) {
        throw { code: "P2034" };
      }

      return result;
    });

    await expect(service.cancelAccount("user-1", "123456")).resolves.toBeUndefined();
    expect(verificationCodeService.verifyAndConsume).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.user.findUnique).toHaveBeenCalledTimes(2);
    expect(transaction.order.count).toHaveBeenCalledTimes(2);
    expect(transaction.user.update).toHaveBeenCalledTimes(2);
  });

  it("rethrows P2034 after three cancellation attempts", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: null, status: "active" });
    prisma.order.count.mockResolvedValue(0);
    prisma.$transaction.mockRejectedValue({ code: "P2034" });

    await expect(service.cancelAccount("user-1")).rejects.toMatchObject({ code: "P2034" });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-serialization cancellation failure", async () => {
    const databaseError = new Error("database unavailable");

    prisma.user.findUnique.mockResolvedValue({ id: "user-1", phone: null, status: "active" });
    prisma.order.count.mockResolvedValue(0);
    prisma.$transaction.mockRejectedValue(databaseError);

    await expect(service.cancelAccount("user-1")).rejects.toBe(databaseError);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("stores a user-scoped avatar and cleans up only this user's managed old object", async () => {
    const file = {
      body: Buffer.from("png-avatar"),
      contentType: "image/png" as const,
      extension: "png" as const,
    };

    avatarStorage.upload.mockResolvedValue({
      objectKey: "public/user-avatars/user-1/new.png",
      publicUrl: "https://cdn.example.com/new.png",
    });
    transaction.user.findUnique.mockResolvedValue({
      avatarObjectKey: "public/user-avatars/user-1/old.png",
    });
    transaction.user.update.mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValue({
      ...selectedUser,
      avatar: "https://cdn.example.com/new.png",
      avatarObjectKey: "public/user-avatars/user-1/new.png",
    });

    await expect(service.replaceAvatar("user-1", file)).resolves.toMatchObject({
      avatar: "https://cdn.example.com/new.png",
    });
    expect(avatarStorage.upload).toHaveBeenCalledWith({
      scope: "user-avatars",
      userId: "user-1",
      ...file,
    });
    expect(avatarStorage.delete).toHaveBeenCalledWith("public/user-avatars/user-1/old.png");

    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((operation) => operation(transaction));
    avatarStorage.upload.mockResolvedValue({
      objectKey: "public/user-avatars/user-1/newer.png",
      publicUrl: "https://cdn.example.com/newer.png",
    });
    transaction.user.findUnique.mockResolvedValue({
      avatarObjectKey: "public/admin-avatars/user-1/admin.png",
    });
    transaction.user.update.mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValue(selectedUser);

    await service.replaceAvatar("user-1", file);
    expect(avatarStorage.delete).not.toHaveBeenCalled();
  });

  it("keeps only the winning object after two concurrent replacements and a retry", async () => {
    const file = {
      body: Buffer.from("png-avatar"),
      contentType: "image/png" as const,
      extension: "png" as const,
    };
    const firstTransaction = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          avatarObjectKey: "public/user-avatars/user-1/old.png",
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const retryTransaction = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          avatarObjectKey: "public/user-avatars/user-1/first.png",
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    let finishFirst!: () => void;
    const firstCommitted = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    let transactionAttempt = 0;

    avatarStorage.upload
      .mockResolvedValueOnce({
        objectKey: "public/user-avatars/user-1/first.png",
        publicUrl: "https://cdn.example.com/first.png",
      })
      .mockResolvedValueOnce({
        objectKey: "public/user-avatars/user-1/final.png",
        publicUrl: "https://cdn.example.com/final.png",
      });
    prisma.$transaction.mockImplementation(async (operation) => {
      transactionAttempt += 1;

      if (transactionAttempt === 1) {
        const result = await operation(firstTransaction);

        finishFirst();

        return result;
      }

      if (transactionAttempt === 2) {
        throw { code: "P2034" };
      }

      await firstCommitted;

      return operation(retryTransaction);
    });
    prisma.user.findUnique.mockResolvedValue({
      ...selectedUser,
      avatar: "https://cdn.example.com/final.png",
      avatarObjectKey: "public/user-avatars/user-1/final.png",
    });

    await expect(
      Promise.all([service.replaceAvatar("user-1", file), service.replaceAvatar("user-1", file)]),
    ).resolves.toHaveLength(2);

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" }),
    );
    expect(retryTransaction.user.findUnique).toHaveBeenCalledTimes(1);
    expect(avatarStorage.delete.mock.calls.map(([objectKey]) => objectKey)).toEqual(
      expect.arrayContaining([
        "public/user-avatars/user-1/old.png",
        "public/user-avatars/user-1/first.png",
      ]),
    );
    expect(avatarStorage.delete).not.toHaveBeenCalledWith("public/user-avatars/user-1/final.png");
  });

  it("cleans up its upload after serializable retries are exhausted", async () => {
    const file = {
      body: Buffer.from("png-avatar"),
      contentType: "image/png" as const,
      extension: "png" as const,
    };

    avatarStorage.upload.mockResolvedValue({
      objectKey: "public/user-avatars/user-1/new.png",
      publicUrl: "https://cdn.example.com/new.png",
    });
    prisma.$transaction.mockRejectedValue({ code: "P2034" });

    await expect(service.replaceAvatar("user-1", file)).rejects.toMatchObject({
      code: "ACCOUNT_CONCURRENT_UPDATE",
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(avatarStorage.delete).toHaveBeenCalledWith("public/user-avatars/user-1/new.png");
  });
});
