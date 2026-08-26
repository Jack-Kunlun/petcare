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

const schemaName = `rbac_e2e_${process.pid}_${Date.now()}`;
const superAdminCredentials = {
  identifier: "rbac-e2e-super-admin",
  password: "Rbac-E2e-Super-Admin-2026!",
};
const restrictedAdminCredentials = {
  identifier: "rbac-e2e-restricted-admin",
  password: "Rbac-E2e-Restricted-Admin-2026!",
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
      `Unable to initialize isolated RBAC E2E schema (exit ${String(result.status)})`,
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

describe("RBAC authorization boundary (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let restrictedAdminToken: string;
  let restrictedRoleId: string;
  const lifecycle = new IsolatedPostgresSchemaLifecycle({
    schemaName,
    environment: process.env,
    overrides: {
      JWT_SECRET: "rbac-e2e-only-jwt-secret-2026-08-02",
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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
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

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const passwordService = moduleRef.get(PasswordService);
    await seedInitialData(
      prisma,
      {
        username: superAdminCredentials.identifier,
        phone: "13900000081",
        password: superAdminCredentials.password,
        nickname: "RBAC E2E 超级管理员",
      },
      passwordService,
    );
    superAdminToken = await login(superAdminCredentials);

    const createRole = await request(app.getHttpServer())
      .post("/admin/rbac/roles")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ roleName: "rbac_e2e_restricted", description: "仅系统查看的验收角色" })
      .expect(201);
    restrictedRoleId = createRole.body.data.id as string;

    await request(app.getHttpServer())
      .put(`/admin/rbac/roles/${restrictedRoleId}/permissions`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ permissionCodes: ["system.view"] })
      .expect(200);

    const restrictedAdmin = await prisma.user.create({
      data: {
        username: restrictedAdminCredentials.identifier,
        phone: "13900000082",
        passwordHash: await passwordService.hash(restrictedAdminCredentials.password),
        nickname: "RBAC E2E 受限管理员",
        status: "active",
      },
    });
    await prisma.userRole.create({
      data: { userId: restrictedAdmin.id, roleId: restrictedRoleId },
    });
    restrictedAdminToken = await login(restrictedAdminCredentials);
  }, 120_000);

  afterAll(async () => {
    await lifecycle.teardown();
  }, 30_000);

  async function login(credentials: typeof superAdminCredentials): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/auth/login/password")
      .send(credentials)
      .expect(200);

    return response.body.data.accessToken as string;
  }

  it("allows system read but rejects publishing and permission replacement until rbac.role.update is granted", async () => {
    await request(app.getHttpServer())
      .get("/admin/system-settings/overview")
      .set("Authorization", `Bearer ${restrictedAdminToken}`)
      .expect(200);

    const publish = await request(app.getHttpServer())
      .post("/admin/system-settings/fee/publish")
      .set("Authorization", `Bearer ${restrictedAdminToken}`)
      .send({ revision: 0, idempotencyKey: "rbac-e2e-forbidden-publish" })
      .expect(403);
    expect(publish.body.code).toBe("FORBIDDEN");

    const replaceBeforeGrant = await request(app.getHttpServer())
      .put(`/admin/rbac/roles/${restrictedRoleId}/permissions`)
      .set("Authorization", `Bearer ${restrictedAdminToken}`)
      .send({ permissionCodes: ["system.view"] })
      .expect(403);
    expect(replaceBeforeGrant.body.code).toBe("FORBIDDEN");

    await request(app.getHttpServer())
      .put(`/admin/rbac/roles/${restrictedRoleId}/permissions`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ permissionCodes: ["system.view", "rbac.role.update"] })
      .expect(200);
    restrictedAdminToken = await login(restrictedAdminCredentials);

    const replaceAfterGrant = await request(app.getHttpServer())
      .put(`/admin/rbac/roles/${restrictedRoleId}/permissions`)
      .set("Authorization", `Bearer ${restrictedAdminToken}`)
      .send({ permissionCodes: ["system.view"] })
      .expect(200);
    expect(replaceAfterGrant.body.data.permissionCodes).toContain("system.view");
  }, 60_000);
});
