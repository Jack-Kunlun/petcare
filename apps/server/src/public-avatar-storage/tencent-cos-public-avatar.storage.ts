import { randomUUID } from "node:crypto";
import { HttpStatus } from "@nestjs/common";
import type COS from "cos-nodejs-sdk-v5";
import { ApiException } from "../common/http/api-exception";
import { ConfigService } from "../config/config.service";
import { AppLogger } from "../logging/app-logger.service";
import { PublicAvatarStorage, PublicAvatarUpload } from "./public-avatar-storage.types";

/** Tencent COS implementation for server-owned public avatar objects. */
export class TencentCosPublicAvatarStorage implements PublicAvatarStorage {
  constructor(
    private readonly cos: Pick<COS, "putObject" | "deleteObject">,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  async upload(input: PublicAvatarUpload): Promise<{ objectKey: string; publicUrl: string }> {
    const objectKey = `public/${input.scope}/${input.userId}/${randomUUID()}.${input.extension}`;

    try {
      await new Promise<void>((resolve, reject) => {
        this.cos.putObject(
          {
            Bucket: this.configService.tencentCosBucket,
            Region: this.configService.tencentCosRegion,
            Key: objectKey,
            Body: input.body,
            ContentType: input.contentType,
          },
          (error) => (error ? reject(error) : resolve()),
        );
      });
    } catch (error) {
      this.logFailure("public_avatar_storage.upload_failed", error);
      throw this.storageUnavailable();
    }

    return { objectKey, publicUrl: this.publicUrlFor(objectKey) };
  }

  async delete(objectKey: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.cos.deleteObject(
          {
            Bucket: this.configService.tencentCosBucket,
            Region: this.configService.tencentCosRegion,
            Key: objectKey,
          },
          (error) => (error ? reject(error) : resolve()),
        );
      });
    } catch (error) {
      this.logFailure("public_avatar_storage.delete_failed", error);
      throw this.storageUnavailable();
    }
  }

  private publicUrlFor(objectKey: string): string {
    const configuredBaseUrl = this.configService.tencentCosPublicBaseUrl;
    const baseUrl =
      configuredBaseUrl ||
      `https://${this.configService.tencentCosBucket}.cos.${this.configService.tencentCosRegion}.myqcloud.com`;

    return `${baseUrl.replace(/\/+$/, "")}/${objectKey}`;
  }

  private logFailure(event: string, error: unknown): void {
    const cosRequestId =
      error && typeof error === "object" && "RequestId" in error
        ? (error.RequestId as unknown)
        : undefined;

    this.logger.write("error", event, {
      ...(typeof cosRequestId === "string" ? { cosRequestId } : {}),
    });
  }

  private storageUnavailable(): ApiException {
    return new ApiException(
      "STORAGE_UNAVAILABLE",
      "头像存储服务暂时不可用，请稍后重试",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
