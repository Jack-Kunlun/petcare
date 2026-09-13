import { spawnSync } from "node:child_process";
import { createCipheriv, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Client } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { ConfigService } from "../src/config/config.service";
import { RedisService } from "../src/config/redis.service";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  buildDropSchemaIfExistsStatement,
  IsolatedPostgresSchemaLifecycle,
} from "./support/isolated-postgres-schema";

const schemaName = `isolated_e2e_${process.pid}_${Date.now()}`;
const merchant = generateKeyPairSync("rsa", { modulusLength: 2048 });
const platform = generateKeyPairSync("rsa", { modulusLength: 2048 });
const settings = {
  appId: "wx1234567890abcdef",
  merchantId: "1900000001",
  certificateSerial: "AB1234",
  publicKeyId: "PUB_KEY_ID_1234567890",
  apiV3Key: "0123456789abcdef0123456789abcdef",
  privateKeyPath: "",
  publicKeyPath: "",
  notifyUrl: "https://example.test/notify",
  refundNotifyUrl: "https://example.test/refund",
};

function signedHeaders(body: Buffer) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  return {
    "wechatpay-timestamp": timestamp,
    "wechatpay-nonce": nonce,
    "wechatpay-serial": settings.publicKeyId,
    "wechatpay-signature": sign(
      "RSA-SHA256",
      Buffer.concat([Buffer.from(`${timestamp}\n${nonce}\n`), body, Buffer.from("\n")]),
      platform.privateKey,
    ).toString("base64"),
  };
}

function providerResponse(data: unknown) {
  const body = Buffer.from(JSON.stringify(data));
  return new Response(body, { headers: signedHeaders(body) });
}

function notification(resource: Record<string, unknown>, id = randomUUID()) {
  const nonce = randomBytes(6).toString("hex");
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(settings.apiV3Key), Buffer.from(nonce));
  cipher.setAAD(Buffer.from("transaction"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(resource)),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
  const body = JSON.stringify({
    id,
    event_type: "TRANSACTION.SUCCESS",
    resource_type: "encrypt-resource",
    resource: { algorithm: "AEAD_AES_256_GCM", nonce, associated_data: "transaction", ciphertext },
  });
  return { body, headers: signedHeaders(Buffer.from(body)) };
}

