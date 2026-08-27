import { randomUUID } from "node:crypto";
import { LocalMediaObjectStore } from "../local-media-storage/local-media-object-store";
import { AppLogger } from "../logging/app-logger.service";
import { publicAvatarStorageUnavailable } from "./public-avatar-storage.errors";
import { PublicAvatarStorage, PublicAvatarUpload } from "./public-avatar-storage.types";

const MANAGED_AVATAR_KEY =
  /^public\/(?:admin-avatars|user-avatars)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/u;
const SAFE_USER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;

/** Filesystem-backed provider for locally managed public avatars. */
export class LocalPublicAvatarStorage implements PublicAvatarStorage {
  private readonly objects: LocalMediaObjectStore;

  constructor(
    rootDirectory: string,
    publicBaseUrl: string,
    private readonly logger: AppLogger,
    private readonly uuid: () => string = randomUUID,
  ) {
    this.objects = new LocalMediaObjectStore({ rootDirectory, publicBaseUrl });
  }

  async upload(input: PublicAvatarUpload): Promise<{ objectKey: string; publicUrl: string }> {
    try {
      if (!SAFE_USER_ID.test(input.userId)) {
        throw new Error("Invalid avatar owner identifier");
      }

      const objectKey = `public/${input.scope}/${input.userId}/${this.uuid()}.${input.extension}`;

      await this.objects.put(objectKey, input.body);

      return { objectKey, publicUrl: this.objects.resolvePublicUrl(objectKey) };
    } catch {
      this.logger.write("error", "public_avatar_storage.upload_failed");
      throw publicAvatarStorageUnavailable();
    }
  }

  async delete(objectKey: string): Promise<void> {
    try {
      if (!MANAGED_AVATAR_KEY.test(objectKey)) {
        throw new Error("Invalid managed avatar key");
      }

      await this.objects.delete(objectKey);
    } catch {
      this.logger.write("error", "public_avatar_storage.delete_failed");
      throw publicAvatarStorageUnavailable();
    }
  }
}
