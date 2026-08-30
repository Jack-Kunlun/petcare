import { HttpStatus } from "@nestjs/common";
import { BOUNTY_ERROR_CODE, BOUNTY_SERVICE_TYPE, BOUNTY_STATUS } from "@petcare/shared-types";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { BountyFeatureGuard } from "./bounty.controller";
import { BountyService } from "./bounty.service";

describe("BountyService", () => {
  const prisma = {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const transaction = {
    $queryRaw: jest.fn(),
    pet: { findFirst: jest.fn() },
    order: { create: jest.fn() },
  };
  const config = { orderTimeoutDelayMs: 48 * 60 * 60 * 1000 } as ConfigService;
  const service = new BountyService(prisma as unknown as PrismaService, config);
  const now = new Date("2026-08-30T00:00:00.000Z");
  const serviceTime = "2026-09-03T00:00:00.000Z";
  const expiresAt = new Date("2026-09-01T00:00:00.000Z");
  const petId = "11111111-1111-4111-8111-111111111111";
  const bountyId = "22222222-2222-4222-8222-222222222222";
  const input = {
    petId,
    serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
    serviceTime,
    amountCents: 5_000,
    address: "  上海市示例地址  ",
    remark: "  请换水  ",
  };
  const privateRow = {
    id: bountyId,
    serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
    serviceTime: new Date(serviceTime),
    amount: 5_000,
    status: BOUNTY_STATUS.OPEN,
    address: "上海市示例地址",
    remark: "请换水",
    createdAt: now,
    reward: { expireTime: expiresAt },
    pet: { id: petId, name: "米米", breed: "英短", photos: [] },
  };
  const publicRow = {
    id: bountyId,
    serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
    serviceTime: new Date(serviceTime),
    amount: 5_000,
    status: BOUNTY_STATUS.OPEN,
    reward: { expireTime: expiresAt },
    owner: { nickname: "小萌", avatar: null },
    pet: { name: "米米", breed: "英短", photos: [] },
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((operation) => operation(transaction));
    transaction.$queryRaw.mockResolvedValue([{ status: "active", phone: "13800000000" }]);
    transaction.pet.findFirst.mockResolvedValue({ id: petId });
    transaction.order.create.mockResolvedValue(privateRow);
    prisma.order.count.mockResolvedValue(1);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates the owned-pet order and exact-price reward atomically in integer cents", async () => {
    await expect(service.create("owner-1", input)).resolves.toEqual({
      id: bountyId,
      serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
      serviceTime,
      amountCents: 5_000,
      status: BOUNTY_STATUS.OPEN,
      address: "上海市示例地址",
      remark: "请换水",
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      pet: { id: petId, name: "米米", breed: "英短", coverImage: null },
    });
    expect(transaction.pet.findFirst).toHaveBeenCalledWith({
      where: { id: petId, ownerId: "owner-1" },
      select: { id: true },
    });
    expect(transaction.order.create).toHaveBeenCalledWith({
      data: {
        orderType: "reward",
        serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
        ownerId: "owner-1",
        petId,
        serviceTime: new Date(serviceTime),
        amount: 5_000,
        address: "上海市示例地址",
        remark: "请换水",
        status: BOUNTY_STATUS.OPEN,
        reward: {
          create: {
            rewardAmount: 5_000,
            priceRangeMin: 5_000,
            priceRangeMax: 5_000,
            expireTime: expiresAt,
          },
        },
      },
      select: expect.any(Object),
    });
  });

  it("hides a missing or cross-owner pet without issuing an order write", async () => {
    transaction.pet.findFirst.mockResolvedValue(null);

    await expect(service.create("owner-2", input)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
    expect(transaction.order.create).not.toHaveBeenCalled();
  });

  it("rejects invalid time, money, and control characters before opening a transaction", async () => {
    await expect(
      service.create("owner-1", { ...input, serviceTime: now.toISOString() }),
    ).rejects.toMatchObject({ code: BOUNTY_ERROR_CODE.VALIDATION_FAILED });
    await expect(service.create("owner-1", { ...input, amountCents: 50.5 })).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.VALIDATION_FAILED,
    });
    await expect(
      service.create("owner-1", { ...input, address: "上海市\n隐藏地址" }),
    ).rejects.toMatchObject({ code: BOUNTY_ERROR_CODE.VALIDATION_FAILED });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns owner-only address data from an owner-scoped query", async () => {
    prisma.order.findMany.mockResolvedValue([privateRow]);

    await expect(service.findMine("owner-1", { page: 1, pageSize: 20 })).resolves.toMatchObject({
      list: [{ id: bountyId, address: "上海市示例地址", remark: "请换水" }],
      total: 1,
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderType: "reward", ownerId: "owner-1", reward: { isNot: null } },
      }),
    );
  });

  it("queries only active open bounties and returns no private fields publicly", async () => {
    prisma.order.findMany.mockResolvedValue([publicRow]);

    const result = await service.findPublic({ page: 1, pageSize: 20 });
    const options = prisma.order.findMany.mock.calls[0][0];

    expect(result.list[0]).toEqual({
      id: bountyId,
      serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
      serviceTime,
      amountCents: 5_000,
      status: BOUNTY_STATUS.OPEN,
      expiresAt: expiresAt.toISOString(),
      owner: { nickname: "小萌", avatar: null },
      pet: { name: "米米", breed: "英短", coverImage: null },
    });
    expect(options.where).toMatchObject({
      orderType: "reward",
      status: BOUNTY_STATUS.OPEN,
      owner: { is: { status: "active" } },
      reward: { is: { expireTime: { gt: now } } },
    });
    expect(options.select).not.toHaveProperty("address");
    expect(options.select).not.toHaveProperty("remark");
    expect(options.select).not.toHaveProperty("ownerId");
    expect(options.select).not.toHaveProperty("petId");
  });

  it("keeps every bounty route closed unless the environment explicitly enables it", () => {
    const disabled = new BountyFeatureGuard({ commercialServicesEnabled: false } as ConfigService);
    const enabled = new BountyFeatureGuard({ commercialServicesEnabled: true } as ConfigService);

    expect(() => disabled.canActivate({} as never)).toThrow(
      expect.objectContaining({
        code: BOUNTY_ERROR_CODE.FEATURE_DISABLED,
        status: HttpStatus.NOT_FOUND,
      }),
    );
    expect(enabled.canActivate({} as never)).toBe(true);
  });
});
