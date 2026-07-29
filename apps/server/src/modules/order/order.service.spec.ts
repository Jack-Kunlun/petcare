import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

describe("OrderService public responses", () => {
  const prisma = {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const service = new OrderService(prisma as unknown as PrismaService, {} as ConfigService);

  beforeEach(() => jest.clearAllMocks());

  it("stores reward order money as integer minor units", async () => {
    prisma.order.create.mockResolvedValue({ id: "order-1" });

    await service.createRewardOrder(
      {
        serviceType: "feeding",
        petId: "pet-1",
        serviceTime: "2026-08-01T10:00:00.000Z",
        address: "测试地址",
        rewardAmount: 12500,
        remark: "",
      },
      "owner-1",
    );

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 12500 }),
      }),
    );
  });

  it("returns the unified list-based pagination shape", async () => {
    const orders = [{ id: "order-1" }];

    prisma.order.findMany.mockResolvedValue(orders);
    prisma.order.count.mockResolvedValue(1);

    await expect(service.findAll(2, 10)).resolves.toEqual({
      list: orders,
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });

  it("queries order details with a safe owner projection", async () => {
    prisma.order.findUnique.mockResolvedValue({ id: "order-1" });

    await service.findOne("order-1");

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: "order-1" },
      include: {
        owner: { select: expect.not.objectContaining({ passwordHash: true }) },
        pet: true,
      },
    });
  });

  it("throws a stable 404 when the order does not exist", async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    try {
      await service.findOne("missing");
      throw new Error("Expected findOne to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({
        code: "RESOURCE_NOT_FOUND",
        clientMessage: "订单不存在",
      });
      expect((error as ApiException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it("returns a filtered admin order page with safe related-user projections", async () => {
    prisma.order.findMany.mockResolvedValue([{ id: "order-1" }]);
    prisma.order.count.mockResolvedValue(1);

    await expect(
      service.findAdminPage({
        page: 2,
        pageSize: 10,
        keyword: "1767",
        orderType: "reward",
        serviceType: "feeding",
        status: "pending_confirm",
      }),
    ).resolves.toEqual({
      list: [{ id: "order-1" }],
      total: 1,
      page: 2,
      pageSize: 10,
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { id: { contains: "1767", mode: "insensitive" } },
              { owner: { phone: { contains: "1767" } } },
              { owner: { nickname: { contains: "1767", mode: "insensitive" } } },
              { pet: { name: { contains: "1767", mode: "insensitive" } } },
            ],
          },
          { orderType: "reward" },
          { serviceType: "feeding" },
          { status: "pending_confirm" },
        ],
      },
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 10,
      include: {
        owner: { select: expect.not.objectContaining({ passwordHash: true }) },
        provider: { select: expect.not.objectContaining({ passwordHash: true }) },
        pet: {
          select: {
            id: true,
            name: true,
            breed: true,
          },
        },
      },
    });
  });
});
