import { Module } from "@nestjs/common";
import COS from "cos-nodejs-sdk-v5";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { AppLogger } from "../logging/app-logger.service";
import { LoggingModule } from "../logging/logging.module";
import { DisabledPublicAvatarStorage } from "./disabled-public-avatar.storage";
import { PUBLIC_AVATAR_STORAGE } from "./public-avatar-storage.types";
import { TencentCosPublicAvatarStorage } from "./tencent-cos-public-avatar.storage";

/** Selects configured Tencent COS or a fail-closed public-avatar storage adapter. */
@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [
    {
      provide: PUBLIC_AVATAR_STORAGE,
      inject: [ConfigService, AppLogger],
      useFactory: (configService: ConfigService, logger: AppLogger) => {
        if (!configService.tencentCosEnabled) {
          return new DisabledPublicAvatarStorage();
        }

        return new TencentCosPublicAvatarStorage(
          new COS({
            SecretId: configService.tencentCosSecretId,
            SecretKey: configService.tencentCosSecretKey,
          }),
          configService,
          logger,
        );
      },
    },
  ],
  exports: [PUBLIC_AVATAR_STORAGE],
})
export class PublicAvatarStorageModule {}
