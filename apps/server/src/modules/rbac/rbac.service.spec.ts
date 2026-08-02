import { PrismaService } from "../../prisma/prisma.service";
import { PermissionCatalogService } from "./permission-catalog.service";
import { RbacService } from "./rbac.service";

describe("RbacService", () => {
  it("excludes orphan database permissions from effective authorization codes", async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          roles: [
            {
              role: {
                permissions: [
                  { permission: { permissionCode: "system.publish" } },
                  { permission: { permissionCode: "retired.permission" } },
                  { permission: { permissionCode: "system.publish" } },
                ],
              },
            },
          ],
        }),
      },
    };
    const service = new RbacService(
      prisma as unknown as PrismaService,
      new PermissionCatalogService(),
    );

    await expect(service.getEffectiveAuthorizationCodes("user-1")).resolves.toEqual([
      "system.publish",
    ]);
  });
});
