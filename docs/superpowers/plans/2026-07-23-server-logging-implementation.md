# Server Logging Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-ready global Server logging service with structured console output, rotating JSON files, request correlation, safe request-body logging, and exception integration.

**Architecture:** A global `LoggingModule` owns one Winston instance and exposes an `AppLogger` that implements Nest `LoggerService`. A request logger runs after the request-ID middleware, while the existing exception filter and bootstrap process use the same logger so every operational event has a consistent schema.

**Tech Stack:** NestJS 11, TypeScript 6, Winston 3.19, winston-daily-rotate-file 5.0.0, Jest 30, Docker Compose.

## Global Constraints

- Console and file logging are both enabled.
- File rotation is daily, gzip-compressed, limited to 20MB per file, and retained for 14 days.
- The application file contains all accepted levels; the error file contains only error events.
- `LOG_LEVEL` defaults to `info`; `LOG_DIR` defaults to the monorepo `logs/server` directory.
- Relative `LOG_DIR` values resolve against the monorepo root, never `process.cwd()`.
- Core credentials are always redacted from normal request logs.
- Production additionally masks phone numbers, OpenID values, email addresses, and addresses.
- Raw request data is emitted only when `NODE_ENV !== "production"` and `LOG_LEVEL === "debug"`.
- Production cannot emit raw request data even if its log level is debug.
- Request/query payload logging is capped at 8KB and must never break request processing.
- Response bodies, Authorization headers, Cookies, passwords, tokens, secrets, and verification codes are never written by normal access logs.
- Do not modify or commit local environment files.

---

### Task 1: Logging Configuration and Rotation Dependency

**Files:**

- Modify: `apps/server/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/server/src/config/config.service.ts`
- Test: `apps/server/src/config/config.service.spec.ts`

**Interfaces:**

- Produces `ConfigService.logLevel: LogLevel`.
- Produces `ConfigService.logDirectory: string` as an absolute path.
- Produces `ConfigService.logRawRequestBody: boolean`.
- Installs `winston-daily-rotate-file@5.0.0`.

- [ ] **Step 1: Write failing configuration tests**

Extend the test environment cleanup with:

```ts
delete process.env.LOG_LEVEL;
delete process.env.LOG_DIR;
delete process.env.NODE_ENV;
```

Add:

```ts
describe("logging configuration", () => {
  it("uses safe logging defaults", () => {
    const config = new ConfigService();

    expect(config.logLevel).toBe("info");
    expect(config.logDirectory.replaceAll("\\", "/")).toMatch(/\/logs\/server$/);
    expect(config.logRawRequestBody).toBe(false);
  });

  it("allows raw request bodies only for development debug logging", () => {
    process.env.NODE_ENV = "development";
    process.env.LOG_LEVEL = "debug";
    expect(new ConfigService().logRawRequestBody).toBe(true);

    process.env.NODE_ENV = "production";
    expect(new ConfigService().logRawRequestBody).toBe(false);
  });

  it("rejects an unsupported log level", () => {
    process.env.LOG_LEVEL = "trace";

    expect(() => new ConfigService().logLevel).toThrow(
      "LOG_LEVEL must be one of error, warn, info, http, verbose, debug, silly",
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/config/config.service.spec.ts
```

Expected: FAIL because the three logging getters do not exist.

- [ ] **Step 3: Install the stable rotation transport**

Run:

```powershell
pnpm --filter @petcare/server add winston-daily-rotate-file@5.0.0
```

Expected: `apps/server/package.json` and `pnpm-lock.yaml` include exact compatible version 5.0.0.

- [ ] **Step 4: Implement logging configuration**

At the top of `config.service.ts` add:

```ts
import { isAbsolute, resolve } from "node:path";

export const LOG_LEVELS = ["error", "warn", "info", "http", "verbose", "debug", "silly"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const monorepoRoot = resolve(__dirname, "../../../..");
```

Add these getters:

