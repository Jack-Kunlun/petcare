import { PrismaClient } from "../generated/prisma/client";
import { seedSopConfiguration } from "./seed-sop-config";

describe("seedSopConfiguration", () => {
  it("creates one complete baseline without replacing an existing pointer", async () => {
    const transaction = {
      systemConfigPointer: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ configKey: "sop" }),
        create: jest.fn().mockResolvedValue({}),
      },
      systemConfigVersion: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({ id: "sop-version-1" }),
      },
    };
    const prisma = {
      $transaction: jest.fn((operation) => operation(transaction)),
    } as unknown as PrismaClient;

    await seedSopConfiguration(prisma, "admin-1");

    expect(transaction.systemConfigVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configKey: "sop",
          status: "published",
          sopSteps: {
            create: expect.arrayContaining([expect.objectContaining({ stepNumber: 5 })]),
          },
        }),
      }),
    );
    expect(
      transaction.systemConfigVersion.create.mock.calls[0][0].data.sopSteps.create,
    ).toHaveLength(15);

    await seedSopConfiguration(prisma, "admin-1");
    expect(transaction.systemConfigVersion.create).toHaveBeenCalledTimes(1);
  });
});
