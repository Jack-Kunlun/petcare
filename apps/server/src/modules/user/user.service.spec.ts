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

  it("queries only public user fields", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });

    await service.findOne("user-1");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.not.objectContaining({ passwordHash: true }),
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
        phone: "17679141878",
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
      list: [{ id: "user-1", phone: "17679141878" }],
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
