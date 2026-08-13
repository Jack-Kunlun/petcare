import { websiteContentStorageUnavailable } from "../website-content.errors";
import type {
  WebsiteMediaStorage,
  WebsiteMediaStorageObject,
  WebsiteMediaStorageUpload,
} from "./website-media-storage.types";

/** Fail-closed adapter used when the optional shared Tencent COS group is disabled. */
export class DisabledWebsiteMediaStorage implements WebsiteMediaStorage {
  async put(_upload: WebsiteMediaStorageUpload): Promise<WebsiteMediaStorageObject> {
    throw websiteContentStorageUnavailable();
  }

  async head(_storageKey: string): Promise<void> {
    throw websiteContentStorageUnavailable();
  }

  async delete(_storageKey: string): Promise<void> {
    return Promise.resolve();
  }

  resolvePublicUrl(_storageKey: string): string {
    throw websiteContentStorageUnavailable();
  }
}
