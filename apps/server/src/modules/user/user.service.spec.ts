import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { UserService } from "./user.service";

describe("UserService public responses", () => {
  const prisma = {
    user: {
      create: jest.fn(),
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
});
