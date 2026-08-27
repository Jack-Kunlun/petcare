import { HttpStatus } from "@nestjs/common";
import { PermissionCatalogService } from "./permission-catalog.service";
import { RoleService } from "./role.service";

const actor = { operatorId: "admin-1", ip: "127.0.0.1" };
const timestamp = new Date("2026-08-02T00:00:00.000Z");

function role(overrides: Record<string, unknown> = {}) {
  return {
    id: "role-1",
    roleName: "operator",
    description: "Operations role",
    isSystem: false,
    isActive: true,
    updatedAt: timestamp,
    _count: { permissions: 2, users: 1 },
    permissions: [
      { permission: { permissionCode: "rbac.view" } },
      { permission: { permissionCode: "rbac.role.read" } },
    ],
    users: [{ userId: "user-1" }],
    ...overrides,
  };
}

function createPrisma() {
  const tx = {
    role: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    permission: { findMany: jest.fn() },
    rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
    user: { findMany: jest.fn() },
    userRole: { count: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    permissionAuditLog: { create: jest.fn() },
  };

  return {
    ...tx,
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
}

describe("RoleService", () => {
  it("returns the required list/total/page/pageSize pagination shape", async () => {
    const prisma = createPrisma();

    prisma.role.findMany.mockResolvedValue([role()]);
    prisma.role.count.mockResolvedValue(1);
    const service = new RoleService(prisma as never, new PermissionCatalogService());

    await expect(service.list({ page: 2, pageSize: 5, roleName: "oper" })).resolves.toEqual({
      list: [
        expect.objectContaining({
          id: "role-1",
          permissionCount: 2,
          userCount: 1,
          updatedAt: timestamp.toISOString(),
        }),
      ],
      total: 1,
      page: 2,
      pageSize: 5,
    });
    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it("rejects a duplicate role name with a conflict before creating the role", async () => {
    const prisma = createPrisma();

    prisma.role.findUnique.mockResolvedValue(role());
    const service = new RoleService(prisma as never, new PermissionCatalogService());

    await expect(
      service.create({ roleName: "operator", description: "Duplicate" }, actor),
    ).rejects.toMatchObject({
      code: "RBAC_ROLE_NAME_CONFLICT",
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it("does not allow system roles to be updated, deleted, or have permissions replaced", async () => {
    const prisma = createPrisma();

    prisma.role.findUnique.mockResolvedValue(role({ isSystem: true }));
    const service = new RoleService(prisma as never, new PermissionCatalogService());

    await expect(service.update("role-1", { isActive: false }, actor)).rejects.toMatchObject({
      code: "RBAC_SYSTEM_ROLE_PROTECTED",
    });
    await expect(service.delete("role-1", actor)).rejects.toMatchObject({
      code: "RBAC_SYSTEM_ROLE_PROTECTED",
    });
    await expect(
      service.replacePermissions("role-1", { permissionCodes: [] }, actor),
    ).rejects.toMatchObject({
      code: "RBAC_SYSTEM_ROLE_PROTECTED",
    });
  });

  it("refuses to delete a role that remains assigned to users", async () => {
    const prisma = createPrisma();

    prisma.role.findUnique.mockResolvedValue(role());
    prisma.userRole.count.mockResolvedValue(1);
    const service = new RoleService(prisma as never, new PermissionCatalogService());

    await expect(service.delete("role-1", actor)).rejects.toMatchObject({
      code: "RBAC_ROLE_HAS_ASSIGNED_USERS",
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it("atomically replaces UI permissions with their effective API closure and writes an audit log", async () => {
    const prisma = createPrisma();

    prisma.role.findUnique
      .mockResolvedValueOnce(role())
      .mockResolvedValueOnce(
        role({ permissions: [{ permission: { permissionCode: "rbac.role.create" } }] }),
      );
    prisma.permission.findMany.mockResolvedValue([
      { id: "permission-1", permissionCode: "rbac.role.create" },
      { id: "permission-2", permissionCode: "rbac.role.create_action" },
    ]);
    const service = new RoleService(prisma as never, new PermissionCatalogService());

    await expect(
      service.replacePermissions("role-1", { permissionCodes: ["rbac.role.create"] }, actor),
    ).resolves.toMatchObject({ permissionCodes: ["rbac.role.create"] });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: "role-1" } });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: "role-1", permissionId: "permission-1" },
        { roleId: "role-1", permissionId: "permission-2" },
      ],
    });
    expect(prisma.permissionAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operatorId: "admin-1",
          operationType: "assign_permission",
          targetType: "role",
          targetId: "role-1",
          ip: "127.0.0.1",
        }),
      }),
    );
  });

  it("atomically replaces role users only after every requested user exists and writes an audit log", async () => {
    const prisma = createPrisma();

    prisma.role.findUnique.mockResolvedValue(role());
    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        phone: "13800000001",
        username: null,
        nickname: "User 1",
        avatar: null,
        userType: "pet_owner",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "user-2",
        phone: "13800000002",
        username: null,
        nickname: "User 2",
        avatar: null,
        userType: "pet_owner",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    const service = new RoleService(prisma as never, new PermissionCatalogService());

    await service.replaceUsers("role-1", { userIds: ["user-2", "user-1"] }, actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { roleId: "role-1" } });
    expect(prisma.userRole.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: "role-1", userId: "user-1" },
        { roleId: "role-1", userId: "user-2" },
      ],
    });
    expect(prisma.permissionAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ operationType: "assign_user_role", targetId: "role-1" }),
      }),
    );
  });

  it("rejects user-role replacement when any requested user is missing before beginning a transaction", async () => {
    const prisma = createPrisma();

    prisma.role.findUnique.mockResolvedValue(role());
    prisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
    const service = new RoleService(prisma as never, new PermissionCatalogService());

    await expect(
      service.replaceUsers("role-1", { userIds: ["user-1", "missing-user"] }, actor),
    ).rejects.toMatchObject({ code: "RBAC_USER_NOT_FOUND", status: HttpStatus.NOT_FOUND });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
