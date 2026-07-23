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
