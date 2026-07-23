import { Injectable } from "@nestjs/common";

const MAX_SERIALIZED_LENGTH = 8192;
const REDACTED = "[REDACTED]";

const secretKeys = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "secret",
  "appsecret",
  "code",
  "smscode",
  "verificationcode",
  "captchaanswer",
]);

const personalKeys = new Set(["phone", "mobile", "phonenumber", "openid", "email", "address"]);

export interface PrepareLogOptions {
  production: boolean;
  raw?: boolean;
}

export interface PreparedLogValue {
  value: unknown;
  truncated: boolean;
  originalLength?: number;
}

@Injectable()
export class LogSanitizer {
  prepare(value: unknown, options: PrepareLogOptions): PreparedLogValue {
    const effectiveOptions = {
      ...options,
      raw: options.raw === true && !options.production,
    };
    const safeValue = this.clone(value, effectiveOptions, new WeakSet<object>());
    const serialized = this.safeStringify(safeValue);

    if (serialized.length <= MAX_SERIALIZED_LENGTH) {
      return { value: safeValue, truncated: false };
    }

    return {
      value: serialized.slice(0, MAX_SERIALIZED_LENGTH),
      truncated: true,
      originalLength: serialized.length,
    };
  }

  private clone(
    value: unknown,
    options: PrepareLogOptions,
    seen: WeakSet<object>,
    key = "",
  ): unknown {
    const normalizedKey = key.toLowerCase();

    if (!options.raw && secretKeys.has(normalizedKey)) {
      return REDACTED;
    }

    if (options.production && !options.raw && personalKeys.has(normalizedKey)) {
      return this.maskPersonalValue(normalizedKey, value);
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (typeof value === "symbol" || typeof value === "function") {
      return `[${typeof value}]`;
    }

    if (value === null || typeof value !== "object") {
      return value;
    }

    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => this.clone(item, options, seen));
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const result: Record<string, unknown> = {};
    const descriptors = Object.getOwnPropertyDescriptors(value);

    for (const [property, descriptor] of Object.entries(descriptors)) {
      result[property] =
        "value" in descriptor
          ? this.clone(descriptor.value, options, seen, property)
          : "[Accessor]";
    }

    return result;
  }

  private maskPersonalValue(key: string, value: unknown): unknown {
    if (typeof value !== "string") {
      return "[MASKED]";
    }

    if (key === "phone" || key === "mobile" || key === "phonenumber") {
      const match = /^(\d{3})\d+(\d{4})$/.exec(value);

      return match ? `${match[1]}****${match[2]}` : "[MASKED]";
    }

    if (key === "email") {
      const [name, domain] = value.split("@");

      return domain ? `${name.slice(0, 1)}***@${domain}` : "[MASKED]";
    }

    if (key === "openid") {
      return value.length > 8 ? `${value.slice(0, 4)}***${value.slice(-4)}` : "[MASKED]";
    }

    return value.length > 3 ? `${value.slice(0, 3)}***` : "[MASKED]";
  }

  private safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return "[Unserializable]";
    }
  }
}
