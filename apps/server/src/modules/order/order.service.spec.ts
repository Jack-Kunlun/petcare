import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { OrderConfigSnapshotService } from "./order-config-snapshot.service";
import { OrderService } from "./order.service";

describe("OrderService public responses", () => {
  const prisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    orderSop: {
      createMany: jest.fn(),
    },
    orderFeeSnapshot: {
      create: jest.fn(),
    },
  };
  const snapshots = {
    createForOrder: jest.fn(),
  };
  const service = new OrderService(
    prisma as unknown as PrismaService,
    {} as ConfigService,
    snapshots as unknown as OrderConfigSnapshotService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.$queryRaw.mockResolvedValue([{ status: "active" }]);
    prisma.order.create.mockResolvedValue({ id: "order-1" });
    prisma.orderSop.createMany.mockResolvedValue({ count: 1 });
    prisma.orderFeeSnapshot.create.mockResolvedValue({ id: "fee-snapshot-1" });
    snapshots.createForOrder.mockResolvedValue({
      sopConfigVersionId: "sop-v2",
      feeConfigVersionId: "fee-v2",
      sops: [
        {
          stepNumber: 1,
          stepName: "进门消毒",
          instruction: "进门后完成消毒",
          expectedDurationMinutes: 5,
          minimumPhotoCount: 1,
          videoRequired: false,
          violationGuidance: "[]",
          photos: [],
          videos: [],
        },
      ],
      fee: {
        feeConfigVersionId: "fee-v2",
        inputAmountCents: 12500,
        platformCommissionBps: 1000,
        commissionAmountCents: 1250,
        rewardServiceFeeCents: 200,
        withdrawalFeeBps: 100,
        minimumWithdrawalFeeCents: 100,
        providerSettlementCents: 11050,
      },
    });
  });

  it("locks the active owner before creating snapshots or order rows", async () => {
    prisma.$queryRaw.mockResolvedValue([{ status: "active" }]);

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

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      snapshots.createForOrder.mock.invocationCallOrder[0],
    );
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.order.create.mock.invocationCallOrder[0],
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("retries the complete reward-order transaction twice after P2034", async () => {
    let attempt = 0;

    prisma.$transaction.mockImplementation(async (callback) => {
      attempt += 1;
      const result = await callback(prisma);

      if (attempt < 3) {
        throw { code: "P2034" };
      }

      return result;
    });

    await expect(
      service.createRewardOrder(
        {
          serviceType: "feeding",
          petId: "pet-1",
          serviceTime: "2026-08-01T10:00:00.000Z",
          address: "测试地址",
          rewardAmount: 12500,
          remark: "",
        },
        "owner-1",
      ),
    ).resolves.toEqual({ order: { id: "order-1" } });

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect(snapshots.createForOrder).toHaveBeenCalledTimes(3);
    expect(prisma.order.create).toHaveBeenCalledTimes(3);
    expect(prisma.orderSop.createMany).toHaveBeenCalledTimes(3);
    expect(prisma.orderFeeSnapshot.create).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-P2034 transaction failure", async () => {
    prisma.$transaction.mockRejectedValue(new Error("database unavailable"));

    await expect(
      service.createRewardOrder(
        {
          serviceType: "feeding",
          petId: "pet-1",
          serviceTime: "2026-08-01T10:00:00.000Z",
          address: "测试地址",
          rewardAmount: 12500,
          remark: "",
        },
        "owner-1",
      ),
    ).rejects.toMatchObject({
      code: "ORDER_CREATION_FAILED",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("maps three exhausted P2034 attempts to the existing stable error", async () => {
    prisma.$transaction.mockImplementation(async (callback) => {
      await callback(prisma);
      throw { code: "P2034" };
    });

    await expect(
      service.createRewardOrder(
        {
          serviceType: "feeding",
          petId: "pet-1",
          serviceTime: "2026-08-01T10:00:00.000Z",
          address: "测试地址",
          rewardAmount: 12500,
          remark: "",
        },
        "owner-1",
      ),
    ).rejects.toMatchObject({
      code: "ORDER_CREATION_FAILED",
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it.each([{ rows: [{ status: "inactive" }] }, { rows: [] }])(
    "rejects a missing or inactive owner before any order write %#",
    async ({ rows }) => {
      prisma.$queryRaw.mockResolvedValue(rows);

      await expect(
        service.createRewardOrder(
          {
            serviceType: "feeding",
            petId: "pet-1",
            serviceTime: "2026-08-01T10:00:00.000Z",
            address: "测试地址",
            rewardAmount: 12500,
            remark: "",
          },
          "owner-1",
        ),
      ).rejects.toMatchObject({
        code: "AUTH_ACCOUNT_DISABLED",
        status: HttpStatus.FORBIDDEN,
      });
      expect(snapshots.createForOrder).not.toHaveBeenCalled();
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.orderSop.createMany).not.toHaveBeenCalled();
      expect(prisma.orderFeeSnapshot.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    },
  );

  it("stores reward order money as integer minor units", async () => {
    await expect(
      service.createRewardOrder(
        {
          serviceType: "feeding",
          petId: "pet-1",
          serviceTime: "2026-08-01T10:00:00.000Z",
          address: "测试地址",
          rewardAmount: 12500,
          remark: "",
        },
        "owner-1",
      ),
    ).resolves.toEqual({ order: { id: "order-1" } });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(snapshots.createForOrder).toHaveBeenCalledWith("feeding", 12500, prisma);
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 12500,
          sopConfigVersionId: "sop-v2",
          feeConfigVersionId: "fee-v2",
        }),
      }),
    );
    expect(prisma.orderSop.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: "order-1",
          stepNumber: 1,
          instruction: "进门后完成消毒",
        }),
      ],
    });
    expect(prisma.orderFeeSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        feeConfigVersionId: "fee-v2",
        inputAmountCents: 12500,
        platformCommissionCents: 1250,
      }),
    });
  });

  it("订单或快照写入失败时返回稳定错误且不泄漏底层异常", async () => {
    prisma.orderSop.createMany.mockRejectedValue(
      new Error("P2003: foreign key constraint failed on order_sops"),
    );

    try {
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
      throw new Error("Expected createRewardOrder to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({
        code: "ORDER_CREATION_FAILED",
        clientMessage: "订单创建失败",
      });
      expect((error as Error).message).not.toContain("P2003");
    }

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.orderFeeSnapshot.create).not.toHaveBeenCalled();
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
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      owner: {
        id: "owner-1",
        nickname: "豆包家长",
        avatar: null,
        userType: "pet_owner",
        status: "active",
      },
    });

    const result = await service.findOne("order-1");

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: "order-1" },
      include: {
        owner: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            userType: true,
            status: true,
          },
        },
        pet: true,
      },
    });
    expect(result.owner).toEqual({
      id: "owner-1",
      nickname: "豆包家长",
      avatar: null,
      userType: "pet_owner",
      status: "active",
    });
    expect(result.owner).not.toHaveProperty("phone");
    expect(result.owner).not.toHaveProperty("username");
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
        owner: {
          select: expect.objectContaining({ phone: true, username: true }),
        },
        provider: {
          select: expect.objectContaining({ phone: true, username: true }),
        },
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
