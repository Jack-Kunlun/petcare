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
          meta: {
            requestId: request.requestId,
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}

function isApiResponseEnvelope(value: unknown): value is ApiResponseEnvelope<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ApiResponseEnvelope<unknown>>;

  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    "data" in candidate &&
    typeof candidate.meta?.requestId === "string" &&
    typeof candidate.meta.timestamp === "string"
  );
}
