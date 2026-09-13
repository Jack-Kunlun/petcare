import {
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { Injectable } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { parseWechatTradeBill, validateBillDate, MAX_TRADE_BILL_BYTES } from "./wechat-trade-bill";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const unavailable = () =>
  new ApiException("PAYMENT_PROVIDER_UNAVAILABLE", "微信支付暂不可用，请稍后查询支付结果", 503);
const invalidInput = () => new ApiException("PAYMENT_INVALID_REQUEST", "支付参数无效", 400);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid object");
  }

  return value as Record<string, unknown>;
}

function integerCents(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2_147_483_647;
}

function orderNumber(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,32}$/.test(value);
}

/** Verified provider data is not a payment decision; callers must match persisted orders and deduplicate events. */
@Injectable()
export class WechatPayClient {
  private readonly settings: ConfigService["wechatPay"];
  private readonly privateKey: KeyObject | null = null;
  private readonly publicKey: KeyObject | null = null;

  constructor(config: ConfigService) {
    this.settings = config.wechatPay;

    if (!this.settings) {
      return;
    }

    try {
      this.privateKey = createPrivateKey(readFileSync(this.settings.privateKeyPath));
      this.publicKey = createPublicKey(readFileSync(this.settings.publicKeyPath));

      if (
        [this.privateKey, this.publicKey].some(
          (key) =>
            key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails?.modulusLength !== 2048,
        )
      ) {
        throw new Error("Invalid RSA key");
      }
    } catch {
      throw new Error("WECHAT_PAY key files must contain valid RSA-2048 keys");
    }
  }

  private requiredSettings() {
    if (!this.settings) {
      throw new ApiException("PAYMENT_DISABLED", "支付暂未开放", 503);
    }

    return this.settings;
  }

  /** Creates a prepay session from a server-owned amount; does not mark an order paid. */
  async prepay(input: {
    orderNumber: string;
    amountCents: number;
    openId: string;
    description: string;
  }) {
    const config = this.requiredSettings();

    if (
      !orderNumber(input?.orderNumber) ||
      !integerCents(input.amountCents) ||
      typeof input.openId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(input.openId) ||
      typeof input.description !== "string" ||
      !input.description.trim() ||
      Buffer.byteLength(input.description) > 127
    ) {
      throw invalidInput();
    }

    const result = await this.request("POST", "/v3/pay/transactions/jsapi", {
      appid: config.appId,
      mchid: config.merchantId,
      out_trade_no: input.orderNumber,
      description: input.description,
      notify_url: config.notifyUrl,
      amount: { total: input.amountCents, currency: "CNY" },
      payer: { openid: input.openId },
    });

    if (typeof result.prepay_id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(result.prepay_id)) {
      throw unavailable();
    }

    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = randomBytes(16).toString("hex");
    const paymentPackage = `prepay_id=${result.prepay_id}`;

    return {
      timeStamp,
      nonceStr,
      package: paymentPackage,
      signType: "RSA" as const,
      paySign: sign(
        "RSA-SHA256",
        Buffer.from(`${config.appId}\n${timeStamp}\n${nonceStr}\n${paymentPackage}\n`),
        this.privateKey!,
      ).toString("base64"),
    };
  }

  /** Queries an existing merchant number after callbacks, timeouts or uncertain submission results. */
  async query(merchantOrderNumber: string): Promise<Record<string, unknown>> {
    const config = this.requiredSettings();

    if (!orderNumber(merchantOrderNumber)) {
      throw invalidInput();
    }

    const result = await this.request(
      "GET",
      `/v3/pay/transactions/out-trade-no/${encodeURIComponent(merchantOrderNumber)}?mchid=${config.merchantId}`,
    );

    if (
      result.mchid !== config.merchantId ||
      result.appid !== config.appId ||
      result.out_trade_no !== merchantOrderNumber
    ) {
      throw unavailable();
    }

    return result;
  }

