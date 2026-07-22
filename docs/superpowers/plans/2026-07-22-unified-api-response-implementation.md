# Unified API Response and Swagger Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce one runtime API envelope, stable error codes, request IDs, complete Swagger response schemas, safe resource projections, and transparent client-side unwrapping for every existing PetCare HTTP endpoint.

**Architecture:** NestJS controllers and services continue returning domain data. A global request-ID middleware, success interceptor, and exception filter own the HTTP envelope at the application boundary; Swagger composition decorators document the same envelope around explicit response DTOs. Admin and the shared API Client unwrap the envelope centrally so page and endpoint code keep receiving domain data.

**Tech Stack:** NestJS 11, `@nestjs/swagger` 11, RxJS 7, Prisma 7, Axios 1, Jest 30, Vitest 4, TypeScript 6, pnpm/Turborepo.

## Global Constraints

- Preserve meaningful HTTP status codes: 400, 401, 403, 404, 429, and 500 must not be converted to 200.
- JSON responses use `{ code, message, data, meta: { requestId, timestamp } }`.
- Successful responses use `code: "SUCCESS"`; errors use stable uppercase underscore codes.
- `204 No Content`, binary downloads, streams, SSE, and routes fully controlled by `@Res()` are not wrapped.
- `@Res({ passthrough: true })` authentication routes remain wrapped.
- `passwordHash`, refresh tokens, stack traces, database errors, and internal paths must never appear in public responses or Swagger schemas.
- Server and all repository clients switch in one change; no legacy response compatibility layer is added.
- Follow project formatting: double quotes, semicolons, two spaces, LF.
- Implement each behavior with a witnessed RED test before production code.

---

## File Structure

### Shared contract

- Modify `packages/shared-types/src/api/response.ts`: public envelope, metadata, pagination, and response helper types.
- Create `packages/shared-types/src/api/response.spec.ts`: contract regression tests.

### Server HTTP boundary

- Create `apps/server/src/common/http/api-response.types.ts`: runtime TypeScript envelope types and request extension.
- Create `apps/server/src/common/http/request-id.middleware.ts`: validate or generate request IDs and write the response header.
- Create `apps/server/src/common/http/request-id.middleware.spec.ts`: middleware tests.
- Create `apps/server/src/common/http/raw-response.decorator.ts`: metadata for skipping JSON wrapping.
- Create `apps/server/src/common/http/api-response.interceptor.ts`: global success wrapper.
- Create `apps/server/src/common/http/api-response.interceptor.spec.ts`: success, null, no-content, raw, and double-wrap tests.
- Create `apps/server/src/common/http/api-exception.ts`: stable business exception type.
- Create `apps/server/src/common/http/api-exception.filter.ts`: global error wrapper and sanitization.
- Create `apps/server/src/common/http/api-exception.filter.spec.ts`: status, code, validation, and unknown-error tests.
- Modify `apps/server/src/app.module.ts`: register middleware, interceptor, and filter globally.

### Swagger and resource DTOs

- Create `apps/server/src/common/swagger/api-response.dto.ts`: common meta/envelope/error Swagger classes.
- Create `apps/server/src/common/swagger/api-response.decorators.ts`: success and standard error composition decorators.
- Create `apps/server/src/auth/dto/auth-response.dto.ts`: captcha, message, admin user, and login data DTOs.
- Create `apps/server/src/health/dto/health-response.dto.ts`: health data DTO.
- Create `apps/server/src/modules/user/dto/user-response.dto.ts`: safe user and registration data DTOs.
- Create `apps/server/src/modules/order/dto/order-response.dto.ts`: order, list, owner, pet, and detail data DTOs.
- Create `apps/server/src/modules/order/dto/order-list-query.dto.ts`: validated and documented pagination query.
- Create `apps/server/src/common/swagger/swagger-responses.spec.ts`: generated OpenAPI regression test for every existing route.

### Controllers and services

- Modify `apps/server/src/auth/auth.controller.ts`: declare success/error/no-content responses.
- Modify `apps/server/src/auth/auth.service.ts`: throw stable authentication error codes.
- Modify `apps/server/src/health/health.controller.ts`: declare health response.
- Modify `apps/server/src/modules/user/user.controller.ts`: declare responses and 404 behavior.
- Modify `apps/server/src/modules/user/user.service.ts`: use safe Prisma selection.
- Create `apps/server/src/modules/user/user.service.spec.ts`: sensitive-field and not-found tests.
- Modify `apps/server/src/modules/order/order.controller.ts`: declare responses and parse pagination.
- Modify `apps/server/src/modules/order/order.service.ts`: use safe relation selections and throw 404.
- Create `apps/server/src/modules/order/order.service.spec.ts`: safe projection, list, and not-found tests.

### Clients

- Create `apps/admin/src/api/api-response.ts`: Admin envelope guard, unwrap helper, and error message reader.
- Create `apps/admin/src/api/api-response.test.ts`: Admin envelope tests.
- Modify `apps/admin/src/auth/auth.api.ts`: unwrap successful envelopes centrally and preserve refresh behavior.
- Modify `apps/admin/src/auth/AuthProvider.test.tsx`: use wrapped HTTP fixtures where the provider reaches the API layer.
- Modify `packages/api-client/src/http.ts`: central envelope unwrap and standardized client error.
- Create `packages/api-client/src/http.spec.ts`: shared client success/error tests.
- Modify `packages/api-client/src/endpoints/user.ts`: consume already-unwrapped data.
- Modify `packages/api-client/src/endpoints/order.ts`: consume already-unwrapped data.