describe("Direct merchant payment persistence (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directory: string;
  let enabled = true;
  let fetchMock: jest.SpyInstance;
  let ownerId: string;
  let providerId: string;
  let petId: string;
  let ownerToken: string;
  let providerToken: string;
  const config = new ConfigService();
  const lifecycle = new IsolatedPostgresSchemaLifecycle({
    schemaName,
    environment: process.env,
    overrides: {
      NODE_ENV: "test",
      JWT_SECRET: "payment-e2e-only-secret-2026-09-13",
      WECHAT_PAY_ENABLED: "false",
    },
    initialize: async () => {
      const result = spawnSync(
        process.execPath,
        [path.resolve(__dirname, "../node_modules/prisma/build/index.js"), "db", "push"],
        { cwd: path.resolve(__dirname, ".."), env: process.env, encoding: "utf8" },
      );
      if (result.status !== 0) {
        throw new Error("Unable to initialize isolated payment schema");
      }
    },
    close: async () => {
      await app?.close();
      fetchMock?.mockRestore();
      if (directory) {
        rmSync(directory, { recursive: true, force: true });
      }
    },
    drop: async () => {
      const client = new Client({ connectionString: config.databaseUrl });
      await client.connect();
      try {
        await client.query(buildDropSchemaIfExistsStatement(schemaName));
      } finally {
        await client.end();
      }
    },
  });

  beforeAll(async () => {
    await lifecycle.setup();
    directory = mkdtempSync(path.join(tmpdir(), "petcare-payment-e2e-"));
    settings.privateKeyPath = path.join(directory, "merchant.pem");
    settings.publicKeyPath = path.join(directory, "wechat.pem");
    writeFileSync(
      settings.privateKeyPath,
      merchant.privateKey.export({ type: "pkcs8", format: "pem" }),
    );
    writeFileSync(
      settings.publicKeyPath,
      platform.publicKey.export({ type: "spki", format: "pem" }),
    );
    const configured = new Proxy(config, {
      get(target, property, receiver) {
        if (property === "wechatPay") {
          return enabled ? settings : null;
        }
        if (property === "commercialServicesEnabled") {
          return true;
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(configured)
      .overrideProvider(RedisService)
      .useValue({
        consumeFixedWindow: jest.fn().mockResolvedValue(true),
        set: jest.fn(),
        getAndDelete: jest.fn(),
        del: jest.fn(),
      })
      .compile();
    app = module.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    prisma = module.get(PrismaService);
    const owner = await prisma.user.create({
      data: { nickname: "Payment owner", phone: "13900000071", openid: "payment_owner_openid" },
    });
    const provider = await prisma.user.create({
      data: {
        nickname: "Payment provider",
        phone: "13900000072",
        userType: "provider",
        provider: { create: { idCardVerified: true, trainingPassed: true, certifiedSitter: true } },
      },
    });
    ownerId = owner.id;
    providerId = provider.id;
    await prisma.providerQualificationApplication.create({
      data: { applicantId: providerId, idempotencyKey: randomUUID(), status: "approved" },
    });
    petId = (
      await prisma.pet.create({ data: { ownerId, name: "Test pet", breed: "cat", photos: [] } })
    ).id;
    const jwt = new JwtService({ secret: config.jwtSecret });
    ownerToken = jwt.sign({ sub: ownerId, sid: randomUUID(), sessionVersion: 0, type: "access" });
    providerToken = jwt.sign({
      sub: providerId,
      sid: randomUUID(),
      sessionVersion: 0,
      type: "access",
    });
    fetchMock = jest.spyOn(globalThis, "fetch");
  }, 60_000);
  afterAll(async () => lifecycle.teardown());
  beforeEach(() => {
    enabled = true;
    fetchMock.mockReset();
  });

  async function order() {
    return prisma.order.create({
      data: {
        ownerId,
        providerId,
        petId,
        orderType: "reward",
        serviceType: "feeding",
        amount: 1234,
        address: "isolated address",
        serviceTime: new Date(Date.now() + 3_600_000),
        status: "confirmed",
        sops: {
          create: {
            stepNumber: 1,
            stepName: "Care",
            instruction: "Isolated payment verification",
            expectedDurationMinutes: 1,
            violationGuidance: "[]",
            photos: [],
            videos: [],
            minimumPhotoCount: 0,
          },
        },
      },
    });
  }
  function prepay(orderId: string, token = ownerToken) {
    return request(app.getHttpServer())
      .post(`/payments/orders/${orderId}/prepay`)
      .auth(token, { type: "bearer" });
  }
  function send(value: ReturnType<typeof notification>) {
    return request(app.getHttpServer())
      .post("/payments/wechat/notify")
      .set(value.headers)
      .set("Content-Type", "application/json")
      .send(value.body);
  }
  function success(id: string) {
    return {
      appid: settings.appId,
      mchid: settings.merchantId,
      out_trade_no: id,
      trade_type: "JSAPI",
      trade_state: "SUCCESS",
      transaction_id: randomBytes(16).toString("hex"),
      success_time: new Date().toISOString(),
      amount: { total: 1234, currency: "CNY" },
      payer: { openid: "payment_owner_openid" },
    };
  }

  it("freezes one payment number under concurrent prepay, rejects ownership and retains uncertain submissions", async () => {
    const target = await order();
    await prepay(target.id, providerToken).expect(404);
    fetchMock.mockImplementation(async () => providerResponse({ prepay_id: "test_prepay_id" }));
    const results = await Promise.all([prepay(target.id), prepay(target.id)]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results[0].body.data.payment).toEqual(results[1].body.data.payment);
    expect(await prisma.orderPayment.count({ where: { orderId: target.id } })).toBe(1);
    expect(results[0].body.data.payment).toMatchObject({
      amountCents: 1234,
      status: "pending",
      paidAt: null,
    });
    const original = results[0].body.data.payment.paymentId;
    fetchMock.mockRejectedValueOnce(new Error("request timed out"));
    await prepay(target.id).expect(503);
    expect(await prisma.orderPayment.findUnique({ where: { orderId: target.id } })).toMatchObject({
      id: original,
      status: "pending",
    });
    enabled = false;
    await prepay(target.id).expect(404);
    await request(app.getHttpServer()).post("/payments/wechat/notify").send({}).expect(404);
  });

  it("requires authentic exact-amount payment before SOP, atomically deduplicates callbacks and prevents stale query regression", async () => {
    const target = await order();
    const sopUrl = `/bounties/${target.id}/sop`;
    await request(app.getHttpServer())
      .get(sopUrl)
      .auth(providerToken, { type: "bearer" })
      .expect(200)
      .expect((r) => expect(r.body.data.canExecute).toBe(false));
    await request(app.getHttpServer())
      .post(`${sopUrl}/steps/1/complete`)
      .auth(providerToken, { type: "bearer" })
      .expect(409);
    fetchMock.mockImplementation(async () => providerResponse({ prepay_id: "test_prepay_id" }));
    const created = await prepay(target.id).expect(201);
    const id = created.body.data.payment.paymentId;
    const resource = success(id);
    for (const invalid of [
      { ...resource, amount: { total: 1, currency: "CNY" } },
      { ...resource, payer: { openid: "other" } },
      { ...resource, mchid: "1900000002" },
      { ...resource, trade_state: "NOTPAY" },
    ]) {
      await send(notification(invalid)).expect(400);
    }
    const valid = notification(resource);
    await send({ ...valid, body: `${valid.body} ` }).expect(400);
    expect(await prisma.paymentNotification.count({ where: { paymentId: id } })).toBe(0);
    const callbacks = await Promise.all([send(valid), send(valid), send(valid)]);
    expect(callbacks.map((r) => r.status)).toEqual([204, 204, 204]);
    expect(callbacks.every((r) => r.text === "")).toBe(true);
    expect(await prisma.paymentNotification.count({ where: { paymentId: id } })).toBe(1);
    await send(
      notification(
        { ...resource, transaction_id: "different_transaction" },
        JSON.parse(valid.body).id,
      ),
    ).expect(400);
    fetchMock.mockResolvedValueOnce(
      providerResponse({
        appid: settings.appId,
        mchid: settings.merchantId,
        out_trade_no: id,
        trade_state: "NOTPAY",
      }),
    );
    await request(app.getHttpServer())
      .post(`/payments/orders/${target.id}/refresh`)
      .auth(ownerToken, { type: "bearer" })
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("succeeded"));
    await request(app.getHttpServer())
      .get(`/payments/orders/${target.id}`)
      .auth(providerToken, { type: "bearer" })
      .expect(404);
    await request(app.getHttpServer())
      .post(`${sopUrl}/steps/1/complete`)
      .auth(providerToken, { type: "bearer" })
      .expect(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(
      "completed",
    );
  });

  it("rolls back a reused provider transaction and accepts a later valid retry", async () => {
    const first = await order();
    const second = await order();
    fetchMock.mockImplementation(async () => providerResponse({ prepay_id: "test_prepay_id" }));
    const firstPayment = (await prepay(first.id).expect(201)).body.data.payment.paymentId;
    const secondPayment = (await prepay(second.id).expect(201)).body.data.payment.paymentId;
    const resource = success(firstPayment);
    await send(notification(resource)).expect(204);
    await send(notification({ ...resource, out_trade_no: secondPayment })).expect(503);
    expect(
      await prisma.orderPayment.findUniqueOrThrow({ where: { id: secondPayment } }),
    ).toMatchObject({ status: "pending", transactionId: null, paidAt: null });
    expect(await prisma.paymentNotification.count({ where: { paymentId: secondPayment } })).toBe(0);
    await send(notification(success(secondPayment))).expect(204);
  });

  it("records late actual payment without restoring a cancelled order to fulfillment", async () => {
    const target = await order();
    fetchMock.mockResolvedValueOnce(providerResponse({ prepay_id: "test_prepay_id" }));
    const created = await prepay(target.id).expect(201);
    await prisma.order.update({ where: { id: target.id }, data: { status: "cancelled" } });
    await send(notification(success(created.body.data.payment.paymentId))).expect(204);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(
      "cancelled",
    );
    await request(app.getHttpServer())
      .get(`/bounties/${target.id}/sop`)
      .auth(providerToken, { type: "bearer" })
      .expect(200)
      .expect((r) => expect(r.body.data.canExecute).toBe(false));
  });

  it("recovers a missing callback by signed query and prevents fulfillment when transferred to refund", async () => {
    const target = await order();
    fetchMock.mockResolvedValueOnce(providerResponse({ prepay_id: "test_prepay_id" }));
    const created = await prepay(target.id).expect(201);
    const resource = success(created.body.data.payment.paymentId);
    const refreshUrl = `/payments/orders/${target.id}/refresh`;
    fetchMock.mockResolvedValueOnce(providerResponse(resource));
    await request(app.getHttpServer())
      .post(refreshUrl)
      .auth(ownerToken, { type: "bearer" })
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("succeeded"));
    fetchMock.mockResolvedValueOnce(providerResponse({ ...resource, trade_state: "REFUND" }));
    await request(app.getHttpServer())
      .post(refreshUrl)
      .auth(ownerToken, { type: "bearer" })
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("refund_pending"));
    await send(notification(resource)).expect(204);
    expect(
      (await prisma.orderPayment.findUniqueOrThrow({ where: { orderId: target.id } })).status,
    ).toBe("refund_pending");
    await request(app.getHttpServer())
      .post(`/bounties/${target.id}/sop/steps/1/complete`)
      .auth(providerToken, { type: "bearer" })
      .expect(409);
  });
});
