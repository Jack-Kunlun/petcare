import { PrismaService } from "../prisma/prisma.service";
import { SessionValidationService } from "./session-validation.service";

describe("SessionValidationService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  let service: SessionValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SessionValidationService(prisma as unknown as PrismaService);
  });

  it("accepts an active user with the current version", async () => {
    prisma.user.findUnique.mockResolvedValue({ status: "active", sessionVersion: 3 });

    await expect(service.assertActiveVersion("user-1", 3)).resolves.toBeUndefined();
  });

  it.each([
    [null, 3],
    [{ status: "inactive", sessionVersion: 3 }, 3],
    [{ status: "active", sessionVersion: 4 }, 3],
  ])("rejects missing, disabled, or stale sessions", async (user, version) => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(service.assertActiveVersion("user-1", version)).rejects.toMatchObject({
      code: "AUTH_SESSION_EXPIRED",
    });
  });
});
