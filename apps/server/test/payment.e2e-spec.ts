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
import { PaymentReconciliationService } from "../src/modules/payment/payment-reconciliation.service";
import { PaymentService } from "../src/modules/payment/payment.service";
import { RefundService } from "../src/modules/payment/refund.service";
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

function notification(
  resource: Record<string, unknown>,
  id = randomUUID(),
  eventType = "TRANSACTION.SUCCESS",
) {
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
    event_type: eventType,
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
  let adminId: string;
  let adminToken: string;
  let commercial = true;
  let reconcileEnabled = false;
  let reconciliation: PaymentReconciliationService;
  const config = new ConfigService();
  const lifecycle = new IsolatedPostgresSchemaLifecycle({
    schemaName,
    environment: process.env,
    overrides: {
      NODE_ENV: "test",
      JWT_SECRET: "payment-e2e-only-secret-2026-09-13",
      WECHAT_PAY_ENABLED: "false",
      WECHAT_PAY_RECONCILIATION_ENABLED: "false",
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
          return commercial;
        }
        if (property === "paymentReconciliationEnabled") {
          return reconcileEnabled;
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
    reconciliation = module.get(PaymentReconciliationService);
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
    const admin = await prisma.user.create({
      data: {
        nickname: "Refund administrator",
        roles: { create: { role: { create: { roleName: "super_admin" } } } },
      },
    });
    adminId = admin.id;
    await prisma.providerQualificationApplication.create({
      data: { applicantId: providerId, idempotencyKey: randomUUID(), status: "approved" },
    });
    petId = (
      await prisma.pet.create({ data: { ownerId, name: "Test pet", breed: "cat", photos: [] } })
    ).id;
    const jwt = new JwtService({ secret: config.jwtSecret });
    adminToken = jwt.sign({ sub: adminId, sid: randomUUID(), sessionVersion: 0, type: "access" });
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
    commercial = true;
    reconcileEnabled = false;
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
  function send(value: ReturnType<typeof notification>, url = "/payments/wechat/notify") {
    return request(app.getHttpServer())
      .post(url)
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

  async function paidCancelledOrder() {
    const target = await order();
    fetchMock.mockResolvedValueOnce(providerResponse({ prepay_id: "test_prepay_id" }));
    const payment = (await prepay(target.id).expect(201)).body.data.payment;
    const paid = success(payment.paymentId);
    await send(notification(paid)).expect(204);
    await prisma.order.update({ where: { id: target.id }, data: { status: "cancelled" } });
    return { target, payment, paid };
  }

  function refundRequest(
    orderId: string,
    token = adminToken,
    body: Record<string, unknown> = { reason: "Cancelled before service" },
  ) {
    return request(app.getHttpServer())
      .post(`/admin/payments/orders/${orderId}/refund`)
      .auth(token, { type: "bearer" })
      .send(body);
  }

  function refundRefresh(orderId: string, token = adminToken) {
    return request(app.getHttpServer())
      .post(`/admin/payments/orders/${orderId}/refund/refresh`)
      .auth(token, { type: "bearer" });
  }

  function refundResult(
    refundId: string,
    paid: ReturnType<typeof success>,
    status = "PROCESSING",
    providerId = randomBytes(16).toString("hex"),
  ) {
    return {
      out_refund_no: refundId,
      out_trade_no: paid.out_trade_no,
      transaction_id: paid.transaction_id,
      refund_id: providerId,
      create_time: paid.success_time,
      status,
      ...(status === "SUCCESS" ? { success_time: new Date().toISOString() } : {}),
      amount: { total: 1234, refund: 1234, payer_total: 1200, payer_refund: 1200, currency: "CNY" },
    };
  }

  function refundEvent(result: ReturnType<typeof refundResult>, id = randomUUID()) {
    const { status, amount, create_time: _createTime, ...fields } = result;
    const { currency: _currency, ...notificationAmount } = amount;
    return notification(
      { ...fields, mchid: settings.merchantId, refund_status: status, amount: notificationAmount },
      id,
      `REFUND.${status}`,
    );
  }

  const refundNotifyUrl = "/payments/wechat/refund-notify";

  it("restricts refund permission and eligibility, reserves one full refund before uncertain network calls and reuses its number", async () => {
    const { target, payment, paid } = await paidCancelledOrder();
    fetchMock.mockClear();
    await refundRequest(target.id, ownerToken).expect(403);
    await refundRequest(target.id, providerToken).expect(403);
    await refundRefresh(target.id, ownerToken).expect(403);
    await refundRequest(target.id, adminToken, { reason: "     " }).expect(400);
    await refundRequest(target.id, adminToken, {
      reason: "Cancelled before service",
      amountCents: 1,
    }).expect(400);
    await prisma.order.update({ where: { id: target.id }, data: { status: "confirmed" } });
    await refundRequest(target.id).expect(409);
    await prisma.order.update({ where: { id: target.id }, data: { status: "cancelled" } });
    await prisma.orderSop.updateMany({
      where: { orderId: target.id },
      data: { photos: ["isolated-evidence"] },
    });
    await refundRequest(target.id).expect(409);
    await prisma.orderSop.updateMany({ where: { orderId: target.id }, data: { photos: [] } });
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockRejectedValueOnce(new Error("lost response"));
    await refundRequest(target.id).expect(503);
    const original = await prisma.orderRefund.findUniqueOrThrow({
      where: { paymentId: payment.paymentId },
    });
    expect(original).toMatchObject({
      status: "pending",
      amountCents: 1234,
      requestedById: adminId,
      acceptedAt: null,
    });
    expect(
      (await prisma.orderPayment.findUniqueOrThrow({ where: { id: payment.paymentId } })).status,
    ).toBe("refund_pending");
    const result = refundResult(original.id, paid);
    fetchMock.mockImplementation(async (_url, options) => {
      expect(JSON.parse(String(options.body))).toMatchObject({
        out_refund_no: original.id,
        out_trade_no: payment.paymentId,
        amount: { total: 1234, refund: 1234, currency: "CNY" },
      });
      return providerResponse(result);
    });
    commercial = false;
    const retries = await Promise.all([refundRequest(target.id), refundRequest(target.id)]);
    expect(retries.map((r) => r.status)).toEqual([201, 201]);
    expect(
      retries.every(
        (r) => r.body.data.refundId === original.id && r.body.data.status === "processing",
      ),
    ).toBe(true);
    expect(await prisma.orderRefund.count({ where: { paymentId: payment.paymentId } })).toBe(1);
    expect(
      (await prisma.orderRefund.findUniqueOrThrow({ where: { id: original.id } })).acceptedAt,
    ).toEqual(new Date(result.create_time));
    await refundRequest(target.id, adminToken, { reason: "Different request reason" }).expect(409);
    await request(app.getHttpServer())
      .get(`/payments/orders/${target.id}/refund`)
      .auth(ownerToken, { type: "bearer" })
      .expect(200)
      .expect((r) => {
        expect(r.body.data.status).toBe("processing");
        expect(r.body.data).not.toHaveProperty("reason");
        expect(r.body.data).not.toHaveProperty("requestedById");
      });
    await request(app.getHttpServer())
      .get(`/payments/orders/${target.id}/refund`)
      .auth(providerToken, { type: "bearer" })
      .expect(404);
    enabled = false;
    await refundRequest(target.id).expect(404);
    await request(app.getHttpServer()).post(refundNotifyUrl).send({}).expect(404);
  });

  it("validates and atomically deduplicates refund notifications without allowing stale results to restore payment", async () => {
    const { target, payment, paid } = await paidCancelledOrder();
    fetchMock.mockRejectedValueOnce(new Error("lost response"));
    await refundRequest(target.id).expect(503);
    const refund = await prisma.orderRefund.findUniqueOrThrow({
      where: { paymentId: payment.paymentId },
    });
    const result = refundResult(refund.id, paid, "SUCCESS");
    const valid = refundEvent(result);
    await send({ ...valid, body: `${valid.body} ` }, refundNotifyUrl).expect(400);
    for (const patch of [
      { transaction_id: "other" },
      { out_trade_no: "other" },
      { amount: { ...result.amount, refund: 1 } },
      { amount: { ...result.amount, currency: "USD" } },
      { amount: { ...result.amount, payer_refund: 1199 } },
      { success_time: "invalid" },
      { refund_status: "CLOSED" },
      { mchid: "other" },
    ]) {
      await send(
        notification(
          { ...result, mchid: settings.merchantId, refund_status: "SUCCESS", ...patch },
          randomUUID(),
          "REFUND.SUCCESS",
        ),
        refundNotifyUrl,
      ).expect(400);
    }
    await send(refundEvent({ ...result, out_refund_no: "unknown" }), refundNotifyUrl).expect(404);
    expect((await prisma.orderRefund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe(
      "pending",
    );
    const callbacks = await Promise.all([
      send(valid, refundNotifyUrl),
      send(valid, refundNotifyUrl),
      send(notification(paid)),
    ]);
    expect(callbacks.map((r) => r.status)).toEqual([204, 204, 204]);
    const eventId = JSON.parse(valid.body).id;
    expect(await prisma.paymentNotification.count({ where: { id: eventId } })).toBe(1);
    await send(refundEvent({ ...result, refund_id: "different" }, eventId), refundNotifyUrl).expect(
      400,
    );
    await send(refundEvent({ ...result, status: "CLOSED" }, eventId), refundNotifyUrl).expect(400);
    fetchMock.mockResolvedValueOnce(providerResponse({ ...result, status: "PROCESSING" }));
    await refundRefresh(target.id)
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("succeeded"));
    await send(notification(paid)).expect(204);
    fetchMock.mockResolvedValueOnce(providerResponse({ ...paid, trade_state: "REFUND" }));
    await request(app.getHttpServer())
      .post(`/payments/orders/${target.id}/refresh`)
      .auth(ownerToken, { type: "bearer" })
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("refunded"));
    expect(await prisma.orderRefund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({
      status: "succeeded",
      payerRefundCents: 1200,
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(
      "cancelled",
    );
    await request(app.getHttpServer())
      .post(`/bounties/${target.id}/sop/steps/1/complete`)
      .auth(providerToken, { type: "bearer" })
      .expect(409);
  });

  it("recovers refunds by query, retains abnormal outcomes and rolls back provider refund ID collisions", async () => {
    const first = await paidCancelledOrder();
    const second = await paidCancelledOrder();
    fetchMock.mockRejectedValue(new Error("lost response"));
    await refundRequest(first.target.id).expect(503);
    await refundRequest(second.target.id).expect(503);
    const firstRefund = await prisma.orderRefund.findUniqueOrThrow({
      where: { paymentId: first.payment.paymentId },
    });
    const secondRefund = await prisma.orderRefund.findUniqueOrThrow({
      where: { paymentId: second.payment.paymentId },
    });
    const initial = refundResult(firstRefund.id, first.paid, "ABNORMAL");
    fetchMock.mockResolvedValueOnce(providerResponse(initial));
    await refundRefresh(first.target.id)
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("abnormal"));
    fetchMock.mockResolvedValueOnce(providerResponse({ ...initial, status: "PROCESSING" }));
    await refundRefresh(first.target.id)
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("abnormal"));
    await send(refundEvent({ ...initial, status: "CLOSED" }), refundNotifyUrl).expect(204);
    expect(
      (await prisma.orderPayment.findUniqueOrThrow({ where: { id: first.payment.paymentId } }))
        .status,
    ).toBe("refund_pending");
    const completed = refundResult(firstRefund.id, first.paid, "SUCCESS", initial.refund_id);
    fetchMock.mockResolvedValueOnce(providerResponse(completed));
    await refundRefresh(first.target.id)
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("succeeded"));
    const collision = refundEvent(
      refundResult(secondRefund.id, second.paid, "SUCCESS", initial.refund_id),
    );
    await send(collision, refundNotifyUrl).expect(503);
    expect(
      await prisma.orderRefund.findUniqueOrThrow({ where: { id: secondRefund.id } }),
    ).toMatchObject({ status: "pending", providerRefundId: null });
    expect(
      await prisma.paymentNotification.count({ where: { id: JSON.parse(collision.body).id } }),
    ).toBe(0);
    expect(
      (await prisma.orderPayment.findUniqueOrThrow({ where: { id: second.payment.paymentId } }))
        .status,
    ).toBe("refund_pending");
    const proper = refundResult(secondRefund.id, second.paid, "SUCCESS");
    fetchMock.mockResolvedValueOnce(providerResponse(proper));
    await refundRefresh(second.target.id)
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("succeeded"));
    await prisma.role.update({ where: { roleName: "super_admin" }, data: { isActive: false } });
    try {
      await refundRefresh(second.target.id).expect(403);
    } finally {
      await prisma.role.update({ where: { roleName: "super_admin" }, data: { isActive: true } });
    }
  });

  async function onlyDue(paymentId: string) {
    await prisma.orderPayment.updateMany({
      data: { reconcileAfter: new Date(Date.now() + 86_400_000) },
    });
    await prisma.orderPayment.update({
      where: { id: paymentId },
      data: { reconcileAfter: new Date(Date.now() - 60_000) },
    });
  }

  it("freezes verified refund acceptance time, rejects invalid dates atomically and preserves it across callbacks", async () => {
    const { target, payment, paid } = await paidCancelledOrder();
    fetchMock.mockRejectedValueOnce(new Error("lost response"));
    await refundRequest(target.id).expect(503);
    const refund = await prisma.orderRefund.findUniqueOrThrow({
      where: { paymentId: payment.paymentId },
    });
    const result = refundResult(refund.id, paid);
    const service = app.get(RefundService);
    for (const createTime of [
      undefined,
      null,
      "invalid",
      "2026-02-30T00:00:00+08:00",
      "2026-09-14T24:00:00Z",
      new Date(new Date(paid.success_time).getTime() - 1).toISOString(),
      new Date(Date.now() + 600_000).toISOString(),
      new Date(refund.createdAt.getTime() - 600_000).toISOString(),
    ]) {
      fetchMock.mockResolvedValueOnce(providerResponse({ ...result, create_time: createTime }));
      await expect(service.refresh(target.id)).rejects.toMatchObject({
        code: "REFUND_RESULT_INVALID",
      });
      expect(
        await prisma.orderRefund.findUniqueOrThrow({ where: { id: refund.id } }),
      ).toMatchObject({
        status: "pending",
        acceptedAt: null,
        providerRefundId: null,
        checkedAt: null,
      });
    }
    const accepted = new Date(result.create_time);
    const offsetTime = new Date(accepted.getTime() + 8 * 60 * 60 * 1000)
      .toISOString()
      .replace("Z", "+08:00");
    fetchMock.mockResolvedValueOnce(providerResponse({ ...result, create_time: offsetTime }));
    await refundRefresh(target.id).expect(200);
    expect(
      (await prisma.orderRefund.findUniqueOrThrow({ where: { id: refund.id } })).acceptedAt,
    ).toEqual(accepted);
    fetchMock.mockResolvedValueOnce(
      providerResponse({
        ...result,
        create_time: new Date(accepted.getTime() + 1000).toISOString(),
      }),
    );
    await expect(service.refresh(target.id)).rejects.toMatchObject({
      code: "REFUND_RESULT_INVALID",
    });
    fetchMock.mockResolvedValueOnce(
      providerResponse({
        ...result,
        status: "SUCCESS",
        success_time: new Date(accepted.getTime() - 1).toISOString(),
      }),
    );
    await expect(service.refresh(target.id)).rejects.toMatchObject({
      code: "REFUND_RESULT_INVALID",
    });
    expect((await prisma.orderRefund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe(
      "processing",
    );
    const completed = { ...result, status: "SUCCESS", success_time: new Date().toISOString() };
    await send(refundEvent(completed), refundNotifyUrl).expect(204);
    fetchMock.mockResolvedValueOnce(providerResponse(result));
    await refundRefresh(target.id)
      .expect(200)
      .expect((r) => expect(r.body.data.status).toBe("succeeded"));
    expect(await prisma.orderRefund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({
      acceptedAt: accepted,
      succeededAt: new Date(completed.success_time),
    });
  });

  it("recovers acceptance after a success callback without re-refunding or losing terminal state on query failure", async () => {
    const { target, payment, paid } = await paidCancelledOrder();
    fetchMock.mockRejectedValueOnce(new Error("lost response"));
    await refundRequest(target.id).expect(503);
    const refund = await prisma.orderRefund.findUniqueOrThrow({
      where: { paymentId: payment.paymentId },
    });
    const result = refundResult(refund.id, paid, "SUCCESS");
    const callback = refundEvent(result);
    await send(callback, refundNotifyUrl).expect(204);
    expect(await prisma.orderRefund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({
      status: "succeeded",
      acceptedAt: null,
    });
    reconcileEnabled = true;
    commercial = false;
    fetchMock.mockReset();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await onlyDue(payment.paymentId);
      fetchMock.mockRejectedValueOnce(new Error("temporary query failure"));
      expect(await reconciliation.runOnce()).toBe(1);
      expect(
        await prisma.orderPayment.findUniqueOrThrow({ where: { id: payment.paymentId } }),
      ).toMatchObject({ status: "refunded", reconcileFailures: attempt });
    }
    expect(
      (await prisma.orderPayment.findUniqueOrThrow({ where: { id: payment.paymentId } }))
        .reconcileIssue,
    ).toBe("query_failed");
    await onlyDue(payment.paymentId);
    // An acceptance time after an already recorded payout must not be backfilled.
    fetchMock.mockResolvedValueOnce(
      providerResponse({
        ...result,
        status: "PROCESSING",
        create_time: new Date(new Date(result.success_time!).getTime() + 1).toISOString(),
      }),
    );
    expect(await reconciliation.runOnce()).toBe(1);
    expect(
      (await prisma.orderRefund.findUniqueOrThrow({ where: { id: refund.id } })).acceptedAt,
    ).toBeNull();
    await onlyDue(payment.paymentId);
    fetchMock.mockResolvedValueOnce(providerResponse({ ...result, status: "PROCESSING" }));
    expect(await reconciliation.runOnce()).toBe(1);
    expect(await prisma.orderRefund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({
      status: "succeeded",
      acceptedAt: new Date(result.create_time),
    });
    expect(
      await prisma.orderPayment.findUniqueOrThrow({ where: { id: payment.paymentId } }),
    ).toMatchObject({ status: "refunded", reconcileIssue: null, reconcileFailures: 0 });
    // Existing callback fingerprints remain valid after the new field is recovered.
    await send(callback, refundNotifyUrl).expect(204);
    await onlyDue(payment.paymentId);
    expect(await reconciliation.runOnce()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(
      fetchMock.mock.calls.every(
        ([url, options]) =>
          options.method === "GET" && String(url).endsWith(`/refunds/${refund.id}`),
      ),
    ).toBe(true);
  });

  function anotherReconciler() {
    return new PaymentReconciliationService(
      prisma,
      app.get(ConfigService),
      app.get(PaymentService),
      app.get(RefundService),
    );
  }

  async function pendingPayment() {
    const target = await order();
    fetchMock.mockResolvedValueOnce(providerResponse({ prepay_id: "test_prepay_id" }));
    const paymentId = (await prepay(target.id).expect(201)).body.data.payment.paymentId as string;
    fetchMock.mockReset();
    await onlyDue(paymentId);
    return { target, paymentId, paid: success(paymentId) };
  }

  it("recovers missing payments using only GET queries and atomically claims work across instances", async () => {
    const { paymentId, paid } = await pendingPayment();
    expect(await reconciliation.runOnce()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    reconcileEnabled = true;
    commercial = false;
    fetchMock.mockImplementation(async (_url, options) => {
      expect(options.method).toBe("GET");
      return providerResponse(paid);
    });
    const counts = await Promise.all([reconciliation.runOnce(), anotherReconciler().runOnce()]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } })).toMatchObject(
      {
        status: "succeeded",
        reconcileFailures: 0,
        reconcileIssue: null,
        reconcileLeaseToken: null,
        reconcileLeaseUntil: null,
      },
    );
    expect(await reconciliation.runOnce()).toBe(0);
  });

  it("recovers expired leases and fences late worker scheduling without regressing a newer paid result", async () => {
    const { paymentId, paid } = await pendingPayment();
    reconcileEnabled = true;
    await prisma.orderPayment.update({
      where: { id: paymentId },
      data: { reconcileLeaseToken: "crashed", reconcileLeaseUntil: new Date(Date.now() + 120_000) },
    });
    expect(await reconciliation.runOnce()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    await prisma.orderPayment.update({
      where: { id: paymentId },
      data: { reconcileLeaseUntil: new Date(Date.now() - 60_000) },
    });
    let started!: () => void;
    let release!: (response: Response) => void;
    const waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
    fetchMock.mockImplementationOnce(() => {
      started();
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    const first = reconciliation.runOnce();
    await waiting;
    await prisma.orderPayment.update({
      where: { id: paymentId },
      data: { reconcileLeaseUntil: new Date(Date.now() - 60_000) },
    });
    fetchMock.mockResolvedValueOnce(providerResponse(paid));
    expect(await anotherReconciler().runOnce()).toBe(1);
    const newer = await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } });
    release(
      providerResponse({
        appid: settings.appId,
        mchid: settings.merchantId,
        out_trade_no: paymentId,
        trade_state: "NOTPAY",
      }),
    );
    expect(await first).toBe(0);
    const current = await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(current.status).toBe("succeeded");
    expect(current.reconcileAfter).toEqual(newer.reconcileAfter);
    expect(current.reconcileLeaseToken).toBeNull();
    expect(fetchMock.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
  });

  it("persists retry backoff, exposes sanitized issues only to administrators and clears them after verified recovery", async () => {
    const { target, paymentId, paid } = await pendingPayment();
    reconcileEnabled = true;
    fetchMock.mockRejectedValue(new Error("sensitive provider payload must not be persisted"));
    for (let attempt = 1; attempt <= 3; attempt++) {
      await onlyDue(paymentId);
      const started = Date.now();
      expect(await anotherReconciler().runOnce()).toBe(1);
      const current = await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(current.status).toBe("pending");
      expect(current.reconcileFailures).toBe(attempt);
      expect(current.reconcileAfter.getTime()).toBeGreaterThanOrEqual(
        started + 2 ** attempt * 60_000,
      );
      expect(current.reconcileIssue).toBe(attempt === 3 ? "query_failed" : null);
      expect(current.reconcileLeaseToken).toBeNull();
    }
    await request(app.getHttpServer())
      .get("/admin/payments/reconciliation")
      .auth(ownerToken, { type: "bearer" })
      .expect(403);
    await request(app.getHttpServer())
      .get("/admin/payments/reconciliation")
      .auth(adminToken, { type: "bearer" })
      .expect(200)
      .expect((r) => {
        const issue = r.body.data.find(
          (item: { paymentId: string }) => item.paymentId === paymentId,
        );
        expect(issue).toMatchObject({ issue: "query_failed", consecutiveFailures: 3 });
        expect(issue).not.toHaveProperty("payerOpenId");
        expect(JSON.stringify(issue)).not.toContain("sensitive");
      });
    await onlyDue(paymentId);
    fetchMock.mockResolvedValueOnce(
      providerResponse({ ...paid, amount: { total: 1, currency: "CNY" } }),
    );
    await reconciliation.runOnce();
    expect(await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } })).toMatchObject(
      { status: "pending", reconcileIssue: "result_invalid" },
    );
    await onlyDue(paymentId);
    fetchMock.mockResolvedValueOnce(providerResponse(paid));
    await reconciliation.runOnce();
    expect(await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } })).toMatchObject(
      { status: "succeeded", reconcileFailures: 0, reconcileIssue: null },
    );
    await prisma.order.update({ where: { id: target.id }, data: { status: "cancelled" } });
    await onlyDue(paymentId);
    fetchMock.mockResolvedValueOnce(providerResponse(paid));
    await reconciliation.runOnce();
    expect(
      (await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } })).reconcileIssue,
    ).toBe("cancelled_payment");
    await onlyDue(paymentId);
    fetchMock.mockResolvedValueOnce(providerResponse({ ...paid, trade_state: "REFUND" }));
    await reconciliation.runOnce();
    expect(await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } })).toMatchObject(
      { status: "refund_pending", reconcileIssue: "external_refund" },
    );
    expect(await prisma.orderRefund.count({ where: { paymentId } })).toBe(0);
    expect(fetchMock.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
  });

  it("flags overdue payments without cancelling them and never queries under a mismatched merchant configuration", async () => {
    const { target, paymentId } = await pendingPayment();
    reconcileEnabled = true;
    await prisma.orderPayment.update({
      where: { id: paymentId },
      data: { createdAt: new Date(Date.now() - 25 * 3_600_000) },
    });
    fetchMock.mockResolvedValueOnce(
      providerResponse({
        appid: settings.appId,
        mchid: settings.merchantId,
        out_trade_no: paymentId,
        trade_state: "NOTPAY",
      }),
    );
    await reconciliation.runOnce();
    expect(await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } })).toMatchObject(
      { status: "pending", reconcileIssue: "payment_pending_too_long" },
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(
      "confirmed",
    );
    await onlyDue(paymentId);
    await prisma.orderPayment.update({
      where: { id: paymentId },
      data: { merchantId: "1900000002" },
    });
    fetchMock.mockClear();
    await reconciliation.runOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      (await prisma.orderPayment.findUniqueOrThrow({ where: { id: paymentId } })).reconcileIssue,
    ).toBe("result_invalid");
  });

  it("queries uncertain refunds without resubmission, records abnormal/closed states and stops on verified success", async () => {
    const { target, payment, paid } = await paidCancelledOrder();
    fetchMock.mockRejectedValueOnce(new Error("lost response"));
    await refundRequest(target.id).expect(503);
    const refund = await prisma.orderRefund.findUniqueOrThrow({
      where: { paymentId: payment.paymentId },
    });
    fetchMock.mockReset();
    reconcileEnabled = true;
    commercial = false;
    const abnormal = refundResult(refund.id, paid, "ABNORMAL");
    for (const [status, issue] of [
      ["ABNORMAL", "refund_abnormal"],
      ["CLOSED", "refund_closed"],
    ]) {
      await onlyDue(payment.paymentId);
      fetchMock.mockResolvedValueOnce(providerResponse({ ...abnormal, status }));
      expect(await reconciliation.runOnce()).toBe(1);
      expect(
        await prisma.orderPayment.findUniqueOrThrow({ where: { id: payment.paymentId } }),
      ).toMatchObject({ status: "refund_pending", reconcileIssue: issue });
    }
    await onlyDue(payment.paymentId);
    fetchMock.mockResolvedValueOnce(
      providerResponse(refundResult(refund.id, paid, "SUCCESS", abnormal.refund_id)),
    );
    expect(await reconciliation.runOnce()).toBe(1);
    expect(
      await prisma.orderPayment.findUniqueOrThrow({ where: { id: payment.paymentId } }),
    ).toMatchObject({ status: "refunded", reconcileIssue: null });
    await onlyDue(payment.paymentId);
    expect(await reconciliation.runOnce()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.every(
        ([url, options]) =>
          options.method === "GET" && String(url).endsWith(`/refunds/${refund.id}`),
      ),
    ).toBe(true);
  });
});