### Documentation

- Modify `docs/06-api-specification/api-specification.md`: document the unified envelope and error-code rules.
- Modify `README.md`: add the response protocol to API development guidance.

---

### Task 1: Shared API Response Contract

**Files:**

- Modify: `packages/shared-types/src/api/response.ts`
- Create: `packages/shared-types/src/api/response.spec.ts`

**Interfaces:**

- Produces `ApiResponseMeta`, `ApiResponse<T>`, `ApiErrorResponse`, and `PaginatedResponse<T>` for all clients.
- `ApiResponse<T>` has required `data: T`, not optional data and not numeric status codes.

- [ ] **Step 1: Write the failing shared contract test**

```ts
import { describe, expect, it } from "vitest";
import { errorResponse, successResponse } from "./response";

const meta = {
  requestId: "req-contract-1",
  timestamp: "2026-07-22T14:00:00.000Z",
};

describe("API response contract", () => {
  it("creates the unified success envelope", () => {
    expect(successResponse({ id: "user-1" }, meta)).toEqual({
      code: "SUCCESS",
      message: "操作成功",
      data: { id: "user-1" },
      meta,
    });
  });

  it("creates the unified error envelope", () => {
    expect(errorResponse("AUTH_INVALID_CREDENTIALS", "账号或凭据错误", meta)).toEqual({
      code: "AUTH_INVALID_CREDENTIALS",
      message: "账号或凭据错误",
      data: null,
      meta,
    });
  });
});
```

- [ ] **Step 2: Run the test and witness RED**

Run:

```bash
pnpm --filter @petcare/shared-types exec vitest run src/api/response.spec.ts
```

Expected: FAIL because existing helpers use numeric codes and omit `meta`.

- [ ] **Step 3: Implement the minimal contract**

```ts
export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
  meta: ApiResponseMeta;
}

export type ApiErrorResponse = ApiResponse<null>;

export function successResponse<T>(
  data: T,
  meta: ApiResponseMeta,
  message = "操作成功",
): ApiResponse<T> {
  return { code: "SUCCESS", message, data, meta };
}

export function errorResponse(
  code: string,
  message: string,
  meta: ApiResponseMeta,
): ApiErrorResponse {
  return { code, message, data: null, meta };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 4: Run the focused test and package build**

```bash
pnpm --filter @petcare/shared-types exec vitest run src/api/response.spec.ts
pnpm --filter @petcare/shared-types build
```

Expected: 2 tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the shared contract**

```bash
git add packages/shared-types/src/api/response.ts packages/shared-types/src/api/response.spec.ts
git commit -m "feat: define unified api response contract"
```

---

### Task 2: Request ID and Successful Response Boundary

**Files:**

- Create: `apps/server/src/common/http/api-response.types.ts`
- Create: `apps/server/src/common/http/request-id.middleware.ts`
- Create: `apps/server/src/common/http/request-id.middleware.spec.ts`
- Create: `apps/server/src/common/http/raw-response.decorator.ts`
- Create: `apps/server/src/common/http/api-response.interceptor.ts`
- Create: `apps/server/src/common/http/api-response.interceptor.spec.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- Produces `RequestWithId`, `RawResponse`, `RAW_RESPONSE_KEY`, `ApiResponseInterceptor`, and `RequestIdMiddleware`.
- The exception filter in Task 3 consumes `RequestWithId.requestId`.

- [ ] **Step 1: Write failing request-ID middleware tests**

```ts
import { RequestIdMiddleware } from "./request-id.middleware";
import { Response } from "express";
import { RequestWithId } from "./api-response.types";

describe("RequestIdMiddleware", () => {
  it("preserves a valid incoming request id", () => {
    const request = { headers: { "x-request-id": "request-123" } } as unknown as RequestWithId;
    const response = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    new RequestIdMiddleware().use(request, response, next);

    expect((request as { requestId: string }).requestId).toBe("request-123");
    expect(response.setHeader).toHaveBeenCalledWith("X-Request-Id", "request-123");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("replaces an invalid incoming request id", () => {
    const request = { headers: { "x-request-id": "contains spaces" } } as unknown as RequestWithId;
    const response = { setHeader: jest.fn() } as unknown as Response;

    new RequestIdMiddleware().use(request, response, jest.fn());

    expect((request as { requestId: string }).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
```

- [ ] **Step 2: Write failing interceptor tests**

```ts
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { lastValueFrom, of } from "rxjs";
import { ApiResponseInterceptor } from "./api-response.interceptor";

let reflector: { getAllAndOverride: jest.Mock };
let interceptor: ApiResponseInterceptor<unknown>;

beforeEach(() => {
  reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  interceptor = new ApiResponseInterceptor(reflector as unknown as Reflector);
});

function contextWith(request: { requestId: string }, statusCode: number): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode }),
    }),
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

async function runInterceptor(value: unknown, response = { statusCode: 200 }): Promise<unknown> {
  return lastValueFrom(
    interceptor.intercept(contextWith({ requestId: "request-123" }, response.statusCode), {
      handle: () => of(value),
    }),
  );
}

it("wraps controller data", async () => {
  const result = await lastValueFrom(
    interceptor.intercept(contextWith({ requestId: "request-123" }, 200), {
      handle: () => of({ id: "user-1" }),
    }),
  );

  expect(result).toMatchObject({
    code: "SUCCESS",
    message: "操作成功",
    data: { id: "user-1" },
    meta: { requestId: "request-123" },
  });
  expect(result.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});

it.each([null, undefined])("normalizes %p to null data", async (value) => {
  const result = await runInterceptor(value);
  expect(result.data).toBeNull();
});

it("skips 204 responses", async () => {
  expect(await runInterceptor(undefined, { statusCode: 204 })).toBeUndefined();
});

it("skips routes marked as raw responses", async () => {
  reflector.getAllAndOverride.mockReturnValue(true);
  expect(await runInterceptor({ raw: true })).toEqual({ raw: true });
});
```

