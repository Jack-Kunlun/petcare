import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";
import { PublicAvatarStorage, PublicAvatarUpload } from "./public-avatar-storage.types";

/** Fails closed when no public-avatar storage provider is configured. */
export class DisabledPublicAvatarStorage implements PublicAvatarStorage {
  async upload(_input: PublicAvatarUpload): Promise<{ objectKey: string; publicUrl: string }> {
    throw new ApiException(
      "STORAGE_UNAVAILABLE",
      "头像存储服务暂时不可用，请稍后重试",
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  delete(_objectKey: string): Promise<void> {
    return Promise.resolve();
  }
}
