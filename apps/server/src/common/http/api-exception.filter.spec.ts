import { ArgumentsHost, BadRequestException, NotFoundException } from "@nestjs/common";
import { AppLogger } from "../../logging/app-logger.service";
import { ApiException } from "./api-exception";
import { ApiExceptionFilter } from "./api-exception.filter";

const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
const request = { requestId: "request-123", method: "GET", url: "/resource" };
const host = {
  switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
} as unknown as ArgumentsHost;
const logger = { write: jest.fn() } as unknown as AppLogger;
const filter = new ApiExceptionFilter(logger);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ApiExceptionFilter", () => {
  it.each([
    [
      new ApiException("AUTH_INVALID_CREDENTIALS", "账号或凭据错误", 401),
      401,
      "AUTH_INVALID_CREDENTIALS",
      "账号或凭据错误",
    ],
    [
      new BadRequestException(["phone must be a mobile phone"]),
      400,
      "VALIDATION_FAILED",
      "请求参数校验失败",
    ],
    [new NotFoundException("missing"), 404, "RESOURCE_NOT_FOUND", "资源不存在"],
  ])("maps an HTTP exception to a safe envelope", (exception, status, code, message) => {
    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({
      code,
      message,
      data: null,
      meta: {
        requestId: "request-123",
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    });
  });

  it("sanitizes and logs unknown errors", () => {
    filter.catch(new Error("postgresql://secret@db/internal"), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      code: "INTERNAL_SERVER_ERROR",
      message: "服务内部错误",
      data: null,
      meta: {
        requestId: "request-123",
        timestamp: expect.any(String),
      },
    });
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
    expect(JSON.stringify(response.json.mock.calls)).not.toContain("postgresql://");
  });
});
