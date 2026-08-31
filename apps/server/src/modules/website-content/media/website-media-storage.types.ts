/** Validated public media handed to the shared object storage adapter. */
export interface WebsiteMediaStorageUpload {
  body: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  extension: "jpg" | "png" | "webp" | "mp4";
  area?: "website-media" | "community-media" | "pet-media" | "sop-media";
}

/** Result of a managed object upload. */
export interface WebsiteMediaStorageObject {
  storageKey: string;
  publicUrl: string;
}

/** Narrow provider-independent website media object store. */
export interface WebsiteMediaStorage {
  put(upload: WebsiteMediaStorageUpload): Promise<WebsiteMediaStorageObject>;
  head(storageKey: string): Promise<void>;
  delete(storageKey: string): Promise<void>;
  resolvePublicUrl(storageKey: string): string;
}
