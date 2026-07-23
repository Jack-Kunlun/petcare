import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { AppLogger } from "./app-logger.service";
import { HttpLoggingMiddleware } from "./http-logging.middleware";
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
    HttpLoggingMiddleware,
    LogSanitizer,
  ],
  exports: [AppLogger, HttpLoggingMiddleware, LogSanitizer],
})
export class LoggingModule {}
