import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import type { RequestWithId } from "../common/http/api-response.types";
import { ConfigService, type LogLevel } from "../config/config.service";
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
      if (logged) {
        return;
      }

      logged = true;

      const statusCode = response.statusCode;
      let level: LogLevel = "info";

      if (statusCode >= 500) {
        level = "error";
      } else if (statusCode >= 400) {
        level = "warn";
      }

      const production = this.configService.nodeEnv === "production";
      const path = request.path || request.url.split("?", 1)[0];
      const common = {
        requestId: request.requestId,
        method: request.method,
        path,
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
          path,
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
