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
});
