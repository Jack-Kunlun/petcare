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
import { seedSystemSettings } from "../src/seed/seed-system-settings";

const schemaName = `system_settings_e2e_${process.pid}_${Date.now()}`;
const adminCredentials = {
  identifier: "settings-e2e-admin",
  password: "Settings-E2e-Admin-2026!",
};
const viewerCredentials = {
  identifier: "settings-e2e-viewer",
  password: "Settings-E2e-Viewer-2026!",
};

function assertIsolatedSchema(): void {
  if (!/^system_settings_e2e_\d+_\d+$/u.test(schemaName) || schemaName === "public") {
    throw new Error("System settings E2E requires an isolated disposable schema");
  }
}

function pushSchema(): void {
  const prismaCli = path.resolve(__dirname, "../node_modules/prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaCli, "db", "push"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DB_SCHEMA: schemaName },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`Unable to initialize isolated E2E schema (exit ${String(result.status)})`);
  }
}

async function dropSchema(): Promise<void> {
  assertIsolatedSchema();
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || "user",
    password: process.env.DB_PASSWORD || "password",
    database: process.env.DB_NAME || "petcare",
  });

  await client.connect();

  try {
    await client.query(`DROP SCHEMA "${schemaName}" CASCADE`);
  } finally {
    await client.end();
  }
}

