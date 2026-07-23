import { EventEmitter } from "node:events";
import { RequestWithId } from "../common/http/api-response.types";
import { ConfigService } from "../config/config.service";
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