- [ ] **Step 3: Run focused tests and witness RED**

```bash
pnpm --filter @petcare/server test -- request-id.middleware.spec.ts api-response.interceptor.spec.ts --runInBand
```

Expected: FAIL because middleware, decorator, types, and interceptor do not exist.

- [ ] **Step 4: Implement request context and interceptor**

```ts
// api-response.types.ts
import { Request } from "express";

export interface RequestWithId extends Request {
  requestId: string;
}

export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiResponseEnvelope<T> {
  code: string;
  message: string;
  data: T;
  meta: ApiResponseMeta;
}
```

```ts
// request-id.middleware.ts
import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Response } from "express";
import { RequestWithId } from "./api-response.types";

const validRequestId = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const header = request.headers["x-request-id"];
    const incoming = Array.isArray(header) ? header[0] : header;
    request.requestId = incoming && validRequestId.test(incoming) ? incoming : randomUUID();
    response.setHeader("X-Request-Id", request.requestId);
    next();
  }
}
```

```ts
// raw-response.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const RAW_RESPONSE_KEY = "petcare:raw-response";
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
```

```ts
// api-response.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Response } from "express";
import { map, Observable } from "rxjs";
import { ApiResponseEnvelope, RequestWithId } from "./api-response.types";
import { RAW_RESPONSE_KEY } from "./raw-response.decorator";

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  T | ApiResponseEnvelope<T | null>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | ApiResponseEnvelope<T | null>> {
    const response = context.switchToHttp().getResponse<Response>();
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRaw || response.statusCode === 204) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithId>();
    return next.handle().pipe(
      map((data) => {
        if (isApiResponseEnvelope(data)) {
          return data;
        }

        return {
          code: "SUCCESS",
          message: "操作成功",
          data: data ?? null,
          meta: { requestId: request.requestId, timestamp: new Date().toISOString() },
        };
      }),
    );
  }
}

function isApiResponseEnvelope(value: unknown): value is ApiResponseEnvelope<unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApiResponseEnvelope<unknown>>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    "data" in candidate &&
    typeof candidate.meta?.requestId === "string" &&
    typeof candidate.meta.timestamp === "string"
  );
}
```

- [ ] **Step 5: Register middleware and interceptor**

```ts
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ApiResponseInterceptor } from "./common/http/api-response.interceptor";
import { RequestIdMiddleware } from "./common/http/request-id.middleware";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, HealthModule, UserModule, OrderModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
```

- [ ] **Step 6: Run focused tests, Server lint, and Server build**

```bash
pnpm --filter @petcare/server test -- request-id.middleware.spec.ts api-response.interceptor.spec.ts --runInBand
pnpm --filter @petcare/server lint
pnpm --filter @petcare/server build
```

Expected: focused tests pass; lint and build exit 0.

- [ ] **Step 7: Commit the success boundary**

```bash
git add apps/server/src/common/http apps/server/src/app.module.ts
git commit -m "feat: add unified success response boundary"
```

---

### Task 3: Stable Exceptions and Global Error Responses

**Files:**

- Create: `apps/server/src/common/http/api-exception.ts`
- Create: `apps/server/src/common/http/api-exception.filter.ts`
- Create: `apps/server/src/common/http/api-exception.filter.spec.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- Produces `ApiException(code, message, status)` and `ApiExceptionFilter`.
- Consumes `RequestWithId` from Task 2.

- [ ] **Step 1: Write failing exception filter tests**

```ts
import { ArgumentsHost, BadRequestException, NotFoundException } from "@nestjs/common";
import { ApiException } from "./api-exception";
import { ApiExceptionFilter } from "./api-exception.filter";

const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
const request = { requestId: "request-123", method: "GET", url: "/resource" };
const host = {
  switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
} as unknown as ArgumentsHost;
const filter = new ApiExceptionFilter();

beforeEach(() => jest.clearAllMocks());

it.each([
  [
    new ApiException("AUTH_INVALID_CREDENTIALS", "账号或凭据错误", 401),
    401,
    "AUTH_INVALID_CREDENTIALS",
  ],
  [new BadRequestException(["phone must be a mobile phone"]), 400, "VALIDATION_FAILED"],
  [new NotFoundException("资源不存在"), 404, "RESOURCE_NOT_FOUND"],
])("maps %p to a safe envelope", (exception, status, code) => {
  filter.catch(exception, host);
  expect(response.status).toHaveBeenCalledWith(status);
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({
      code,
      data: null,
      meta: expect.objectContaining({ requestId: "request-123" }),
    }),
  );
});