```ts
get logLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.trim() || "info";

  if (!LOG_LEVELS.includes(level as LogLevel)) {
    throw new Error(`LOG_LEVEL must be one of ${LOG_LEVELS.join(", ")}`);
  }

  return level as LogLevel;
}

get logDirectory(): string {
  const directory = process.env.LOG_DIR?.trim() || "logs/server";

  return isAbsolute(directory) ? directory : resolve(monorepoRoot, directory);
}

get logRawRequestBody(): boolean {
  return this.nodeEnv !== "production" && this.logLevel === "debug";
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/config/config.service.spec.ts
```

Expected: all ConfigService tests pass.

- [ ] **Step 6: Commit configuration and dependency**

```powershell
git add apps/server/package.json pnpm-lock.yaml apps/server/src/config/config.service.ts apps/server/src/config/config.service.spec.ts
git commit -m "feat: add server logging configuration"
```

### Task 2: Safe Request Payload Sanitizer

**Files:**

- Create: `apps/server/src/logging/log-sanitizer.ts`
- Test: `apps/server/src/logging/log-sanitizer.spec.ts`

**Interfaces:**

- Produces `PreparedLogValue = { value: unknown; truncated: boolean; originalLength?: number }`.
- Produces `LogSanitizer.prepare(value, options)`.
- `options.production` enables PII masking.
- `options.raw` disables key redaction but retains safe serialization and truncation.

- [ ] **Step 1: Write failing sanitizer tests**

Create `log-sanitizer.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the sanitizer test and verify RED**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/logging/log-sanitizer.spec.ts
```

Expected: FAIL because `LogSanitizer` does not exist.

- [ ] **Step 3: Implement the sanitizer**

Create `log-sanitizer.ts` with these public definitions:

```ts
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
      return value.replace(/^(\d{3})\d+(\d{4})$/, "$1****$2");
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
```

- [ ] **Step 4: Run the sanitizer test and verify GREEN**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/logging/log-sanitizer.spec.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit sanitizer**

```powershell
git add apps/server/src/logging/log-sanitizer.ts apps/server/src/logging/log-sanitizer.spec.ts
git commit -m "feat: add safe log payload sanitizer"
```

### Task 3: Winston Factory, AppLogger, and Global Module

**Files:**

- Create: `apps/server/src/logging/logging.constants.ts`
- Create: `apps/server/src/logging/winston-logger.factory.ts`
- Test: `apps/server/src/logging/winston-logger.factory.spec.ts`
- Create: `apps/server/src/logging/app-logger.service.ts`
- Test: `apps/server/src/logging/app-logger.service.spec.ts`
- Create: `apps/server/src/logging/logging.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- Produces `WINSTON_LOGGER` injection token.
- Produces `createRotationOptions(logDirectory)`.
- Produces `createWinstonLogger(configService)`.
- Produces `AppLogger.write(level, event, metadata)`.
- Produces global `LoggingModule`.

- [ ] **Step 1: Write failing factory and logger tests**

Create `winston-logger.factory.spec.ts`:

```ts
import { createRotationOptions } from "./winston-logger.factory";

describe("Winston logger factory", () => {
  it("creates the agreed application and error rotation options", () => {
    expect(createRotationOptions("D:/logs")).toEqual([
      expect.objectContaining({
        dirname: "D:/logs",
        filename: "application-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "14d",
      }),
      expect.objectContaining({
        dirname: "D:/logs",
        filename: "error-%DATE%.log",
        level: "error",
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "14d",
      }),
    ]);
  });
});
```

Create `app-logger.service.spec.ts`:

```ts
import { Logger as WinstonLogger } from "winston";
import { AppLogger } from "./app-logger.service";

