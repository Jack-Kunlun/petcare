import { publicAvatarStorageUnavailable } from "./public-avatar-storage.errors";
import { PublicAvatarStorage, PublicAvatarUpload } from "./public-avatar-storage.types";

/** Fails closed when no public-avatar storage provider is configured. */
export class DisabledPublicAvatarStorage implements PublicAvatarStorage {
  async upload(_input: PublicAvatarUpload): Promise<{ objectKey: string; publicUrl: string }> {
    throw publicAvatarStorageUnavailable();
  }

  delete(_objectKey: string): Promise<void> {
    return Promise.resolve();
  }
}
