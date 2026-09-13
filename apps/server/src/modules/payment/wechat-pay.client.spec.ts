import { createCipheriv, generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { ConfigService } from "../../config/config.service";
import { WechatPayClient } from "./wechat-pay.client";

jest.mock("node:fs", () => ({ readFileSync: jest.fn() }));

describe("WechatPayClient", () => {
  const merchant = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const platform = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const settings = {
    appId: "wx1234567890abcdef",
    merchantId: "1900000001",
    certificateSerial: "A123456789",
    publicKeyId: "PUB_KEY_ID_1234567890",
    apiV3Key: "0123456789abcdef0123456789abcdef",
    privateKeyPath: "/test/merchant.pem",
    publicKeyPath: "/test/wechat.pem",
    notifyUrl: "https://payments.example.test/payment-notify",
    refundNotifyUrl: "https://payments.example.test/refund-notify",
  };
  const input = {
    orderNumber: "order_123",
    amountCents: 1234,
    openId: "openid_test",
    description: "照护订单",
  };
  let client: WechatPayClient;
  let fetchMock: jest.SpyInstance;

  function headers(body: Buffer, timestamp = Math.floor(Date.now() / 1000).toString()): Headers {
    const nonce = randomBytes(16).toString("hex");
    const signature = sign(
      "RSA-SHA256",
      Buffer.concat([Buffer.from(`${timestamp}\n${nonce}\n`), body, Buffer.from("\n")]),
      platform.privateKey,
    ).toString("base64");

    return new Headers({
      "Wechatpay-Timestamp": timestamp,
      "Wechatpay-Nonce": nonce,
      "Wechatpay-Signature": signature,
      "Wechatpay-Serial": settings.publicKeyId,
      "Wechatpay-Signature-Type": "WECHATPAY2-SHA256-RSA2048",
    });
  }

  function response(value: unknown, status = 200): Response {
    const bytes = Buffer.from(JSON.stringify(value));

    return new Response(bytes, { status, headers: headers(bytes) });
  }

  function notification(overrides: Record<string, unknown> = {}) {
    const nonce = "123456789012";
    const resource = {
      mchid: settings.merchantId,
      appid: settings.appId,
      out_trade_no: input.orderNumber,
      transaction_id: "transaction_123",
      trade_state: "SUCCESS",
      amount: { total: input.amountCents, currency: "CNY" },
      ...overrides,
    };
    const cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(settings.apiV3Key),
      Buffer.from(nonce),
    );

    cipher.setAAD(Buffer.from("transaction"));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(resource)),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    const envelope = {
      id: "notification_123",
      event_type: "TRANSACTION.SUCCESS",
      resource_type: "encrypt-resource",
      resource: {
        original_type: "transaction",
        algorithm: "AEAD_AES_256_GCM",
        ciphertext: encrypted.toString("base64"),
        associated_data: "transaction",
        nonce,
      },
    };
    const body = Buffer.from(JSON.stringify(envelope));

    return { body, headers: headers(body), envelope, resource };
  }

  beforeEach(() => {
    jest
      .mocked(readFileSync)
      .mockImplementation(((path: string) =>
        path === settings.privateKeyPath
          ? merchant.privateKey.export({ type: "pkcs8", format: "pem" })
          : platform.publicKey.export({ type: "spki", format: "pem" })) as typeof readFileSync);
    client = new WechatPayClient({ wechatPay: settings } as ConfigService);
    fetchMock = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("fails closed without configuration or any external request", async () => {
    jest.mocked(readFileSync).mockClear();
    const disabled = new WechatPayClient({ wechatPay: null } as ConfigService);

    await expect(disabled.prepay(input)).rejects.toMatchObject({ code: "PAYMENT_DISABLED" });
    await expect(disabled.query(input.orderNumber)).rejects.toMatchObject({
      code: "PAYMENT_DISABLED",
    });
    expect(() => disabled.decodeNotification(Buffer.from("{}"), new Headers())).toThrow(
      "支付暂未开放",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("signs exactly the transmitted body and independently signs miniapp payment parameters", async () => {
    fetchMock.mockResolvedValue(response({ prepay_id: "wx_prepay_123" }));
    const payment = await client.prepay(input);
    const [url, options] = fetchMock.mock.calls[0];
    const authorization = options.headers.Authorization;
    const values = Object.fromEntries(
      [...authorization.matchAll(/(\w+)="([^"]+)"/g)].map((match: RegExpMatchArray) => [
        match[1],
        match[2],
      ]),
    );

    expect(url).toBe("https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi");
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.headers["Wechatpay-Serial"]).toBe(settings.publicKeyId);
    expect(values.mchid).toBe(settings.merchantId);
    expect(values.serial_no).toBe(settings.certificateSerial);
    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(
          `POST\n/v3/pay/transactions/jsapi\n${values.timestamp}\n${values.nonce_str}\n${options.body}\n`,
        ),
        merchant.publicKey,
        Buffer.from(values.signature, "base64"),
      ),
    ).toBe(true);
    expect(JSON.parse(options.body)).toMatchObject({
      appid: settings.appId,
      mchid: settings.merchantId,
      amount: { total: 1234, currency: "CNY" },
      payer: { openid: input.openId },
    });
    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(
          `${settings.appId}\n${payment.timeStamp}\n${payment.nonceStr}\n${payment.package}\n`,
        ),
        merchant.publicKey,
        Buffer.from(payment.paySign, "base64"),
      ),
    ).toBe(true);
    expect(payment.signType).toBe("RSA");
    expect(payment).not.toHaveProperty("paid");
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER, Number.NaN])(
    "rejects invalid amount %s before network access",
    async (amountCents) => {
      await expect(client.prepay({ ...input, amountCents })).rejects.toMatchObject({
        code: "PAYMENT_INVALID_REQUEST",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null, 123, {}, []])(
    "rejects non-string identifiers %s before network access",
    async (value) => {
      const invalid = value as unknown as string;

      for (const field of ["orderNumber", "openId", "description"]) {
        // eslint-disable-next-line no-await-in-loop
        await expect(client.prepay({ ...input, [field]: invalid })).rejects.toMatchObject({
          code: "PAYMENT_INVALID_REQUEST",
        });
      }

      await expect(client.query(invalid)).rejects.toMatchObject({
        code: "PAYMENT_INVALID_REQUEST",
      });
      await expect(client.queryRefund(invalid)).rejects.toMatchObject({
        code: "PAYMENT_INVALID_REQUEST",
      });
      await expect(
        client.refund({
          orderNumber: input.orderNumber,
          refundNumber: invalid,
          totalCents: 100,
          refundCents: 100,
        }),
      ).rejects.toMatchObject({ code: "PAYMENT_INVALID_REQUEST" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("signs GET query parameters, matches merchant/order identity and never sends a GET body", async () => {
    const value = {
      mchid: settings.merchantId,
      appid: settings.appId,
      out_trade_no: input.orderNumber,
      trade_state: "NOTPAY",
    };

    fetchMock.mockResolvedValueOnce(response(value));
    expect(await client.query(input.orderNumber)).toEqual(value);
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(
      `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/order_123?mchid=${settings.merchantId}`,
    );
    expect(options).not.toHaveProperty("body");
    const values = Object.fromEntries(
      [...options.headers.Authorization.matchAll(/(\w+)="([^"]+)"/g)].map(
        (match: RegExpMatchArray) => [match[1], match[2]],
      ),
    );

    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(
          `GET\n${new URL(url).pathname}${new URL(url).search}\n${values.timestamp}\n${values.nonce_str}\n\n`,
        ),
        merchant.publicKey,
        Buffer.from(values.signature, "base64"),
      ),
    ).toBe(true);
    fetchMock.mockResolvedValueOnce(response({ ...value, mchid: "other" }));
    await expect(client.query(input.orderNumber)).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_UNAVAILABLE",
    });
    await expect(client.query("../another-path")).rejects.toMatchObject({
      code: "PAYMENT_INVALID_REQUEST",
    });
  });

  it("keeps refund acceptance distinct from completion and checks amount/order limits", async () => {
    const refund = {
      orderNumber: input.orderNumber,
      refundNumber: "refund_123",
      totalCents: 1234,
      refundCents: 234,
    };
    const result = {
      out_trade_no: input.orderNumber,
      out_refund_no: refund.refundNumber,
      status: "PROCESSING",
    };

    fetchMock.mockResolvedValueOnce(response(result));
    expect(await client.refund(refund)).toEqual(result);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      amount: { total: 1234, refund: 234, currency: "CNY" },
      out_refund_no: refund.refundNumber,
    });
    fetchMock.mockResolvedValueOnce(response({ ...result, status: "SUCCESS" }));
    expect((await client.queryRefund(refund.refundNumber)).status).toBe("SUCCESS");
    await expect(client.refund({ ...refund, refundCents: 1235 })).rejects.toMatchObject({
      code: "PAYMENT_INVALID_REQUEST",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    "tampered",
    "unknown-key",
    "stale",
    "future",
    "signature-probe",
    "missing-signature",
    "oversized",
  ])("rejects %s responses", async (scenario) => {
    const bytes = Buffer.from(JSON.stringify({ prepay_id: "wx_prepay_123" }));
    const clockOffset = { stale: -301, future: 301 }[scenario] ?? 0;
    const signedHeaders = headers(bytes, String(Math.floor(Date.now() / 1000) + clockOffset));

    if (scenario === "unknown-key") {
      signedHeaders.set("wechatpay-serial", "PUB_KEY_ID_999");
    }

    if (scenario === "signature-probe") {
      signedHeaders.set("wechatpay-signature", "WECHATPAY/SIGNTEST/invalid");
    }

    if (scenario === "missing-signature") {
      signedHeaders.delete("wechatpay-signature");
    }

    let body = bytes;

    if (scenario === "tampered") {
      body = Buffer.concat([bytes, Buffer.from(" ")]);
    }

    if (scenario === "oversized") {
      body = Buffer.alloc(1024 * 1024 + 1);
    }

    fetchMock.mockResolvedValueOnce(new Response(body, { headers: signedHeaders }));
    await expect(client.prepay(input)).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_UNAVAILABLE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry uncertain money requests or leak network/provider errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error("private credential and request body"));
    await expect(client.prepay(input)).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_UNAVAILABLE",
      clientMessage: "微信支付暂不可用，请稍后查询支付结果",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({ message: "provider internal detail" }, 500));
    await expect(client.prepay(input)).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_UNAVAILABLE",
    });
  });

  it("verifies raw bytes and decrypts notifications without treating verification as deduplication", () => {
    const valid = notification();

    expect(client.decodeNotification(valid.body, valid.headers)).toEqual({
      id: "notification_123",
      eventType: "TRANSACTION.SUCCESS",
      resource: valid.resource,
    });
    // Fresh authenticated delivery may repeat; the payment transaction must persist the event ID.
    expect(client.decodeNotification(valid.body, valid.headers).id).toBe("notification_123");
    expect(() =>
      client.decodeNotification(Buffer.concat([valid.body, Buffer.from(" ")]), valid.headers),
    ).toThrow("支付通知校验失败");
  });

  it.each(["merchant", "appid", "aad", "ciphertext", "algorithm", "event", "stale", "key-id"])(
    "rejects invalid notification %s",
    (scenario) => {
      const overrides = { merchant: { mchid: "other" }, appid: { appid: "other" } };
      const value = notification(overrides[scenario] ?? {});

      if (scenario === "aad") {
        value.envelope.resource.associated_data = "modified";
      }

      if (scenario === "ciphertext") {
        value.envelope.resource.ciphertext = Buffer.alloc(32).toString("base64");
      }

      if (scenario === "algorithm") {
        value.envelope.resource.algorithm = "UNKNOWN";
      }

      if (scenario === "event") {
        value.envelope.event_type = "UNKNOWN";
      }

      const body = Buffer.from(JSON.stringify(value.envelope));
      const signedHeaders = headers(
        body,
        String(Math.floor(Date.now() / 1000) + (scenario === "stale" ? -301 : 0)),
      );

      if (scenario === "key-id") {
        signedHeaders.set("wechatpay-serial", "PUB_KEY_ID_999");
      }

      expect(() => client.decodeNotification(body, signedHeaders)).toThrow("支付通知校验失败");
    },
  );

  it("rejects invalid key files with sanitized configuration errors", () => {
    jest.mocked(readFileSync).mockImplementation(() => {
      throw new Error("secret file location");
    });
    expect(() => new WechatPayClient({ wechatPay: settings } as ConfigService)).toThrow(
      "WECHAT_PAY key files must contain valid RSA-2048 keys",
    );
  });
});