describe("AppLogger", () => {
  const winstonLogger = {
    log: jest.fn(),
    close: jest.fn(),
  } as unknown as WinstonLogger;
  const logger = new AppLogger(winstonLogger);

  beforeEach(() => jest.clearAllMocks());

  it("writes structured application events", () => {
    logger.write("warn", "order.delayed", { orderId: "order-1" });

    expect(winstonLogger.log).toHaveBeenCalledWith("warn", "order.delayed", {
      event: "order.delayed",
      orderId: "order-1",
    });
  });

  it("maps Nest log calls with context", () => {
    logger.log("Starting application", "NestFactory");

    expect(winstonLogger.log).toHaveBeenCalledWith("info", "Starting application", {
      event: "nest.log",
      context: "NestFactory",
    });
  });

  it("maps Nest errors with stack and context", () => {
    logger.error("Boot failed", "stack trace", "NestFactory");

    expect(winstonLogger.log).toHaveBeenCalledWith("error", "Boot failed", {
      event: "nest.error",
      stack: "stack trace",
      context: "NestFactory",
    });
  });

  it("closes Winston during application shutdown", () => {
    logger.onApplicationShutdown();

    expect(winstonLogger.close).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run both tests and verify RED**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/logging/winston-logger.factory.spec.ts src/logging/app-logger.service.spec.ts
```

Expected: FAIL because the logger files do not exist.

- [ ] **Step 3: Implement the Winston token and factory**

Create `logging.constants.ts`:

```ts
export const WINSTON_LOGGER = Symbol("WINSTON_LOGGER");
```

Create `winston-logger.factory.ts`:

```ts
import { format, Logger, transports, createLogger } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { ConfigService } from "../config/config.service";

type RotationOptions = ConstructorParameters<typeof DailyRotateFile>[0];

export function createRotationOptions(logDirectory: string): RotationOptions[] {
  const shared: RotationOptions = {
    dirname: logDirectory,
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  };

  return [
    { ...shared, filename: "application-%DATE%.log" },
    { ...shared, filename: "error-%DATE%.log", level: "error" },
  ];
}

export function createWinstonLogger(configService: ConfigService): Logger {
  const consoleFormat =
    configService.nodeEnv === "production"
      ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
      : format.combine(
          format.timestamp(),
          format.colorize(),
          format.printf(({ timestamp, level, message, context, ...metadata }) => {
            const contextText = context ? ` [${String(context)}]` : "";
            const metadataText = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : "";
            return `${String(timestamp)} ${level}${contextText} ${String(message)}${metadataText}`;
          }),
        );

  const rotatingTransports: DailyRotateFile[] = [];

  try {
    rotatingTransports.push(
      ...createRotationOptions(configService.logDirectory).map(
        (options) => new DailyRotateFile(options),
      ),
    );
  } catch (error) {
    process.stderr.write(`Server log transport initialization error: ${String(error)}\n`);
  }

  for (const transport of rotatingTransports) {
    transport.on("error", (error) => {
      process.stderr.write(`Server log transport error: ${String(error)}\n`);
    });
  }

  return createLogger({
    level: configService.logLevel,
    defaultMeta: {
      service: "petcare-server",
      environment: configService.nodeEnv,
    },
    transports: [new transports.Console({ format: consoleFormat }), ...rotatingTransports],
    exitOnError: false,
  });
}
```

- [ ] **Step 4: Implement AppLogger**

Create `app-logger.service.ts`:

```ts
import { Inject, Injectable, LoggerService, OnApplicationShutdown } from "@nestjs/common";
import { Logger as WinstonLogger } from "winston";
import { LogLevel } from "../config/config.service";
import { WINSTON_LOGGER } from "./logging.constants";

export type LogMetadata = Record<string, unknown>;

@Injectable()
export class AppLogger implements LoggerService, OnApplicationShutdown {
  constructor(@Inject(WINSTON_LOGGER) private readonly logger: WinstonLogger) {}

  write(level: LogLevel, event: string, metadata: LogMetadata = {}): void {
    this.logger.log(level, event, { event, ...metadata });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("info", "nest.log", message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const [stack, context] = optionalParams;
    this.logger.log("error", typeof message === "string" ? message : "nest.error", {
      event: "nest.error",
      ...(typeof message === "string" ? {} : { data: message }),
      ...(typeof stack === "string" ? { stack } : {}),
      ...(typeof context === "string" ? { context } : {}),
    });
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("warn", "nest.warn", message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("debug", "nest.debug", message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("verbose", "nest.verbose", message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("error", "nest.fatal", message, optionalParams);
  }

  onApplicationShutdown(): void {
    this.logger.close();
  }

  private writeNest(
    level: LogLevel,
    event: string,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const context = optionalParams[optionalParams.length - 1];
    const metadata: LogMetadata = {
      event,
      ...(typeof context === "string" ? { context } : {}),
      ...(typeof message === "string" ? {} : { data: message }),
    };
    this.logger.log(level, typeof message === "string" ? message : event, metadata);
  }
}
```

- [ ] **Step 5: Implement and register LoggingModule**

Create `logging.module.ts`:

```ts
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { AppLogger } from "./app-logger.service";
import { LogSanitizer } from "./log-sanitizer";
import { WINSTON_LOGGER } from "./logging.constants";
import { createWinstonLogger } from "./winston-logger.factory";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: WINSTON_LOGGER,
      inject: [ConfigService],
      useFactory: createWinstonLogger,
    },
    AppLogger,
    LogSanitizer,
  ],
  exports: [AppLogger, LogSanitizer],
})
export class LoggingModule {}
```

Add `LoggingModule` to the `AppModule.imports` array.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/logging/winston-logger.factory.spec.ts src/logging/app-logger.service.spec.ts
pnpm --filter @petcare/server build
```

Expected: both tests and the Server build pass.

- [ ] **Step 7: Commit logger infrastructure**

```powershell
git add apps/server/src/logging apps/server/src/app.module.ts
git commit -m "feat: add global server logger"
```

### Task 4: HTTP Access Logs, Exception Logs, and Bootstrap Integration

**Files:**

- Create: `apps/server/src/logging/http-logging.middleware.ts`
- Test: `apps/server/src/logging/http-logging.middleware.spec.ts`
- Modify: `apps/server/src/logging/logging.module.ts`
- Modify: `apps/server/src/app.module.ts`
- Modify: `apps/server/src/common/http/api-exception.filter.ts`
- Modify: `apps/server/src/common/http/api-exception.filter.spec.ts`
- Modify: `apps/server/src/main.ts`

**Interfaces:**

- Produces `HttpLoggingMiddleware.use(request, response, next)`.
- Emits `http.request.completed` exactly once per request.
- Emits `http.request.raw` only when `ConfigService.logRawRequestBody` is true.
- Emits `http.exception` for 5xx exceptions.
- Makes `AppLogger` the Nest application logger.

- [ ] **Step 1: Write failing HTTP middleware tests**

Create `http-logging.middleware.spec.ts` with an EventEmitter-backed response and these assertions:

```ts
import { EventEmitter } from "node:events";
import { ConfigService } from "../config/config.service";
import { RequestWithId } from "../common/http/api-response.types";
import { AppLogger } from "./app-logger.service";
import { HttpLoggingMiddleware } from "./http-logging.middleware";
import { LogSanitizer } from "./log-sanitizer";

describe("HttpLoggingMiddleware", () => {
  const logger = { write: jest.fn() } as unknown as AppLogger;
  const config = {
    nodeEnv: "development",
    logRawRequestBody: false,
  } as ConfigService;
  const middleware = new HttpLoggingMiddleware(logger, config, new LogSanitizer());

  beforeEach(() => jest.clearAllMocks());

  it("logs a completed request exactly once", () => {
    const request = {
      requestId: "request-1",
      method: "POST",
      path: "/auth/login/password",
      ip: "127.0.0.1",
      headers: { "user-agent": "jest" },
      query: {},
      body: { password: "secret" },
    } as unknown as RequestWithId;
    const response = Object.assign(new EventEmitter(), { statusCode: 200 });
    const next = jest.fn();

    middleware.use(request, response as never, next);
    response.emit("finish");
    response.emit("close");

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.write).toHaveBeenCalledTimes(1);
    expect(logger.write).toHaveBeenCalledWith(
      "info",
      "http.request.completed",
      expect.objectContaining({
        requestId: "request-1",
        method: "POST",
        path: "/auth/login/password",
        statusCode: 200,
        durationMs: expect.any(Number),
        body: { value: { password: "[REDACTED]" }, truncated: false },
      }),
    );
  });

  it.each([
    [400, "warn"],
    [500, "error"],
  ])("maps status %s to %s", (statusCode, level) => {
    const request = {
      requestId: "request-2",
      method: "GET",
      path: "/resource",
      headers: {},
      query: {},
      body: {},
    } as unknown as RequestWithId;
    const response = Object.assign(new EventEmitter(), { statusCode });

    middleware.use(request, response as never, jest.fn());
    response.emit("finish");

    expect(logger.write).toHaveBeenCalledWith(
      level,
      "http.request.completed",
      expect.objectContaining({ statusCode }),
    );
  });

  it("emits raw request data only when enabled by configuration", () => {
    const rawConfig = {
      nodeEnv: "development",
      logRawRequestBody: true,
    } as ConfigService;
    const rawMiddleware = new HttpLoggingMiddleware(logger, rawConfig, new LogSanitizer());
    const request = {
      requestId: "request-3",
      method: "POST",
      path: "/debug",
      headers: {},
      query: {},
      body: { password: "visible" },
    } as unknown as RequestWithId;
    const response = Object.assign(new EventEmitter(), { statusCode: 200 });

    rawMiddleware.use(request, response as never, jest.fn());
    response.emit("finish");

    expect(logger.write).toHaveBeenCalledWith(
      "debug",
      "http.request.raw",
      expect.objectContaining({
        body: { value: { password: "visible" }, truncated: false },
      }),
    );
  });
});
```

- [ ] **Step 2: Run the middleware test and verify RED**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/logging/http-logging.middleware.spec.ts
```

Expected: FAIL because `HttpLoggingMiddleware` does not exist.

- [ ] **Step 3: Implement HttpLoggingMiddleware**

Create the middleware:

```ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Response } from "express";
import { RequestWithId } from "../common/http/api-response.types";
import { ConfigService, LogLevel } from "../config/config.service";
import { AppLogger } from "./app-logger.service";
import { LogSanitizer } from "./log-sanitizer";

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
    private readonly sanitizer: LogSanitizer,
  ) {}

  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const startedAt = performance.now();
    let logged = false;

    const logRequest = (): void => {
      if (logged) return;
      logged = true;

      const statusCode = response.statusCode;
      const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
      const production = this.configService.nodeEnv === "production";
      const common = {
        requestId: request.requestId,
        method: request.method,
        path: request.path || request.url.split("?", 1)[0],
        statusCode,
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      };

      this.logger.write(level, "http.request.completed", {
        ...common,
        query: this.sanitizer.prepare(request.query, { production }),
        body: this.sanitizer.prepare(request.body, { production }),
      });

      if (this.configService.logRawRequestBody) {
        this.logger.write("debug", "http.request.raw", {
          requestId: request.requestId,
          method: request.method,
          path: request.path || request.url.split("?", 1)[0],
          query: this.sanitizer.prepare(request.query, { production: false, raw: true }),
          body: this.sanitizer.prepare(request.body, { production: false, raw: true }),
        });
      }
    };

    response.once("finish", logRequest);
    response.once("close", logRequest);
    next();
  }
}
```

Provide/export it from `LoggingModule`, then change AppModule middleware registration to:

```ts
consumer.apply(RequestIdMiddleware, HttpLoggingMiddleware).forRoutes("*");
```

- [ ] **Step 4: Change exception-filter tests before production code**

Replace the Nest Logger spy with an injected mock:

```ts
const logger = { write: jest.fn() } as unknown as AppLogger;
const filter = new ApiExceptionFilter(logger);
```

For the unknown error test, assert:

```ts
expect(logger.write).toHaveBeenCalledWith(
  "error",
  "http.exception",
  expect.objectContaining({
    requestId: "request-123",
    method: "GET",
    path: "/resource",
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    error: expect.objectContaining({
      name: "Error",
      message: "postgresql://secret@db/internal",
      stack: expect.any(String),
    }),
  }),
);
```

Run the test and expect TypeScript/Jest failure because the filter constructor has no injected logger and still uses Nest Logger.

- [ ] **Step 5: Inject AppLogger into ApiExceptionFilter**

Remove the Nest `Logger` import and field. Add:

```ts
constructor(private readonly logger: AppLogger) {}
```

For status 500 or greater:

```ts
const error =
  exception instanceof Error
    ? { name: exception.name, message: exception.message, stack: exception.stack }
    : { value: exception };