it("sanitizes unknown errors", () => {
  filter.catch(new Error("postgresql://secret@db/internal"), host);
  expect(response.status).toHaveBeenCalledWith(500);
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({
      code: "INTERNAL_SERVER_ERROR",
      message: "服务内部错误",
      data: null,
    }),
  );
});
```

- [ ] **Step 2: Run the test and witness RED**

```bash
pnpm --filter @petcare/server test -- api-exception.filter.spec.ts --runInBand
```

Expected: FAIL because the exception class and filter do not exist.

- [ ] **Step 3: Implement the business exception**

```ts
import { HttpException, HttpStatus } from "@nestjs/common";

export class ApiException extends HttpException {
  constructor(
    public readonly code: string,
    public readonly clientMessage: string,
    status: HttpStatus,
  ) {
    super({ code, message: clientMessage }, status);
  }
}
```

- [ ] **Step 4: Implement the global filter**

```ts
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const mapped = this.mapException(exception, status);

    if (status >= 500) {
      this.logger.error({
        requestId: request.requestId,
        method: request.method,
        path: request.url,
        exception,
      });
    }

    response.status(status).json({
      code: mapped.code,
      message: mapped.message,
      data: null,
      meta: { requestId: request.requestId, timestamp: new Date().toISOString() },
    });
  }

  private mapException(exception: unknown, status: number): { code: string; message: string } {
    if (exception instanceof ApiException) {
      return { code: exception.code, message: exception.clientMessage };
    }

    if (status === 400) return { code: "VALIDATION_FAILED", message: "请求参数校验失败" };
    if (status === 401) return { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" };
    if (status === 403) return { code: "FORBIDDEN", message: "无权执行此操作" };
    if (status === 404) return { code: "RESOURCE_NOT_FOUND", message: "资源不存在" };
    if (status === 429) return { code: "RATE_LIMIT_EXCEEDED", message: "请求过于频繁" };
    return { code: "INTERNAL_SERVER_ERROR", message: "服务内部错误" };
  }
}
```

- [ ] **Step 5: Register the global filter**

Add to `AppModule.providers`:

```ts
{ provide: APP_FILTER, useClass: ApiExceptionFilter },
```

- [ ] **Step 6: Run focused and existing auth tests**

```bash
pnpm --filter @petcare/server test -- api-exception.filter.spec.ts auth.service.spec.ts auth.controller.spec.ts --runInBand
```

Expected: all selected suites pass.

- [ ] **Step 7: Commit global errors**

```bash
git add apps/server/src/common/http apps/server/src/app.module.ts
git commit -m "feat: standardize api error responses"
```

---

### Task 4: Swagger Models, Route Documentation, and Safe Projections

**Files:**

- Create: `apps/server/src/common/swagger/api-response.dto.ts`
- Create: `apps/server/src/common/swagger/api-response.decorators.ts`
- Create: `apps/server/src/auth/dto/auth-response.dto.ts`
- Create: `apps/server/src/health/dto/health-response.dto.ts`
- Create: `apps/server/src/modules/user/dto/user-response.dto.ts`
- Create: `apps/server/src/modules/order/dto/order-response.dto.ts`
- Create: `apps/server/src/common/swagger/swagger-responses.spec.ts`
- Modify: `apps/server/src/auth/auth.controller.ts`
- Modify: `apps/server/src/auth/auth.service.ts`
- Modify: `apps/server/src/health/health.controller.ts`
- Modify: `apps/server/src/modules/user/user.controller.ts`
- Modify: `apps/server/src/modules/user/user.service.ts`
- Create: `apps/server/src/modules/user/user.service.spec.ts`
- Modify: `apps/server/src/modules/order/order.controller.ts`
- Create: `apps/server/src/modules/order/dto/order-list-query.dto.ts`
- Modify: `apps/server/src/modules/order/order.service.ts`
- Create: `apps/server/src/modules/order/order.service.spec.ts`

**Interfaces:**

- Produces `ApiSuccessResponse(dataModel, options)` and `ApiStandardErrors(...statuses)`.
- Produces one concrete `data` DTO for each route listed in the design spec.
- Consumes `ApiException` from Task 3 and produces safe User/Order runtime projections.

- [ ] **Step 1: Write a failing generated Swagger document test**

Create a testing module with the four real controllers and mocked constructor dependencies, generate a document with `SwaggerModule.createDocument`, then assert:

```ts
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { AuthController } from "../../auth/auth.controller";
import { AuthService } from "../../auth/auth.service";
import { CaptchaService } from "../../auth/captcha.service";
import { ConfigService } from "../../config/config.service";
import { HealthController } from "../../health/health.controller";
import { OrderController } from "../../modules/order/order.controller";
import { OrderService } from "../../modules/order/order.service";
import { UserController } from "../../modules/user/user.controller";
import { UserService } from "../../modules/user/user.service";

let app: INestApplication;
let document: OpenAPIObject;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController, HealthController, UserController, OrderController],
    providers: [
      { provide: AuthService, useValue: {} },
      { provide: CaptchaService, useValue: {} },
      { provide: ConfigService, useValue: {} },
      { provide: UserService, useValue: {} },
      { provide: OrderService, useValue: {} },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("Swagger response test").setVersion("1").build(),
  );
});

afterAll(async () => app.close());

