import { LogSanitizer } from "./log-sanitizer";

describe("LogSanitizer", () => {
  const sanitizer = new LogSanitizer();

  it("recursively redacts core credentials", () => {
    const result = sanitizer.prepare(
      {
        phone: "17679141878",
        nested: {
          password: "secret",
          accessToken: "token",
          captchaAnswer: "1234",
        },
      },
      { production: false },
    );

    expect(result).toEqual({
      value: {
        phone: "17679141878",
        nested: {
          password: "[REDACTED]",
          accessToken: "[REDACTED]",
          captchaAnswer: "[REDACTED]",
        },
      },
      truncated: false,
    });
  });

  it("masks production personal information", () => {
    const result = sanitizer.prepare(
      {
        phone: "17679141878",
        openId: "o1234567890abcdef",
        email: "admin@example.com",
        address: "江西省南昌市红谷滩区",
      },
      { production: true },
    );

    expect(result.value).toEqual({
      phone: "176****1878",
      openId: "o123***cdef",
      email: "a***@example.com",
      address: "江西省***",
    });
  });

  it("supports circular objects without throwing", () => {
    const value: Record<string, unknown> = { name: "root" };

    value.self = value;

    expect(sanitizer.prepare(value, { production: false }).value).toEqual({
      name: "root",
      self: "[Circular]",
    });
  });

  it("converts JSON-unsafe primitive values", () => {
    expect(sanitizer.prepare({ id: 1n }, { production: false }).value).toEqual({
      id: "1",
    });
  });

  it("truncates serialized payloads after 8KB", () => {
    const result = sanitizer.prepare({ text: "x".repeat(9000) }, { production: false });

    expect(result.truncated).toBe(true);
    expect(result.originalLength).toBeGreaterThan(8192);
    expect(typeof result.value).toBe("string");
    expect((result.value as string).length).toBe(8192);
  });

  it("allows raw values without credential redaction", () => {
    const result = sanitizer.prepare(
      { password: "visible-for-local-debug" },
      { production: false, raw: true },
    );

    expect(result.value).toEqual({ password: "visible-for-local-debug" });
  });

  it("refuses raw values in production as defense in depth", () => {
    const result = sanitizer.prepare(
      { password: "must-not-leak" },
      { production: true, raw: true },
    );

    expect(result.value).toEqual({ password: "[REDACTED]" });
  });
});
