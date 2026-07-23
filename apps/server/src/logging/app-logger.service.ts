import { Inject, Injectable, type LoggerService, type OnApplicationShutdown } from "@nestjs/common";
import type { Logger as WinstonLogger } from "winston";
import type { LogLevel } from "../config/config.service";
import { WINSTON_LOGGER } from "./logging.constants";

@Injectable()
export class AppLogger implements LoggerService, OnApplicationShutdown {
  constructor(@Inject(WINSTON_LOGGER) private readonly logger: WinstonLogger) {}

  write(level: LogLevel, event: string, metadata: Record<string, unknown> = {}): void {
    this.logger.log(level, event, { event, ...metadata });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("info", "nest.log", message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const stack = optionalParams[0];
    const context = optionalParams[1];

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

    this.logger.log(level, typeof message === "string" ? message : event, {
      event,
      ...(typeof message === "string" ? {} : { data: message }),
      ...(typeof context === "string" ? { context } : {}),
    });
  }
}
