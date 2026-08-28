import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { PrismaService } from "../../prisma/prisma.service";
import { UserService } from "./user.service";

describe("UserService public responses", () => {
  const prisma = {
    user: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new UserService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it("returns only explicitly public user fields without exposing a stored address", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "user-1",
      nickname: "小白家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      profile: { address: "上海市", bio: "喜欢猫咪" },
      phone: "13800138000",
      passwordHash: "must-not-leak",
    });

    const response = await service.findOne("user-1");

    expect(response).toEqual({
      id: "user-1",
      nickname: "小白家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      profile: { region: null, bio: "喜欢猫咪" },
    });
    expect(Object.keys(response).sort()).toEqual([
      "avatar",
      "id",
      "nickname",
      "profile",
      "status",
      "userType",
    ]);
    expect(response).not.toHaveProperty("phone");
    expect(response).not.toHaveProperty("username");
    expect(response).not.toHaveProperty("role");
    expect(response).not.toHaveProperty("roles");
    expect(response).not.toHaveProperty("createdAt");
    expect(response).not.toHaveProperty("updatedAt");
    expect(response.profile).not.toHaveProperty("address");

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: "user-1", status: "active" },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        userType: true,
        profile: { select: { bio: true } },
      },
    });
  });

  it("returns an active public user without inventing a missing profile", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "user-2",
      nickname: "未完善资料",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      profile: null,
    });

    await expect(service.findOne("user-2")).resolves.toEqual({
      id: "user-2",
      nickname: "未完善资料",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      profile: null,
    });
  });

  it.each(["inactive", "banned", "missing"])(
    "returns the same stable 404 for a %s public account",
    async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      try {
        await service.findOne("hidden-user");
        throw new Error("Expected findOne to reject");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiException);
        expect(error).toMatchObject({
          code: "RESOURCE_NOT_FOUND",
          clientMessage: "用户不存在",
        });
        expect((error as ApiException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    },
  );

  it("returns a filtered admin user page without sensitive fields", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        phone: "13800138000",
        username: "admin",
        nickname: "系统管理员",
        avatar: null,
        userType: "pet_owner",
        status: "inactive",
        createdAt: new Date("2026-07-29T00:00:00.000Z"),
      },
    ]);
    prisma.user.count.mockResolvedValue(1);

    await expect(
      service.findAdminPage({
        page: 2,
        pageSize: 10,
        keyword: "1767",
        userType: "pet_owner",
        status: "inactive",
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
          { status: "inactive" },
        ],
      },
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 10,
      select: expect.not.objectContaining({ passwordHash: true }),
    });
  });

  it("returns one admin user with non-sensitive profile and activity counts", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "13800138000",
      username: "xiaochong",
      nickname: "小宠家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      profile: { bio: "喜欢猫咪" },
      _count: { pets: 2, posts: 3, comments: 4, favorites: 5 },
    });

    await expect(service.findAdminOne("user-1")).resolves.toEqual({
      id: "user-1",
      phone: "13800138000",
      username: "xiaochong",
      nickname: "小宠家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      profile: { bio: "喜欢猫咪" },
      activity: { petCount: 2, postCount: 3, commentCount: 4, favoriteCount: 5 },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
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
        profile: { select: { bio: true } },
        _count: {
          select: { pets: true, posts: true, comments: true, favorites: true },
        },
      },
    });
  });

  it("returns a stable 404 when the admin user detail does not exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findAdminOne("missing-user")).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      clientMessage: "用户不存在",
    });
  });

  it("atomically bans an active user and rotates all existing sessions", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ status: "active" }).mockResolvedValueOnce({
      id: "user-1",
      phone: null,
      username: null,
      nickname: "小宠家长",
      avatar: null,
      userType: "pet_owner",
      status: "banned",
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      profile: null,
      _count: { pets: 0, posts: 0, comments: 0, favorites: 0 },
    });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.banAdminUser("user-1", "admin-1")).resolves.toMatchObject({
      id: "user-1",
      status: "banned",
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", status: "active" },
      data: { status: "banned", sessionVersion: { increment: 1 } },
    });
  });

  it("restores only a banned user and rotates the session version again", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ status: "banned" }).mockResolvedValueOnce({
      id: "user-1",
      phone: null,
      username: null,
      nickname: "小宠家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      profile: null,
      _count: { pets: 0, posts: 0, comments: 0, favorites: 0 },
    });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.restoreAdminUser("user-1")).resolves.toMatchObject({
      id: "user-1",
      status: "active",
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", status: "banned" },
      data: { status: "active", sessionVersion: { increment: 1 } },
    });
  });

  it("keeps an already banned request idempotent without rotating sessions twice", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ status: "banned" }).mockResolvedValueOnce({
      id: "user-1",
      phone: null,
      username: null,
      nickname: "小宠家长",
      avatar: null,
      userType: "pet_owner",
      status: "banned",
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      profile: null,
      _count: { pets: 0, posts: 0, comments: 0, favorites: 0 },
    });

    await expect(service.banAdminUser("user-1", "admin-1")).resolves.toMatchObject({
      status: "banned",
    });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects self-ban and leaves the account untouched", async () => {
    await expect(service.banAdminUser("admin-1", "admin-1")).rejects.toMatchObject({
      code: "USER_SELF_BAN_FORBIDDEN",
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["ban", "inactive"],
    ["restore", "inactive"],
  ])("rejects a %s transition from %s", async (action, status) => {
    prisma.user.findUnique.mockResolvedValue({ status });

    const operation =
      action === "ban"
        ? service.banAdminUser("user-1", "admin-1")
        : service.restoreAdminUser("user-1");

    await expect(operation).rejects.toMatchObject({
      code: "USER_STATUS_CONFLICT",
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