this.logger.write("error", "http.exception", {
  requestId: request.requestId,
  method: request.method,
  path: request.url,
  statusCode: status,
  code: mapped.code,
  error,
});
```

- [ ] **Step 6: Connect AppLogger during bootstrap**

Change Nest creation and logger setup:

```ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
const appLogger = app.get(AppLogger);
app.useLogger(appLogger);
app.flushLogs();
app.enableShutdownHooks();
```

After `await app.listen(port)`, write:

```ts
appLogger.write("info", "server.started", {
  port,
  environment: configService.nodeEnv,
});
```

- [ ] **Step 7: Run integration-focused tests and Server build**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/logging/http-logging.middleware.spec.ts src/common/http/api-exception.filter.spec.ts
pnpm --filter @petcare/server build
```

Expected: middleware and filter suites pass; Nest build resolves all logger injection.

- [ ] **Step 8: Commit HTTP and bootstrap integration**

```powershell
git add apps/server/src/logging apps/server/src/common/http/api-exception.filter.ts apps/server/src/common/http/api-exception.filter.spec.ts apps/server/src/app.module.ts apps/server/src/main.ts
git commit -m "feat: integrate server request logging"
```

### Task 5: Environment, Docker, Documentation, and Final Verification

**Files:**

- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `docs/environment-variables.md`
- Modify: `docker/README.md`
- Modify: `docs/09-development-guidelines/02-development-standards.md`
- Modify: `docs/superpowers/specs/2026-07-23-server-logging-design.md`