it("documents every existing route response", () => {
  expect(
    document.paths["/auth/captcha"]?.get?.responses?.["200"].content?.["application/json"].schema,
  ).toMatchObject({ allOf: expect.any(Array) });
  expect(document.paths["/auth/logout"]?.post?.responses?.["204"]).toBeDefined();
  expect(document.paths["/health"]?.get?.responses?.["200"]).toBeDefined();
  expect(document.paths["/users/{id}"]?.get?.responses?.["404"]).toBeDefined();
  expect(document.paths["/orders"]?.get?.responses?.["200"]).toBeDefined();
});
```

- [ ] **Step 2: Run the Swagger test and witness RED**

```bash
pnpm --filter @petcare/server test -- swagger-responses.spec.ts --runInBand
```

Expected: FAIL because current controller response entries have no envelope schema.

- [ ] **Step 3: Implement common Swagger models**

```ts
export class ApiResponseMetaDto {
  @ApiProperty({ example: "request-123" })
  requestId: string;

  @ApiProperty({ format: "date-time", example: "2026-07-22T14:00:00.000Z" })
  timestamp: string;
}

export class ApiResponseEnvelopeDto {
  @ApiProperty({ example: "SUCCESS" })
  code: string;

  @ApiProperty({ example: "操作成功" })
  message: string;

  @ApiProperty({ nullable: true })
  data: unknown;

  @ApiProperty({ type: ApiResponseMetaDto })
  meta: ApiResponseMetaDto;
}

export class ApiErrorResponseDto extends ApiResponseEnvelopeDto {
  @ApiProperty({ example: "AUTH_INVALID_CREDENTIALS" })
  declare code: string;

  @ApiProperty({ nullable: true, example: null })
  declare data: null;
}
```

- [ ] **Step 4: Implement composition decorators**

```ts
export function ApiSuccessResponse(
  model: Type<unknown>,
  options: { status?: number; description?: string; isArray?: boolean } = {},
): MethodDecorator {
  const dataSchema = options.isArray
    ? { type: "array", items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(ApiResponseEnvelopeDto, ApiResponseMetaDto, model),
    ApiResponse({
      status: options.status ?? 200,
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseEnvelopeDto) },
          { properties: { data: dataSchema } },
        ],
      },
    }),
  );
}

export function ApiStandardErrors(...statuses: number[]): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto, ApiResponseMetaDto),
    ...statuses.map((status) =>
      ApiResponse({ status, type: ApiErrorResponseDto, description: errorDescription(status) }),
    ),
  );
}

const errorDescriptions: Record<number, string> = {
  400: "请求参数错误",
  401: "登录状态无效",
  403: "无权执行此操作",
  404: "资源不存在",
  429: "请求过于频繁",
  500: "服务内部错误",
};

function errorDescription(status: number): string {
  return errorDescriptions[status] ?? "请求失败";
}
```

- [ ] **Step 5: Implement concrete response DTOs**

Auth DTOs must include these exact shapes:

```ts
export class CaptchaResponseDto {
  @ApiProperty({ example: "0123456789abcdef0123456789abcdef" }) captchaId: string;
  @ApiProperty({ example: "data:image/svg+xml;base64,..." }) image: string;
  @ApiProperty({ example: 300 }) expiresIn: number;
}

export class MessageResponseDto {
  @ApiProperty({ example: "操作成功" }) message: string;
}

export class AdminUserResponseDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty({ nullable: true, example: "admin" }) username: string | null;
  @ApiProperty({ example: "17679141878" }) phone: string;
  @ApiProperty({ example: "系统管理员" }) nickname: string;
  @ApiProperty({ type: [String], example: ["super_admin"] }) roles: string[];
}

export class AdminLoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: AdminUserResponseDto }) user: AdminUserResponseDto;
}
```

Health DTO:

```ts
export class HealthResponseDto {
  @ApiProperty({ enum: ["ok"], example: "ok" }) status: "ok";
}
```

User DTOs:

```ts
export class UserResponseDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty({ example: "17679141878" }) phone: string;
  @ApiProperty({ nullable: true, example: "pet_owner_1" }) username: string | null;
  @ApiProperty({ example: "小宠家长" }) nickname: string;
  @ApiProperty({ nullable: true }) avatar: string | null;
  @ApiProperty({ example: "pet_owner" }) userType: string;
  @ApiProperty({ example: "active" }) status: string;
  @ApiProperty({ format: "date-time" }) createdAt: Date;
  @ApiProperty({ format: "date-time" }) updatedAt: Date;
}

export class UserRegisterResponseDto {
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
  @ApiProperty() token: string;
  @ApiProperty() refreshToken: string;
}
```

Order DTOs:

```ts
export class OrderResponseDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty({ example: "reward" }) orderType: string;
  @ApiProperty({ example: "feeding" }) serviceType: string;
  @ApiProperty({ format: "uuid" }) ownerId: string;
  @ApiProperty({ format: "uuid", nullable: true }) providerId: string | null;
  @ApiProperty({ format: "uuid" }) petId: string;
  @ApiProperty({ format: "date-time" }) serviceTime: Date;
  @ApiProperty() address: string;
  @ApiProperty({ example: 80 }) amount: number;
  @ApiProperty({ example: "pending_confirm" }) status: string;
  @ApiProperty({ nullable: true }) remark: string | null;
  @ApiProperty({ format: "date-time", nullable: true }) completedAt: Date | null;
  @ApiProperty({ format: "date-time" }) createdAt: Date;
  @ApiProperty({ format: "date-time" }) updatedAt: Date;
}

export class CreateOrderResponseDto {
  @ApiProperty({ type: OrderResponseDto }) order: OrderResponseDto;
}