  /** Submits an already-persisted refund number; HTTP success means acceptance, not refund completion. */
  async refund(input: {
    orderNumber: string;
    refundNumber: string;
    totalCents: number;
    refundCents: number;
  }): Promise<Record<string, unknown>> {
    const config = this.requiredSettings();

    if (
      !orderNumber(input?.orderNumber) ||
      !orderNumber(input.refundNumber) ||
      !integerCents(input.totalCents) ||
      !integerCents(input.refundCents) ||
      input.refundCents > input.totalCents
    ) {
      throw invalidInput();
    }

    const result = await this.request("POST", "/v3/refund/domestic/refunds", {
      out_trade_no: input.orderNumber,
      out_refund_no: input.refundNumber,
      notify_url: config.refundNotifyUrl,
      amount: { total: input.totalCents, refund: input.refundCents, currency: "CNY" },
    });

    if (result.out_trade_no !== input.orderNumber || result.out_refund_no !== input.refundNumber) {
      throw unavailable();
    }

    return result;
  }

  /** Reads the provider's refund state without treating an earlier timeout as a failure. */
  async queryRefund(refundNumber: string): Promise<Record<string, unknown>> {
    this.requiredSettings();

    if (!orderNumber(refundNumber)) {
      throw invalidInput();
    }

    const result = await this.request(
      "GET",
      `/v3/refund/domestic/refunds/${encodeURIComponent(refundNumber)}`,
    );

    if (result.out_refund_no !== refundNumber) {
      throw unavailable();
    }

    return result;
  }

