import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { UserService } from "./user.service";

describe("UserService public responses", () => {
  const prisma = {
    user: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const service = new UserService(prisma as unknown as PrismaService, {} as ConfigService);

  beforeEach(() => jest.clearAllMocks());

  it("preserves the legacy registration user shape without public profile fields", async () => {
    const registeredUser = {
      id: "user-1",
      phone: "13800138000",
      username: null,
      nickname: "小白家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
    };

    prisma.user.create.mockResolvedValue(registeredUser);

    await expect(
      service.register({ phone: "13800138000", code: "123456", nickname: "小白家长" }),
    ).resolves.toEqual({
      user: registeredUser,
      token: "mock-token",
      refreshToken: "mock-refresh-token",
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { phone: "13800138000", nickname: "小白家长", avatar: undefined },
      select: {
        id: true,
        phone: true,
        username: true,
        nickname: true,
        avatar: true,
        userType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(registeredUser).not.toHaveProperty("profile");
  });

  it("returns only explicitly public user and profile fields", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      nickname: "小白家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      profile: { address: "上海市", bio: "喜欢猫咪" },
      phone: "13800138000",
      passwordHash: "must-not-leak",
    });

    await expect(service.findOne("user-1")).resolves.toEqual({
      id: "user-1",
      nickname: "小白家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      profile: { address: "上海市", bio: "喜欢猫咪" },
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        userType: true,
        status: true,
        profile: { select: { address: true, bio: true } },
      },
    });
  });

  it("throws a stable 404 when the user does not exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    try {
      await service.findOne("missing");
      throw new Error("Expected findOne to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({
        code: "RESOURCE_NOT_FOUND",
        clientMessage: "用户不存在",
      });
      expect((error as ApiException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it("returns a filtered admin user page without sensitive fields", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        phone: "13800138000",
        username: "admin",
        nickname: "系统管理员",
        avatar: null,
        userType: "pet_owner",
        status: "active",
        createdAt: new Date("2026-07-29T00:00:00.000Z"),
        provider: null,
      },
    ]);
    prisma.user.count.mockResolvedValue(1);

    await expect(
      service.findAdminPage({
        page: 2,
        pageSize: 10,
        keyword: "1767",
        userType: "pet_owner",
        status: "active",
      }),
    ).resolves.toMatchObject({
      total: 1,
      page: 2,
      pageSize: 10,
      list: [{ id: "user-1", phone: "13800138000" }],
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { phone: { contains: "1767" } },
              { username: { contains: "1767", mode: "insensitive" } },
              { nickname: { contains: "1767", mode: "insensitive" } },
            ],
          },
          { userType: "pet_owner" },
          { status: "active" },
        ],
      },
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 10,
      select: expect.not.objectContaining({ passwordHash: true }),
    });
  });
});