describe("System settings closed loop (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let schemaReady = false;
  let adminToken: string;
  let viewerToken: string;
  let petId: string;
  const originalSchema = process.env.DB_SCHEMA;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    assertIsolatedSchema();
    process.env.DB_SCHEMA = schemaName;
    process.env.JWT_SECRET = "settings-e2e-only-jwt-secret-2026-08-02";
    process.env.NODE_ENV = "test";
    pushSchema();
    schemaReady = true;

    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService)
      .useValue({
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
        username: adminCredentials.identifier,
        phone: "13900000001",
        password: adminCredentials.password,
        nickname: "系统设置验收管理员",
      },
      passwordService,
    );
    const administrator = await prisma.user.findUniqueOrThrow({
      where: { username: adminCredentials.identifier },
    });

    await seedSystemSettings(prisma, administrator.id);

    const viewPermission = await prisma.permission.findUniqueOrThrow({
      where: { permissionCode: "system.view" },
    });
    const viewerRole = await prisma.role.create({
      data: {
        roleName: "settings_e2e_viewer",
        description: "系统设置只读验收角色",
        isSystem: false,
        isActive: true,
      },
    });

    await prisma.rolePermission.create({
      data: { roleId: viewerRole.id, permissionId: viewPermission.id },
    });
    const viewer = await prisma.user.create({
      data: {
        username: viewerCredentials.identifier,
        phone: "13900000002",
        passwordHash: await passwordService.hash(viewerCredentials.password),
        nickname: "系统设置只读验收员",
        status: "active",
      },
    });

    await prisma.userRole.create({ data: { userId: viewer.id, roleId: viewerRole.id } });
    await prisma.user.create({
      data: {
        id: "mock-owner-id",
        phone: "13900000003",
        nickname: "订单快照验收用户",
        status: "active",
      },
    });
    const pet = await prisma.pet.create({
      data: {
        ownerId: "mock-owner-id",
        name: "快照测试宠物",
        breed: "中华田园猫",
        age: 3,
        gender: "female",
        photos: [],
      },
    });

    petId = pet.id;
    adminToken = await login(adminCredentials);
    viewerToken = await login(viewerCredentials);
  }, 120_000);

  afterAll(async () => {
    await app?.close();

    try {
      if (schemaReady) {
        await dropSchema();
      }
    } finally {
      if (originalSchema === undefined) delete process.env.DB_SCHEMA;
      else process.env.DB_SCHEMA = originalSchema;
      if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalJwtSecret;
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  }, 30_000);

  async function login(credentials: typeof adminCredentials): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/auth/login/password")
      .send(credentials)
      .expect(200);

    return response.body.data.accessToken as string;
  }

  function createRewardOrder() {
    return request(app.getHttpServer())
      .post("/orders/reward")
      .send({
        serviceType: "feeding",
        petId,
        serviceTime: "2026-08-03T08:00:00.000Z",
        rewardAmount: 10_000,
        address: "系统设置 E2E 隔离测试地址",
      })
      .expect(201);
  }

  it("保存发布配置、冻结订单快照、恢复历史并保护并发与权限边界", async () => {
    const initialSop = await request(app.getHttpServer())
      .get("/admin/system-settings/sop/feeding/current")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const initialFee = await request(app.getHttpServer())
      .get("/admin/system-settings/fee/current")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const oldOrderResponse = await createRewardOrder();
    const oldOrder = oldOrderResponse.body.data.order;

    expect(oldOrder).toMatchObject({
      sopConfigVersionId: initialSop.body.data.id,
      feeConfigVersionId: initialFee.body.data.id,
    });

    const forbidden = await request(app.getHttpServer())
      .put("/admin/system-settings/fee/draft")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ revision: 0, config: initialFee.body.data.config, changeSummary: "越权保存" })
      .expect(403);

    expect(forbidden.body.code).toBe("FORBIDDEN");

    const sopConfig = {
      ...initialSop.body.data.config,
      steps: initialSop.body.data.config.steps.map((step: { stepNumber: number }) =>
        step.stepNumber === 1
          ? { ...step, instruction: "进门前完成消毒并上传清晰照片留档。" }
          : step,
      ),
    };
    const sopDraft = await request(app.getHttpServer())
      .put("/admin/system-settings/sop/feeding/draft")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ revision: 0, config: sopConfig, changeSummary: "完善进门消毒流程" })
      .expect(200);
    const publishedSop = await request(app.getHttpServer())
      .post("/admin/system-settings/sop/feeding/publish")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ revision: sopDraft.body.data.revision, idempotencyKey: "e2e-sop-publish-v2" })
      .expect(200);
    const sopUpdatedOrder = (await createRewardOrder()).body.data.order;
    const oldOrderAfterSopPublish = await request(app.getHttpServer())
      .get(`/orders/${oldOrder.id}`)
      .expect(200);

    expect(sopUpdatedOrder.sopConfigVersionId).toBe(publishedSop.body.data.id);
    expect(sopUpdatedOrder.sopConfigVersionId).not.toBe(oldOrder.sopConfigVersionId);
    expect(oldOrderAfterSopPublish.body.data.sopConfigVersionId).toBe(oldOrder.sopConfigVersionId);

    const feeConfig = { ...initialFee.body.data.config, platformCommissionBps: 1200 };
    const feeDraft = await request(app.getHttpServer())
      .put("/admin/system-settings/fee/draft")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ revision: 0, config: feeConfig, changeSummary: "平台佣金调整为百分之十二" })
      .expect(200);
    const publishedFee = await request(app.getHttpServer())
      .post("/admin/system-settings/fee/publish")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ revision: feeDraft.body.data.revision, idempotencyKey: "e2e-fee-publish-v2" })
      .expect(200);
    const feeUpdatedOrder = (await createRewardOrder()).body.data.order;
    const oldOrderAfterFeePublish = await request(app.getHttpServer())
      .get(`/orders/${oldOrder.id}`)
      .expect(200);

    expect(feeUpdatedOrder.feeConfigVersionId).toBe(publishedFee.body.data.id);
    expect(feeUpdatedOrder.feeConfigVersionId).not.toBe(oldOrder.feeConfigVersionId);
    expect(oldOrderAfterFeePublish.body.data.feeConfigVersionId).toBe(oldOrder.feeConfigVersionId);

    const restoredFeeDraft = await request(app.getHttpServer())
      .post("/admin/system-settings/fee/restore")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        version: initialFee.body.data.version,
        revision: 0,
        changeSummary: "恢复初始费率作为新草稿",
      })
      .expect(200);
    const restoredFee = await request(app.getHttpServer())
      .post("/admin/system-settings/fee/publish")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        revision: restoredFeeDraft.body.data.revision,
        idempotencyKey: "e2e-fee-restore-publish-v3",
      })
      .expect(200);

    expect(restoredFee.body.data.config).toEqual(initialFee.body.data.config);

    const concurrencyDraft = await request(app.getHttpServer())
      .put("/admin/system-settings/fee/draft")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        revision: 0,
        config: { ...initialFee.body.data.config, platformCommissionBps: 1300 },
        changeSummary: "验证乐观锁与发布幂等",
      })
      .expect(200);
    const staleSave = await request(app.getHttpServer())
      .put("/admin/system-settings/fee/draft")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        revision: 0,
        config: concurrencyDraft.body.data.config,
        changeSummary: "陈旧修订号不得覆盖",
      })
      .expect(409);

    expect(staleSave.body.code).toBe("SYSTEM_CONFIG_VERSION_CONFLICT");

    const idempotentCommand = {
      revision: concurrencyDraft.body.data.revision,
      idempotencyKey: "e2e-fee-idempotent-publish-v4",
    };
    const firstPublish = await request(app.getHttpServer())
      .post("/admin/system-settings/fee/publish")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(idempotentCommand)
      .expect(200);
    const repeatedPublish = await request(app.getHttpServer())
      .post("/admin/system-settings/fee/publish")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(idempotentCommand)
      .expect(200);
    const feeHistory = await request(app.getHttpServer())
      .get("/admin/system-settings/fee/history?page=1&pageSize=20")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(repeatedPublish.body.data).toEqual(firstPublish.body.data);
    expect(
      feeHistory.body.data.list.filter(
        (version: { id: string }) => version.id === firstPublish.body.data.id,
      ),
    ).toHaveLength(1);
  }, 60_000);
});
