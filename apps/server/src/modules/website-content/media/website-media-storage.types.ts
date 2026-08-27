/** Validated website image handed to object storage. */
export interface WebsiteMediaStorageUpload {
  body: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  area?: "website-media" | "community-media" | "pet-media";
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
