import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { PrismaService } from "../../prisma/prisma.service";
import { UserService } from "./user.service";

describe("UserService public responses", () => {
  const prisma = {
    user: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
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
});