export class OrderListResponseDto {
  @ApiProperty({ type: [OrderResponseDto] }) orders: OrderResponseDto[];
  @ApiProperty({ example: 1 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) pageSize: number;
}

export class OrderOwnerResponseDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty({ example: "17679141878" }) phone: string;
  @ApiProperty({ nullable: true }) username: string | null;
  @ApiProperty() nickname: string;
  @ApiProperty({ nullable: true }) avatar: string | null;
  @ApiProperty({ example: "pet_owner" }) userType: string;
  @ApiProperty({ example: "active" }) status: string;
}

export class OrderPetResponseDto {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty({ format: "uuid" }) ownerId: string;
  @ApiProperty() name: string;
  @ApiProperty() breed: string;
  @ApiProperty() age: number;
  @ApiProperty({ nullable: true }) weight: number | null;
  @ApiProperty({ example: "male" }) gender: string;
  @ApiProperty() sterilized: boolean;
  @ApiProperty({ nullable: true }) habits: string | null;
  @ApiProperty({ nullable: true }) allergies: string | null;
  @ApiProperty({ type: [String] }) photos: string[];
  @ApiProperty({ format: "date-time" }) createdAt: Date;
  @ApiProperty({ format: "date-time" }) updatedAt: Date;
}

export class OrderDetailResponseDto extends OrderResponseDto {
  @ApiProperty({ type: OrderOwnerResponseDto }) owner: OrderOwnerResponseDto;
  @ApiProperty({ type: OrderPetResponseDto }) pet: OrderPetResponseDto;
}
```

- [ ] **Step 6: Write failing User and Order safety tests**

User expectations:

```ts
await service.findOne("user-1");
expect(prisma.user.findUnique).toHaveBeenCalledWith({
  where: { id: "user-1" },
  select: expect.not.objectContaining({ passwordHash: true }),
});
```

Order detail expectations:

```ts
await service.findOne("order-1");
expect(prisma.order.findUnique).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { id: "order-1" },
    include: {
      owner: { select: expect.not.objectContaining({ passwordHash: true }) },
      pet: true,
    },
  }),
);
```

Both services must reject a `null` Prisma result with an `ApiException` whose code is `RESOURCE_NOT_FOUND` and status is 404.

- [ ] **Step 7: Run service and Swagger tests and witness RED**

```bash
pnpm --filter @petcare/server test -- user.service.spec.ts order.service.spec.ts swagger-responses.spec.ts --runInBand
```

Expected: FAIL because services currently return nullable models with broad projections and controllers lack response metadata.

- [ ] **Step 8: Add stable Auth exceptions**

Replace authentication exceptions with exact codes:

```ts
throw new ApiException("AUTH_INVALID_CAPTCHA", "图形验证码错误或已过期", HttpStatus.BAD_REQUEST);
throw new ApiException("AUTH_INVALID_CREDENTIALS", "账号或凭据错误", HttpStatus.UNAUTHORIZED);
```

The refresh endpoint without a cookie throws `AUTH_SESSION_EXPIRED` with status 401. Rate limiting throws `RATE_LIMIT_EXCEEDED` with status 429.

- [ ] **Step 9: Add controller response decorators**

Representative Auth route:

```ts
@Get("captcha")
@ApiOperation({ summary: "获取管理员短信登录图形验证码" })
@ApiSuccessResponse(CaptchaResponseDto)
@ApiStandardErrors(500)
getCaptcha(): CaptchaChallenge {
  return this.captchaService.create();
}
```

Representative protected route:

```ts
@Get("me")
@UseGuards(AccessTokenGuard, AdminGuard)
@ApiBearerAuth()
@ApiSuccessResponse(AdminUserResponseDto)
@ApiStandardErrors(401, 403, 500)
me(@Req() request: AuthRequest): Promise<SafeAdminUser> {
  return this.authService.getCurrentUser(requireUserId(request));
}
```

Logout uses Nest Swagger's `@ApiNoContentResponse({ description: "退出成功" })` and no JSON success decorator.

Apply explicit success and error decorators to Health, Users, and Orders according to section 4.2 of the design spec.

- [ ] **Step 10: Implement safe User projections**

```ts
const publicUserSelect = {
  id: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
  userType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
```

Use this selection in registration and lookup. `findOne` throws `RESOURCE_NOT_FOUND` when Prisma returns `null`.

- [ ] **Step 11: Implement safe Order projections**

Use a public owner selection containing only `id`, `phone`, `username`, `nickname`, `avatar`, `userType`, and `status`. Keep pet fields required by the existing detail response. Throw `RESOURCE_NOT_FOUND` for missing order details.

Create and use one query DTO so Swagger and runtime agree on pagination:

```ts
export class OrderListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
```

The controller signature is:

```ts
findAll(@Query() query: OrderListQueryDto): Promise<OrderListResponseDto> {
  return this.orderService.findAll(query.page, query.pageSize);
}
```

- [ ] **Step 12: Run service, controller, Swagger, and full Server tests**

```bash
pnpm --filter @petcare/server test -- user.service.spec.ts order.service.spec.ts swagger-responses.spec.ts auth.controller.spec.ts auth.service.spec.ts --runInBand
pnpm --filter @petcare/server test -- --runInBand
pnpm --filter @petcare/server lint
pnpm --filter @petcare/server build
```

Expected: Swagger test confirms all current routes; all Server suites pass; lint and build exit 0.

- [ ] **Step 13: Commit Swagger and resource safety**

```bash
git add apps/server/src/common/swagger apps/server/src/auth apps/server/src/health apps/server/src/modules/user apps/server/src/modules/order
git commit -m "feat: document api responses and secure projections"
```

---

### Task 5: Admin Transparent Envelope Handling

**Files:**

- Create: `apps/admin/src/api/api-response.ts`
- Create: `apps/admin/src/api/api-response.test.ts`
- Modify: `apps/admin/src/auth/auth.api.ts`
- Modify: `apps/admin/src/auth/AuthProvider.test.tsx`

**Interfaces:**

- Consumes `ApiResponse<T>` and `ApiErrorResponse` from `@petcare/shared-types`.
- Produces `unwrapApiResponse<T>(payload)` and `readApiErrorMessage(payload)`.

- [ ] **Step 1: Write failing Admin envelope tests**

```ts
describe("Admin API response helpers", () => {
  it("unwraps successful data", () => {
    expect(
      unwrapApiResponse({
        code: "SUCCESS",
        message: "操作成功",
        data: { accessToken: "token" },
        meta: { requestId: "request-1", timestamp: "2026-07-22T14:00:00.000Z" },
      }),
    ).toEqual({ accessToken: "token" });
  });

  it("rejects malformed payloads", () => {
    expect(() => unwrapApiResponse({ accessToken: "legacy-token" })).toThrow("响应格式无效");
  });

  it("reads a safe server error message", () => {
    expect(readApiErrorMessage({ code: "VALIDATION_FAILED", message: "请求参数校验失败" })).toBe(
      "请求参数校验失败",
    );
  });
});
```

- [ ] **Step 2: Run the test and witness RED**

```bash
pnpm --filter @petcare/admin exec vitest run src/api/api-response.test.ts
```

Expected: FAIL because helper module does not exist.

- [ ] **Step 3: Implement helpers and Axios success unwrapping**

```ts
export function unwrapApiResponse<T>(payload: unknown): T {
  if (!isApiResponse(payload) || payload.code !== "SUCCESS") {
    throw new Error("响应格式无效");
  }
  return payload.data as T;
}

function isApiResponse(payload: unknown): payload is ApiResponse<unknown> {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<ApiResponse<unknown>>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    "data" in candidate &&
    typeof candidate.meta?.requestId === "string" &&
    typeof candidate.meta.timestamp === "string"
  );
}

