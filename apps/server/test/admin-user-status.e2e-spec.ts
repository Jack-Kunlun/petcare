import { spawnSync } from "node:child_process";
import path from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Client } from "pg";
import request from "supertest";
import { PasswordService } from "../src/auth/password.service";
import { RedisService } from "../src/config/redis.service";
import { AppLogger } from "../src/logging/app-logger.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { seedInitialData } from "../src/seed/seed-initial-data";
import {
  buildDropSchemaIfExistsStatement,
  IsolatedPostgresSchemaLifecycle,
} from "./support/isolated-postgres-schema";

const schemaName = `isolated_e2e_${process.pid}_${Date.now()}`;
const operatorCredentials = {
  identifier: "user-status-e2e-operator",
  password: "User-Status-E2E-Operator-2026!",
};
const targetCredentials = {
  identifier: "user-status-e2e-target",
  password: "User-Status-E2E-Target-2026!",
};
const restrictedCredentials = {
  identifier: "user-status-e2e-restricted",
  password: "User-Status-E2E-Restricted-2026!",
};

function pushSchema(): void {
  const prismaCli = path.resolve(__dirname, "../node_modules/prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaCli, "db", "push"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DB_SCHEMA: schemaName },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `Unable to initialize isolated user-status E2E schema (exit ${String(result.status)})`,
    );
  }
}

async function dropSchema(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || "user",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "petcare",
  });

  await client.connect();

  try {
    await client.query(buildDropSchemaIfExistsStatement(schemaName));
  } finally {
    await client.end();
  }
}

describe("Admin user ban and restore boundary (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let operatorId: string;
  let targetId: string;
  let operatorToken: string;
  let targetToken: string;
  let restrictedToken: string;
  const lifecycle = new IsolatedPostgresSchemaLifecycle({
    schemaName,
    environment: process.env,
    overrides: {
      JWT_SECRET: "user-status-e2e-only-jwt-secret-2026-08-28",
      NODE_ENV: "test",
    },
    initialize: async () => pushSchema(),
    close: async () => {
      await app?.close();
    },
    drop: dropSchema,
  });

  beforeAll(async () => {
    await lifecycle.setup();

    const { AppModule } = await import("../src/app.module");
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService)
      .useValue({
        consumeFixedWindow: jest.fn().mockResolvedValue(true),
        set: jest.fn().mockResolvedValue(undefined),
        getAndDelete: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(AppLogger)
      .useValue({ write: jest.fn() })
      .compile();

    app = moduleReference.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = moduleReference.get(PrismaService);
    const passwordService = moduleReference.get(PasswordService);
    await seedInitialData(
      prisma,
      {
        username: operatorCredentials.identifier,
        password: operatorCredentials.password,
        nickname: "用户状态 E2E 管理员",
      },
      passwordService,
    );
    const operator = await prisma.user.findUniqueOrThrow({
      where: { username: operatorCredentials.identifier },
    });
    operatorId = operator.id;
    operatorToken = await login(operatorCredentials);

    const superAdminRole = await prisma.role.findUniqueOrThrow({
      where: { roleName: "super_admin" },
    });
    const target = await prisma.user.create({
      data: {
        username: targetCredentials.identifier,
        phone: "13900000092",
        passwordHash: await passwordService.hash(targetCredentials.password),
        nickname: "用户状态 E2E 目标用户",
        status: "active",
      },
    });
    targetId = target.id;
    await prisma.userRole.create({
      data: { userId: target.id, roleId: superAdminRole.id },
    });
    targetToken = await login(targetCredentials);

    const userViewPermission = await prisma.permission.findUniqueOrThrow({
      where: { permissionCode: "user.view" },
    });
    const restrictedRole = await prisma.role.create({
      data: {
        roleName: "user_status_e2e_readonly",
        description: "仅查看用户，不允许变更状态",
        permissions: { create: { permissionId: userViewPermission.id } },
      },
    });
    const restrictedUser = await prisma.user.create({
      data: {
        username: restrictedCredentials.identifier,
        phone: "13900000093",
        passwordHash: await passwordService.hash(restrictedCredentials.password),
        nickname: "用户状态 E2E 只读管理员",
        status: "active",
      },
    });
    await prisma.userRole.create({
      data: { userId: restrictedUser.id, roleId: restrictedRole.id },
    });
    restrictedToken = await login(restrictedCredentials);
  }, 120_000);

  afterAll(async () => {
    await lifecycle.teardown();
  }, 30_000);

  async function login(credentials: { identifier: string; password: string }): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/auth/login/password")
      .send(credentials)
      .expect(200);

    return response.body.data.accessToken as string;
  }

  it("enforces update permission and forbids self-ban", async () => {
    const forbidden = await request(app.getHttpServer())
      .post(`/admin/users/${targetId}/ban`)
      .set("Authorization", `Bearer ${restrictedToken}`)
      .expect(403);
    expect(forbidden.body.code).toBe("FORBIDDEN");

    const selfBan = await request(app.getHttpServer())
      .post(`/admin/users/${operatorId}/ban`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .expect(409);
    expect(selfBan.body.code).toBe("USER_SELF_BAN_FORBIDDEN");
  });

  it("invalidates existing sessions on ban and keeps them invalid after restore", async () => {
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${targetToken}`)
      .expect(200);

    const banned = await request(app.getHttpServer())
      .post(`/admin/users/${targetId}/ban`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .expect(200);
    expect(banned.body.data).toMatchObject({ id: targetId, status: "banned" });
    await expect(prisma.user.findUniqueOrThrow({ where: { id: targetId } })).resolves.toMatchObject(
      {
        status: "banned",
        sessionVersion: 1,
      },
    );

    const expiredAfterBan = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${targetToken}`)
      .expect(401);
    expect(expiredAfterBan.body.code).toBe("AUTH_SESSION_EXPIRED");
    const loginWhileBanned = await request(app.getHttpServer())
      .post("/auth/login/password")
      .send(targetCredentials)
      .expect(401);
    expect(loginWhileBanned.body.code).toBe("AUTH_INVALID_CREDENTIALS");

    await request(app.getHttpServer())
      .post(`/admin/users/${targetId}/restore`)
      .set("Authorization", `Bearer ${restrictedToken}`)
      .expect(403);

    const restored = await request(app.getHttpServer())
      .post(`/admin/users/${targetId}/restore`)
      .set("Authorization", `Bearer ${operatorToken}`)
      .expect(200);
    expect(restored.body.data).toMatchObject({ id: targetId, status: "active" });
    await expect(prisma.user.findUniqueOrThrow({ where: { id: targetId } })).resolves.toMatchObject(
      {
        status: "active",
        sessionVersion: 2,
      },
    );

    const stillExpired = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${targetToken}`)
      .expect(401);
    expect(stillExpired.body.code).toBe("AUTH_SESSION_EXPIRED");

    const freshToken = await login(targetCredentials);
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${freshToken}`)
      .expect(200);
  }, 60_000);
});
