import { randomUUID } from "node:crypto";
import { websiteContentStorageUnavailable } from "../website-content.errors";
import type {
  WebsiteMediaStorage,
  WebsiteMediaStorageObject,
  WebsiteMediaStorageUpload,
} from "./website-media-storage.types";

interface CosCallbackError {
  RequestId?: string;
}
type CosCallback = (error: CosCallbackError | null, data?: unknown) => void;
interface CosClient {
  putObject(params: Record<string, unknown>, callback: CosCallback): void;
  headObject(params: Record<string, unknown>, callback: CosCallback): void;
  deleteObject(params: Record<string, unknown>, callback: CosCallback): void;
}

/** Shared Tencent COS coordinates without credentials. */
export interface TencentCosWebsiteMediaConfig {
  bucket: string;
  region: string;
  publicBaseUrl: string;
}

/** Determinism hooks for tests; production uses UTC time and random UUIDs. */
export interface TencentCosWebsiteMediaHooks {
  now?: () => Date;
  uuid?: () => string;
}

/** Tencent COS adapter for managed website media objects. */
export class TencentCosWebsiteMediaStorage implements WebsiteMediaStorage {
  constructor(
    private readonly cos: CosClient,
    private readonly config: TencentCosWebsiteMediaConfig,
    private readonly hooks: TencentCosWebsiteMediaHooks = {},
  ) {}

  async put(upload: WebsiteMediaStorageUpload): Promise<WebsiteMediaStorageObject> {
    const date = (this.hooks.now ?? (() => new Date()))();
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const id = (this.hooks.uuid ?? randomUUID)();
    const storageKey = `public/website-media/${year}/${month}/${id}.${upload.extension}`;

    await this.call("putObject", {
      Bucket: this.config.bucket,
      Region: this.config.region,
      Key: storageKey,
      Body: upload.body,
      ContentType: upload.mimeType,
    });

    return { storageKey, publicUrl: this.resolvePublicUrl(storageKey) };
  }

  async head(storageKey: string): Promise<void> {
    await this.call("headObject", this.objectParams(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await this.call("deleteObject", this.objectParams(storageKey));
  }

  resolvePublicUrl(storageKey: string): string {
    const base =
      this.config.publicBaseUrl.trim() ||
      `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com`;

    return `${base.replace(/\/+$/u, "")}/${storageKey}`;
  }

  private objectParams(storageKey: string): Record<string, unknown> {
    return { Bucket: this.config.bucket, Region: this.config.region, Key: storageKey };
  }

  private call(method: keyof CosClient, params: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cos[method](params, (error) => {
        if (error) {
          reject(websiteContentStorageUnavailable());
        } else {
          resolve();
        }
      });
    });
  }
}