export function readApiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "请求失败";
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : "请求失败";
}

apiClient.interceptors.response.use(
  (response) => {
    if (response.status !== 204) {
      response.data = unwrapApiResponse(response.data);
    }
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const request = error.config as RetriableRequest | undefined;
    const isRefreshRequest = request?.url?.includes("/auth/refresh");

    if (error.response?.status !== 401 || !request || request._authRetried || isRefreshRequest) {
      return Promise.reject(error);
    }

    request._authRetried = true;
    refreshPromise ??= apiClient
      .post<RefreshResponse>("/auth/refresh")
      .then((response) => {
        setAccessToken(response.data.accessToken);
        return response.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });

    const token = await refreshPromise;
    request.headers.set("Authorization", `Bearer ${token}`);
    return apiClient(request);
  },
);
```

Keep all exported Auth API function return types unchanged: `LoginResponse`, `RefreshResponse`, `AdminUser`, `CaptchaChallenge`, and `void`.

- [ ] **Step 4: Update fixtures and run Admin tests**

HTTP-level fixtures include the envelope; `AuthProvider` mocks that call exported functions remain domain values. Run:

```bash
pnpm --filter @petcare/admin test -- --run
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin build
```

Expected: all Admin tests, lint, and build pass.

- [ ] **Step 5: Commit Admin adaptation**

```bash
git add apps/admin/src/api apps/admin/src/auth
git commit -m "feat: unwrap unified responses in admin"
```

---

### Task 6: Shared API Client and Miniapp Boundary

**Files:**

- Modify: `packages/api-client/src/http.ts`
- Create: `packages/api-client/src/http.spec.ts`
- Modify: `packages/api-client/src/endpoints/user.ts`
- Modify: `packages/api-client/src/endpoints/order.ts`
- Verify: `apps/miniapp/src`

**Interfaces:**

- Consumes `ApiResponse<T>` and `ApiErrorResponse` from Task 1.
- Produces `ApiClientError` with `code`, `message`, `requestId`, and optional HTTP `status`.
- Axios endpoint methods receive domain data in `response.data` after the central interceptor.

- [ ] **Step 1: Write failing shared client tests**

```ts
describe("unwrapApiResponse", () => {
  it("returns domain data", () => {
    expect(
      unwrapApiResponse<{ id: string }>({
        code: "SUCCESS",
        message: "操作成功",
        data: { id: "order-1" },
        meta: { requestId: "request-1", timestamp: "2026-07-22T14:00:00.000Z" },
      }),
    ).toEqual({ id: "order-1" });
  });

  it("creates a typed client error", () => {
    const error = toApiClientError(
      {
        code: "RESOURCE_NOT_FOUND",
        message: "资源不存在",
        data: null,
        meta: {
          requestId: "request-2",
          timestamp: "2026-07-22T14:00:00.000Z",
        },
      },
      404,
    );
    expect(error).toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      requestId: "request-2",
      status: 404,
    });
  });
});
```

- [ ] **Step 2: Run the test and witness RED**

```bash
pnpm --filter @petcare/api-client exec vitest run src/http.spec.ts
```

Expected: FAIL because typed unwrapping and `ApiClientError` do not exist.

- [ ] **Step 3: Implement central unwrapping and typed errors**

```ts
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function unwrapApiResponse<T>(payload: unknown): T {
  if (!payload || typeof payload !== "object") {
    throw new ApiClientError("INVALID_RESPONSE", "响应格式无效", "unknown");
  }

  const response = payload as Partial<ApiResponse<T>>;
  if (
    response.code !== "SUCCESS" ||
    !("data" in response) ||
    typeof response.meta?.requestId !== "string"
  ) {
    throw new ApiClientError("INVALID_RESPONSE", "响应格式无效", "unknown");
  }

  return response.data as T;
}

