import { ExecutionContext, HttpStatus } from "@nestjs/common";
import { MINIAPP_ACCOUNT_ERROR_CODE } from "@petcare/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { ProfileCompleteGuard } from "./profile-complete.guard";

function contextWithUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe("ProfileCompleteGuard", () => {
  const prisma = {
    user: { findUnique: jest.fn() },
  };
  const guard = new ProfileCompleteGuard(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("rejects an authenticated account without a verified phone", async () => {
    prisma.user.findUnique.mockResolvedValue({ phone: null, status: "active" });

    await expect(guard.canActivate(contextWithUser({ sub: "user-1" }))).rejects.toMatchObject({
      code: MINIAPP_ACCOUNT_ERROR_CODE.PROFILE_INCOMPLETE,
      status: HttpStatus.FORBIDDEN,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { phone: true, status: true },
    });
  });

  it.each([
    ["a missing account", { sub: "user-1" }, null],
    ["an inactive account", { sub: "user-1" }, { phone: "13800138000", status: "inactive" }],
  ])("rejects %s as an expired session", async (_label, principal, account) => {
    prisma.user.findUnique.mockResolvedValue(account);

    await expect(guard.canActivate(contextWithUser(principal))).rejects.toMatchObject({
      code: "AUTH_SESSION_EXPIRED",
      status: HttpStatus.UNAUTHORIZED,
    });
  });

  it("rejects a missing principal without querying Prisma", async () => {
    await expect(guard.canActivate(contextWithUser(undefined))).rejects.toMatchObject({
      code: "AUTH_SESSION_EXPIRED",
      status: HttpStatus.UNAUTHORIZED,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("allows an active account with a verified phone", async () => {
    prisma.user.findUnique.mockResolvedValue({ phone: "13800138000", status: "active" });

    await expect(guard.canActivate(contextWithUser({ sub: "user-1" }))).resolves.toBe(true);
  });
});
