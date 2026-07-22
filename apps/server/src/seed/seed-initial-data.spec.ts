import { PasswordService } from "../auth/password.service";
import { PrismaClient } from "../generated/prisma/client";
import { SeedOptions, seedInitialData } from "./seed-initial-data";

interface StoredPermission {
  id: string;
  permissionCode: string;
  permissionName: string;
  module: string;
  type: string;
}

interface StoredRole {
  id: string;
  roleName: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
}

interface StoredUser {
  id: string;
  username: string;
  phone: string;
  nickname: string;
  passwordHash: string;
  userType: string;
  status: string;
}

function createFakePrisma() {
  const permissions: StoredPermission[] = [];
  const roles: StoredRole[] = [];
  const users: StoredUser[] = [];
  const rolePermissions: Array<{ roleId: string; permissionId: string }> = [];
  const userRoles: Array<{ userId: string; roleId: string }> = [];

  const prisma = {
    permission: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const existing = permissions.find(
          (permission) => permission.permissionCode === where.permissionCode,
        );

        if (existing) {
          Object.assign(existing, update);

          return existing;
        }

        const permission = { id: `permission-${permissions.length + 1}`, ...create };

        permissions.push(permission);

        return permission;
      }),
      findMany: jest.fn(async () => permissions),
    },
    role: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const existing = roles.find((role) => role.roleName === where.roleName);

        if (existing) {
          Object.assign(existing, update);

          return existing;
        }

        const role = {
          id: `role-${roles.length + 1}`,
          isActive: true,
          ...create,
        };

        roles.push(role);

        return role;
      }),
    },
    rolePermission: {
      upsert: jest.fn(async ({ where, create }) => {
        const key = where.roleId_permissionId;
        const existing = rolePermissions.find(
          (relation) =>
            relation.roleId === key.roleId && relation.permissionId === key.permissionId,
        );

        if (existing) {
          return existing;
        }

        rolePermissions.push(create);

        return create;
      }),
    },
    user: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const existing = users.find((user) => user.phone === where.phone);

        if (existing) {
          Object.assign(existing, update);

          return existing;
        }

        const user = { id: `user-${users.length + 1}`, ...create };

        users.push(user);

        return user;
      }),
    },
    userRole: {
      upsert: jest.fn(async ({ where, create }) => {
        const key = where.userId_roleId;
        const existing = userRoles.find(
          (relation) => relation.userId === key.userId && relation.roleId === key.roleId,
        );

        if (existing) {
          return existing;
        }

        userRoles.push(create);

        return create;
      }),
    },
  };

  return {
    prisma: prisma as unknown as PrismaClient,
    permissions,
    roles,
    users,
    rolePermissions,
    userRoles,
  };
}

describe("seedInitialData", () => {
  const options: SeedOptions = {
    username: "admin",
    phone: "17679141878",
    password: "Correct-Horse-Battery-Staple!42",
    nickname: "系统管理员",
  };
  const passwordService = {
    hash: jest.fn(async () => "$argon2id$v=19$seed-test-hash"),
  } as unknown as PasswordService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates one super administrator and assigns every permission", async () => {
    const state = createFakePrisma();

    await seedInitialData(state.prisma, options, passwordService);

    expect(state.permissions.length).toBeGreaterThan(0);
    expect(state.roles).toEqual([
      expect.objectContaining({ roleName: "super_admin", isSystem: true, isActive: true }),
    ]);
    expect(state.users).toEqual([
      expect.objectContaining({
        username: "admin",
        phone: "17679141878",
        nickname: "系统管理员",
        passwordHash: "$argon2id$v=19$seed-test-hash",
        status: "active",
      }),
    ]);
    expect(state.userRoles).toHaveLength(1);
    expect(state.rolePermissions).toHaveLength(state.permissions.length);
  });

  it("is idempotent", async () => {
    const state = createFakePrisma();

    await seedInitialData(state.prisma, options, passwordService);
    await seedInitialData(state.prisma, options, passwordService);

    expect(state.roles).toHaveLength(1);
    expect(state.users).toHaveLength(1);
    expect(state.userRoles).toHaveLength(1);
    expect(state.rolePermissions).toHaveLength(state.permissions.length);
  });
});
