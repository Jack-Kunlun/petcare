import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { lastValueFrom, of } from "rxjs";
import { ApiResponseInterceptor } from "./api-response.interceptor";
import { ApiResponseEnvelope } from "./api-response.types";

type TestEnvelope = ApiResponseEnvelope<unknown>;

let reflector: { getAllAndOverride: jest.Mock };
let interceptor: ApiResponseInterceptor<unknown>;
const testHandler = jest.fn();

beforeEach(() => {
  reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  interceptor = new ApiResponseInterceptor(reflector as unknown as Reflector);
});

function contextWith(requestId: string, statusCode: number): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ requestId }),
      getResponse: () => ({ statusCode }),
    }),
    getHandler: () => testHandler,
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

async function runInterceptor(value: unknown, statusCode = 200): Promise<unknown> {
  return lastValueFrom(
    interceptor.intercept(contextWith("request-123", statusCode), {
      handle: () => of(value),
    }),
  );
}

describe("ApiResponseInterceptor", () => {
  it("wraps controller data", async () => {
    const result = (await runInterceptor({ id: "user-1" })) as TestEnvelope;

    expect(result).toMatchObject({
      code: "SUCCESS",
      message: "操作成功",
      data: { id: "user-1" },
      meta: { requestId: "request-123" },
    });
    expect(result.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it.each([null, undefined])("normalizes %p to null data", async (value) => {
    const result = (await runInterceptor(value)) as TestEnvelope;

    expect(result.data).toBeNull();
  });

  it("skips 204 responses", async () => {
    await expect(runInterceptor(undefined, 204)).resolves.toBeUndefined();
  });

  it("skips routes marked as raw responses", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(runInterceptor({ raw: true })).resolves.toEqual({ raw: true });
  });

  it("does not wrap an existing envelope twice", async () => {
    const envelope: TestEnvelope = {
      code: "SUCCESS",
      message: "操作成功",
      data: { id: "already-wrapped" },
      meta: { requestId: "request-original", timestamp: "2026-07-22T14:00:00.000Z" },
    };

    await expect(runInterceptor(envelope)).resolves.toBe(envelope);
  });
});