  /** Downloads and validates an ALL bill; no payment, refund or ledger state is changed. */
  async tradeBill(billDate: string) {
    const config = this.requiredSettings();

    validateBillDate(billDate);
    const metadata = await this.request(
      "GET",
      `/v3/bill/tradebill?bill_date=${billDate}&bill_type=ALL`,
    );

    try {
      if (
        metadata.hash_type !== "SHA1" ||
        typeof metadata.hash_value !== "string" ||
        !/^[a-fA-F0-9]{40}$/.test(metadata.hash_value) ||
        typeof metadata.download_url !== "string" ||
        metadata.download_url.length > 2048
      ) {
        throw new Error("Invalid bill metadata");
      }

      const url = new URL(metadata.download_url);

      // Only authenticated provider download paths may receive merchant authorization.
      if (
        url.origin !== "https://api.mch.weixin.qq.com" ||
        url.username ||
        url.password ||
        url.hash ||
        !["/v3/billdownload/file", "/v3/bill/downloadurl"].includes(url.pathname) ||
        !url.searchParams.get("token") ||
        [...url.searchParams.keys()].some((key) => key !== "token") ||
        url.searchParams.getAll("token").length !== 1
      ) {
        throw new Error("Invalid bill URL");
      }

      const { bytes, response } = await this.exchange(
        "GET",
        `${url.pathname}${url.search}`,
        "",
        MAX_TRADE_BILL_BYTES,
      );

      // File responses have no RSA signature. Their hash is anchored in the signed metadata above.
      if (
        !response.ok ||
        createHash("sha1").update(bytes).digest("hex") !== metadata.hash_value.toLowerCase()
      ) {
        throw new Error("Invalid bill download");
      }

      return {
        ...parseWechatTradeBill(bytes, billDate, config.merchantId),
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    } catch {
      throw new ApiException("PAYMENT_BILL_INVALID", "交易账单暂不可用或校验失败", 503);
    }
  }

  /** Authenticates untouched notification bytes before JSON parsing and AES-GCM decryption. No database side effects. */
  decodeNotification(
    rawBody: Buffer,
    headers: Headers,
  ): { id: string; eventType: string; resource: Record<string, unknown> } {
    const config = this.requiredSettings();

    try {
      this.verifyMessage(rawBody, headers);
      const envelope = record(JSON.parse(rawBody.toString("utf8")));
      const resource = record(envelope.resource);

      if (
        typeof envelope.id !== "string" ||
        !envelope.id ||
        envelope.id.length > 64 ||
        typeof envelope.event_type !== "string" ||
        !["TRANSACTION.SUCCESS", "REFUND.SUCCESS", "REFUND.ABNORMAL", "REFUND.CLOSED"].includes(
          envelope.event_type,
        ) ||
        envelope.resource_type !== "encrypt-resource" ||
        resource.algorithm !== "AEAD_AES_256_GCM"
      ) {
        throw new Error("Invalid envelope");
      }

      if (
        typeof resource.nonce !== "string" ||
        Buffer.byteLength(resource.nonce) !== 12 ||
        (resource.associated_data !== undefined && typeof resource.associated_data !== "string") ||
        typeof resource.ciphertext !== "string"
      ) {
        throw new Error("Invalid resource");
      }

      const encrypted = Buffer.from(resource.ciphertext, "base64");

      if (encrypted.length <= 16 || encrypted.toString("base64") !== resource.ciphertext) {
        throw new Error("Invalid ciphertext");
      }

      const decipher = createDecipheriv(
        "aes-256-gcm",
        Buffer.from(config.apiV3Key),
        Buffer.from(resource.nonce),
      );

      decipher.setAuthTag(encrypted.subarray(-16));
      decipher.setAAD(Buffer.from((resource.associated_data as string | undefined) ?? ""));
      const decoded = record(
        JSON.parse(
          Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString(
            "utf8",
          ),
        ),
      );

      if (
        decoded.mchid !== config.merchantId ||
        (envelope.event_type === "TRANSACTION.SUCCESS" && decoded.appid !== config.appId)
      ) {
        throw new Error("Merchant mismatch");
      }

      return { id: envelope.id, eventType: envelope.event_type, resource: decoded };
    } catch {
      throw new ApiException("PAYMENT_NOTIFICATION_INVALID", "支付通知校验失败", 400);
    }
  }

  private verifyMessage(body: Buffer, headers: Headers): void {
    const config = this.requiredSettings();
    const timestamp = headers.get("wechatpay-timestamp") ?? "";
    const nonce = headers.get("wechatpay-nonce") ?? "";
    const signature = headers.get("wechatpay-signature") ?? "";
    const signatureType = headers.get("wechatpay-signature-type");

    if (
      body.length > MAX_RESPONSE_BYTES ||
      headers.get("wechatpay-serial") !== config.publicKeyId ||
      (signatureType && signatureType !== "WECHATPAY2-SHA256-RSA2048") ||
      !/^\d{10,12}$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !/^[\x21-\x7e]{1,128}$/.test(nonce) ||
      !/^[A-Za-z0-9+/]{342}==$/.test(signature)
    ) {
      throw new Error("Invalid signature headers");
    }

    const message = Buffer.concat([
      Buffer.from(`${timestamp}\n${nonce}\n`),
      body,
      Buffer.from("\n"),
    ]);

    if (!verify("RSA-SHA256", message, this.publicKey!, Buffer.from(signature, "base64"))) {
      throw new Error("Invalid signature");
    }
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    input?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.requiredSettings();

    try {
      const { bytes, response } = await this.exchange(
        method,
        path,
        input ? JSON.stringify(input) : "",
        MAX_RESPONSE_BYTES,
      );

      this.verifyMessage(bytes, response.headers);

      if (!response.ok) {
        throw new Error("Provider request failed");
      }

      return record(JSON.parse(bytes.toString("utf8")));
    } catch {
      throw unavailable();
    }
  }

  private async exchange(method: "GET" | "POST", path: string, body: string, maxBytes: number) {
    const config = this.requiredSettings();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString("hex");

    try {
      const signature = sign(
        "RSA-SHA256",
        Buffer.from(`${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`),
        this.privateKey!,
      ).toString("base64");
      // Never follow redirects or auto-retry a money mutation whose outcome may be unknown.
      const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        ...(method === "POST" ? { body } : {}),
        headers: {
          Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.merchantId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.certificateSerial}"`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "Wechatpay-Serial": config.publicKeyId,
        },
      });

      if (!response.body) {
        throw new Error("Empty provider body");
      }

      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let length = 0;

      try {
        while (true) {
          // eslint-disable-next-line no-await-in-loop
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          length += value.length;

          if (length > maxBytes) {
            throw new Error("Provider response too large");
          }

          chunks.push(Buffer.from(value));
        }
      } finally {
        await reader.cancel();
      }

      return { bytes: Buffer.concat(chunks), response };
    } catch {
      throw unavailable();
    }
  }
}
