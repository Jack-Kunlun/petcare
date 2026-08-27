import { randomUUID } from "node:crypto";
import type COS from "cos-nodejs-sdk-v5";
import { ConfigService } from "../config/config.service";
import { AppLogger } from "../logging/app-logger.service";
import { publicAvatarStorageUnavailable } from "./public-avatar-storage.errors";
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
      throw publicAvatarStorageUnavailable();
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
      throw publicAvatarStorageUnavailable();
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
}
