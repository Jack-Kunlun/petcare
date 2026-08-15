import { HttpStatus } from "@nestjs/common";
import { ADMIN_ACCOUNT_ERROR_CODE } from "@petcare/shared-types";
import { ApiException } from "../common/http/api-exception";

/** Server-validated avatar data safe to pass to object storage. */
export interface DetectedAvatarFile {
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
}

/** Detects an approved avatar format from its bytes and verifies the declared MIME type. */
export function detectAvatarFile(buffer: Buffer, declaredMime: string): DetectedAvatarFile {
  const detected = detectFormat(buffer);

  if (detected && declaredMime === detected.contentType) {
    return { body: buffer, ...detected };
  }

  throw new ApiException(
    ADMIN_ACCOUNT_ERROR_CODE.AVATAR_INVALID_TYPE,
    "头像文件格式无效，仅支持 JPEG、PNG 或 WebP",
    HttpStatus.BAD_REQUEST,
  );
}

function detectFormat(buffer: Buffer): Omit<DetectedAvatarFile, "body"> | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { contentType: "image/png", extension: "png" };
  }

  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    buffer.subarray(0, 4).equals(Buffer.from("RIFF", "ascii")) &&
    buffer.subarray(8, 12).equals(Buffer.from("WEBP", "ascii"))
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}
