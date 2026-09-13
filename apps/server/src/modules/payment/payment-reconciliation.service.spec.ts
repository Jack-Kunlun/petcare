import { PaymentReconciliationService } from "./payment-reconciliation.service";

const create = (enabled = false) => {
  const prisma = { orderPayment: { findMany: jest.fn().mockResolvedValue([]) } };
  const config = { paymentReconciliationEnabled: enabled, wechatPay: {} };

  return {
    prisma,
    config,
    service: new PaymentReconciliationService(
      prisma as never,
      config as never,
      {} as never,
      {} as never,
    ),
  };
};

describe("Payment reconciliation lifecycle", () => {
  afterEach(() => jest.useRealTimers());

  it("does not start a timer or access the database while disabled", async () => {
    jest.useFakeTimers();
    const { service, prisma } = create();

    service.onModuleInit();
    expect(await service.runOnce()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(prisma.orderPayment.findMany).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it("runs an immediate bounded scan and cancels its minute timer on shutdown", async () => {
    jest.useFakeTimers();
    const { service, prisma } = create(true);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(prisma.orderPayment.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.orderPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
    await service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(prisma.orderPayment.findMany).toHaveBeenCalledTimes(2);
  });

  it("does not overlap local scans and drains an in-flight scan before shutdown", async () => {
    const { service, prisma } = create(true);
    let release!: (rows: []) => void;

    prisma.orderPayment.findMany.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const first = service.runOnce();

    expect(await service.runOnce()).toBe(0);
    const stopped = service.onModuleDestroy();

    release([]);
    expect(await first).toBe(0);
    await stopped;
    expect(await service.runOnce()).toBe(0);
    expect(prisma.orderPayment.findMany).toHaveBeenCalledTimes(1);
  });
});
