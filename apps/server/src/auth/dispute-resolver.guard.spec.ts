import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DisputeResolverGuard } from "./dispute-resolver.guard";

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe("DisputeResolverGuard", () => {
  const prisma = {
    user: { findFirst: jest.fn() },
  };
  const guard = new DisputeResolverGuard(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("accepts an active administrator with the dispute.resolve permission", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "admin-1",
      roles: [{ role: { roleName: "complaint_resolver" } }],
    });

    await expect(
      guard.canActivate(contextFor({ sub: "admin-1", roles: ["complaint_admin"] })),
    ).resolves.toBe(true);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: "admin-1",
        status: "active",
        roles: {
          some: {
            role: {
              isActive: true,
              OR: [
                { roleName: "super_admin" },
                {
                  permissions: {
                    some: {
                      permission: { permissionCode: "dispute.resolve" },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      select: {
        id: true,
        roles: {
          where: { role: { isActive: true } },
          select: { role: { select: { roleName: true } } },
        },
      },
    });
  });

  it("accepts an active super administrator through the same database check", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "super-1",
      roles: [{ role: { roleName: "super_admin" } }],
    });

    await expect(
      guard.canActivate(contextFor({ sub: "super-1", roles: ["super_admin"] })),
    ).resolves.toBe(true);
  });

  it("replaces stale token roles with the current active database roles", async () => {
    const principal = { sub: "admin-1", roles: ["super_admin"] };

    prisma.user.findFirst.mockResolvedValue({
      id: "admin-1",
      roles: [{ role: { roleName: "complaint_resolver" } }],
    });

    await guard.canActivate(contextFor(principal));

    expect(principal.roles).toEqual(["complaint_resolver"]);
  });

  it("rejects an active user without dispute resolution permission", async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextFor({ sub: "user-1", roles: [] })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a missing access-token principal", async () => {
    await expect(guard.canActivate(contextFor(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