export function toApiClientError(payload: ApiErrorResponse, status?: number): ApiClientError {
  return new ApiClientError(payload.code, payload.message, payload.meta.requestId, status);
}

this.instance.interceptors.response.use(
  (response) => {
    if (response.status !== 204) {
      response.data = unwrapApiResponse(response.data);
    }
    return response;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.data) {
      return Promise.reject(toApiClientError(error.response.data, error.response.status));
    }
    return Promise.reject(error);
  },
);
```

Do not access browser globals until guarded with `typeof localStorage !== "undefined"` and `typeof window !== "undefined"`; this keeps the package testable in Node and reusable by Miniapp adapters.

- [ ] **Step 4: Remove endpoint-level double unwrapping**

Change endpoint calls from:

```ts
const response = await this.http.get<ApiResponse<Order>>(path);
return response.data.data!;
```

to:

```ts
const response = await this.http.get<Order>(path);
return response.data;
```

Apply the same rule to every User and Order endpoint. Void endpoints keep ignoring the response body.

- [ ] **Step 5: Verify Miniapp boundary**

Search command:

```bash
rg -n "axios|Taro\.request|PetCareAPI|ApiResponse" apps/miniapp/src
```

Expected current result: no network call sites. Do not add unused Miniapp transport code; shared API Client compatibility is the required boundary for future calls.

- [ ] **Step 6: Run package and Miniapp verification**

```bash
pnpm --filter @petcare/api-client test
pnpm --filter @petcare/api-client lint
pnpm --filter @petcare/api-client build
pnpm --filter @petcare/miniapp test -- --runInBand
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp build:weapp
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit client adaptation**

```bash
git add packages/api-client apps/miniapp
git commit -m "feat: unwrap unified responses in api client"
```

---

### Task 7: Documentation, Real Swagger Verification, and Full Regression

**Files:**

- Modify: `docs/06-api-specification/api-specification.md`
- Modify: `README.md`
- Verify: all files changed by Tasks 1-7

**Interfaces:**

- Documents the exact runtime contract delivered by earlier tasks.
- Produces final verification evidence only; no new runtime behavior.

- [ ] **Step 1: Update API documentation**

Add exact success/error JSON examples, business-code naming rules, HTTP status rules, `X-Request-Id`, 204/raw response exceptions, and client unwrapping guidance. State explicitly that `data` is `null` for errors and that public user schemas never contain `passwordHash`.

- [ ] **Step 2: Add README guidance**

Add a short “API 响应协议” section linking to the API specification and Swagger UI. Include direct local URLs using Server port 3000.

- [ ] **Step 3: Run generated Swagger verification**

```bash
pnpm --filter @petcare/server test -- swagger-responses.spec.ts --runInBand
```

Expected: every current Auth, Health, Users, and Orders route has a concrete success response; error responses and logout 204 are present.

- [ ] **Step 4: Run the complete repository gate**

```bash
pnpm --filter @petcare/server exec prisma validate
pnpm test
pnpm lint
pnpm build
pnpm exec prettier --check apps packages README.md docs/06-api-specification/api-specification.md
git diff --check
```

Expected:

- Prisma schema valid.
- Server, Admin, Miniapp, shared-types, and API Client tests pass.
- All lint and build tasks exit 0.
- Prettier and Git whitespace checks exit 0.

- [ ] **Step 5: Perform local HTTP smoke tests**

With PostgreSQL and Redis containers healthy and Server running on port 3000:

```text
GET /health
GET /auth/captcha
GET /users/<missing-uuid>
```

Verify success responses contain `code`, `message`, `data`, and `meta`; the missing resource returns HTTP 404 with `RESOURCE_NOT_FOUND`; all responses include the same `X-Request-Id` value as `meta.requestId`. Do not solve or bypass a live graphical CAPTCHA.

- [ ] **Step 6: Inspect Swagger UI**

Open `http://localhost:3000/api-docs` and verify one endpoint from each tag shows the unified envelope and concrete `data` properties. Confirm `POST /auth/logout` displays 204 without a response body.

- [ ] **Step 7: Commit documentation and verification-ready state**

```bash
git add README.md docs/06-api-specification/api-specification.md
git commit -m "docs: document unified api responses"
```

---

## Final Acceptance Checklist

- [ ] Every current JSON endpoint is wrapped exactly once.
- [ ] HTTP error status codes remain meaningful.
- [ ] `X-Request-Id` equals `meta.requestId`.
- [ ] Unknown exceptions are sanitized.
- [ ] Swagger success schemas show concrete `data` models.
- [ ] Swagger documents standard error responses and logout 204.
- [ ] User and Order responses exclude `passwordHash` and unsafe relations.
- [ ] Admin and shared API Client unwrap responses centrally.
- [ ] Miniapp has no unadapted network call site.
- [ ] Full repository tests, lint, builds, formatting, and diff checks pass.