**Interfaces:**

- Documents `LOG_LEVEL` and `LOG_DIR`.
- Configures Docker Server logs at `/app/logs`.
- Documents raw-body debug risk and file retention.
- Marks the approved design implemented.

- [ ] **Step 1: Update environment templates and Docker**

Add to `.env.example`:

```env
# ===== 日志配置 =====
# 默认 info；仅本地 development + debug 会额外记录未脱敏请求正文
LOG_LEVEL=info
# 相对路径以 monorepo 根目录为基准
LOG_DIR=./logs/server
```

Add to the Server environment in `docker-compose.yml`:

```yaml
LOG_LEVEL: ${LOG_LEVEL:-info}
LOG_DIR: /app/logs
```

Keep the existing `./logs/server:/app/logs` volume.

- [ ] **Step 2: Update documentation**

Document:

- accepted log levels and defaults;
- daily/20MB/gzip/14-day rotation;
- application and error filenames;
- always-redacted credential keys;
- production PII masking;
- the explicit local-only `LOG_LEVEL=debug` raw-body behavior;
- commands for `docker compose logs -f server` and tailing `logs/server/application-*.log`;
- the rule that services inject `AppLogger` instead of using `console.*` or creating Winston instances.

Change the design status to `已实施`.

- [ ] **Step 3: Run security and configuration scans**

