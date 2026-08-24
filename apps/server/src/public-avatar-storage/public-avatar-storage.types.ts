/** Public-avatar storage provider token. */
export const PUBLIC_AVATAR_STORAGE = Symbol("PUBLIC_AVATAR_STORAGE");

/** Server-validated avatar data to persist in public object storage. */
export interface PublicAvatarUpload {
  /** Server-selected object namespace. */
  scope: "admin-avatars" | "user-avatars";
  /** Authenticated user identifier used in the server-owned object path. */
  userId: string;
  /** Validated image bytes. */
  body: Buffer;
  /** MIME type approved by the upload boundary. */
  contentType: "image/jpeg" | "image/png" | "image/webp";
  /** File extension paired with the approved MIME type. */
  extension: "jpg" | "png" | "webp";
}

/** Minimal public-avatar object storage boundary. */
export interface PublicAvatarStorage {
  /** Stores an avatar at a server-generated object key. */
  upload(input: PublicAvatarUpload): Promise<{ objectKey: string; publicUrl: string }>;
  /** Deletes a previously server-generated avatar object key. */
  delete(objectKey: string): Promise<void>;
}
