import { RedisService } from "../config/redis.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReadinessController } from "./readiness.controller";

describe("ReadinessController", () => {
  const prisma = { $queryRaw: jest.fn() };
  const redisClient = { ping: jest.fn() };
  const redis = { getClient: () => redisClient };
  const controller = new ReadinessController(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ ready: 1 }]);
    redisClient.ping.mockResolvedValue("PONG");
  });

  it("reports ready only after PostgreSQL and Redis respond", async () => {
    await expect(controller.check()).resolves.toEqual({ status: "ok" });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(redisClient.ping).toHaveBeenCalledTimes(1);
  });

  it("rejects when PostgreSQL is unavailable", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(controller.check()).rejects.toThrow("database unavailable");
  });

  it("rejects when Redis is unavailable", async () => {
    redisClient.ping.mockRejectedValueOnce(new Error("redis unavailable"));

    await expect(controller.check()).rejects.toThrow("redis unavailable");
  });
});