Run:

```powershell
rg -n --glob "!node_modules/**" --glob "!dist/**" "console\.(log|error|warn|debug)" apps/server/src
rg -n "LOG_LEVEL|LOG_DIR|application-%DATE%|error-%DATE%|14 天|20MB" .env.example docker-compose.yml docs/environment-variables.md docker/README.md docs/09-development-guidelines/02-development-standards.md
docker compose config --quiet
```

Expected: no `console.*` calls in Server source; all logging settings are documented; Compose exits 0 without printing interpolated secrets.

- [ ] **Step 4: Run full verification**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand
pnpm --filter @petcare/server lint
pnpm --filter @petcare/server build
pnpm exec prettier --check apps/server/src/logging apps/server/src/config/config.service.ts apps/server/src/config/config.service.spec.ts apps/server/src/common/http/api-exception.filter.ts apps/server/src/common/http/api-exception.filter.spec.ts apps/server/src/app.module.ts apps/server/src/main.ts apps/server/package.json pnpm-lock.yaml .env.example docker-compose.yml docs/environment-variables.md docker/README.md docs/09-development-guidelines/02-development-standards.md docs/superpowers/specs/2026-07-23-server-logging-design.md docs/superpowers/plans/2026-07-23-server-logging-implementation.md
git diff --check
```

Expected: all commands exit 0 with zero test failures and zero lint errors.

- [ ] **Step 5: Perform a local runtime smoke test**

Run this PowerShell smoke script after the Server build:

```powershell
$smokeRoot = Join-Path ([IO.Path]::GetTempPath()) ("petcare-logging-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $smokeRoot | Out-Null
$stdoutPath = Join-Path $smokeRoot "stdout.log"
$stderrPath = Join-Path $smokeRoot "stderr.log"
$env:PORT = "3100"
$env:LOG_LEVEL = "info"
$env:LOG_DIR = $smokeRoot
$serverProcess = Start-Process -FilePath "node" -ArgumentList "--env-file-if-exists=../../.env", "dist/main.js" -WorkingDirectory "apps/server" -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru

try {
  $response = $null
  for ($attempt = 0; $attempt -lt 40 -and $null -eq $response; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri "http://localhost:3100/health" -Headers @{ "X-Request-Id" = "logging-smoke-001" }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  if ($null -eq $response) { throw "Server did not become ready" }
  $body = $response.Content | ConvertFrom-Json
  if ($response.Headers["X-Request-Id"] -ne $body.meta.requestId) { throw "Request ID mismatch" }

  $applicationLog = $null
  for ($attempt = 0; $attempt -lt 20 -and $null -eq $applicationLog; $attempt++) {
    $candidate = Get-ChildItem -LiteralPath $smokeRoot -Filter "application-*.log" | Select-Object -First 1
    if ($null -ne $candidate -and (Select-String -LiteralPath $candidate.FullName -Pattern "logging-smoke-001" -Quiet)) {
      $applicationLog = $candidate
    } else {
      Start-Sleep -Milliseconds 100
    }
  }

  if ($null -eq $applicationLog) { throw "Application request log was not created" }
  if (Select-String -LiteralPath $applicationLog.FullName -Pattern "http.request.raw" -Quiet) { throw "Raw request log must be disabled at info level" }
  if (-not (Select-String -LiteralPath $stdoutPath -Pattern "server.started" -Quiet)) { throw "Startup log missing" }
} finally {
  if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id }
}
```

Verify:

- response header and response envelope contain the same request ID;
- console includes `server.started`;
- application log contains `http.request.completed` with the request ID;
- default logs do not contain passwords, tokens, cookies, or secrets;
- no raw body event is written at the default info level.

Do not solve or bypass CAPTCHA and do not log actual local secrets.

- [ ] **Step 6: Commit documentation and deployment changes**

```powershell
git add .env.example docker-compose.yml docs/environment-variables.md docker/README.md docs/09-development-guidelines/02-development-standards.md docs/superpowers/specs/2026-07-23-server-logging-design.md
git commit -m "docs: document server logging"
```

- [ ] **Step 7: Confirm repository state**

Run:

```powershell
git status --short
git log --oneline -7
```

Expected: worktree is clean and logging design, implementation, integration, and documentation commits are present.
