import { randomUUID } from "node:crypto";
import { LocalMediaObjectStore } from "../../../local-media-storage/local-media-object-store";
import { websiteContentStorageUnavailable } from "../website-content.errors";
import type {
  WebsiteMediaStorage,
  WebsiteMediaStorageObject,
  WebsiteMediaStorageUpload,
} from "./website-media-storage.types";

const MANAGED_MEDIA_KEY =
  /^public\/(?:website-media|community-media|pet-media)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/u;

/** Determinism hooks for local-adapter tests. */
export interface LocalWebsiteMediaHooks {
  now?: () => Date;
  uuid?: () => string;
}

/** Filesystem-backed provider for locally managed website, community, and pet media. */
export class LocalWebsiteMediaStorage implements WebsiteMediaStorage {
  private readonly objects: LocalMediaObjectStore;

  constructor(
    rootDirectory: string,
    publicBaseUrl: string,
    private readonly hooks: LocalWebsiteMediaHooks = {},
  ) {
    this.objects = new LocalMediaObjectStore({ rootDirectory, publicBaseUrl });
  }

  async put(upload: WebsiteMediaStorageUpload): Promise<WebsiteMediaStorageObject> {
    const date = (this.hooks.now ?? (() => new Date()))();
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const id = (this.hooks.uuid ?? randomUUID)();
    const area = upload.area ?? "website-media";
    const storageKey = `public/${area}/${year}/${month}/${id}.${upload.extension}`;

    try {
      await this.objects.put(storageKey, upload.body);

      return { storageKey, publicUrl: this.objects.resolvePublicUrl(storageKey) };
    } catch {
      throw websiteContentStorageUnavailable();
    }
  }

  async head(storageKey: string): Promise<void> {
    try {
      this.assertManagedKey(storageKey);
      await this.objects.head(storageKey);
    } catch {
      throw websiteContentStorageUnavailable();
    }
  }

  async delete(storageKey: string): Promise<void> {
    try {
      this.assertManagedKey(storageKey);
      await this.objects.delete(storageKey);
    } catch {
      throw websiteContentStorageUnavailable();
    }
  }

  resolvePublicUrl(storageKey: string): string {
    try {
      this.assertManagedKey(storageKey);

      return this.objects.resolvePublicUrl(storageKey);
    } catch {
      throw websiteContentStorageUnavailable();
    }
  }

  private assertManagedKey(storageKey: string): void {
    if (!MANAGED_MEDIA_KEY.test(storageKey)) {
      throw new Error("Invalid managed media key");
    }
  }
}
