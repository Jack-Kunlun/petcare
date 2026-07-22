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
});
