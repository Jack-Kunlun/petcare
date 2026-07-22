import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { Response } from "express";
import { ApiException } from "./api-exception";
import { RequestWithId } from "./api-response.types";

interface MappedException {
  code: string;
  message: string;
}

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
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private mapException(exception: unknown, status: number): MappedException {
    if (exception instanceof ApiException) {
      return { code: exception.code, message: exception.clientMessage };
    }

    if (status === 400) {
      return { code: "VALIDATION_FAILED", message: "请求参数校验失败" };
    }

    if (status === 401) {
      return { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" };
    }

    if (status === 403) {
      return { code: "FORBIDDEN", message: "无权执行此操作" };
    }

    if (status === 404) {
      return { code: "RESOURCE_NOT_FOUND", message: "资源不存在" };
    }

    if (status === 429) {
      return { code: "RATE_LIMIT_EXCEEDED", message: "请求过于频繁" };
    }

    return { code: "INTERNAL_SERVER_ERROR", message: "服务内部错误" };
  }
}
