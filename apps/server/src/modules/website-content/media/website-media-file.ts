import { createHash } from "node:crypto";
import probe from "probe-image-size";
import { websiteContentInvalidMedia } from "../website-content.errors";

const MAX_BYTES = 10 * 1024 * 1024;

/** Normalized metadata derived from decoded image bytes. */
export interface ValidatedWebsiteMediaFile {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  sizeBytes: number;
  width: number;
  height: number;
  checksum: string;
}

/** Optional dimension policy override used only by focused fixtures. */
export interface WebsiteMediaValidationOptions {
  minDimension?: number;
  maxDimension?: number;
}

/** Detects image type and dimensions from bytes instead of trusting client metadata. */
export async function validateWebsiteMediaFile(
  buffer: Buffer,
  _originalName: string,
  _declaredMimeType: string,
  options: WebsiteMediaValidationOptions = {},
): Promise<ValidatedWebsiteMediaFile> {
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    throw websiteContentInvalidMedia("官网图片大小必须在 1 字节到 10 MiB 之间");
  }

  let result: probe.ProbeResult | null;

  try {
    result = probe.sync(buffer);
  } catch {
    throw websiteContentInvalidMedia("官网图片字节无法解码");
  }

  if (!result) {
    throw websiteContentInvalidMedia("官网图片字节无法解码");
  }

  const type = result.type?.toLowerCase();
  let mapped:
    | { mimeType: "image/jpeg"; extension: "jpg" }
    | { mimeType: "image/png"; extension: "png" }
    | { mimeType: "image/webp"; extension: "webp" }
    | null = null;

  if (type === "jpg" || type === "jpeg") {
    mapped = { mimeType: "image/jpeg", extension: "jpg" };
  } else if (type === "png") {
    mapped = { mimeType: "image/png", extension: "png" };
  } else if (type === "webp") {
    mapped = { mimeType: "image/webp", extension: "webp" };
  }

  if (!mapped) {
    throw websiteContentInvalidMedia("官网图片仅支持 JPEG、PNG 或 WebP");
  }

  const min = options.minDimension ?? 32;
  const max = options.maxDimension ?? 8192;

  if (result.width < min || result.height < min || result.width > max || result.height > max) {
    throw websiteContentInvalidMedia(`官网图片尺寸必须在 ${min} 到 ${max} 像素之间`);
  }

  return {
    ...mapped,
    sizeBytes: buffer.length,
    width: result.width,
    height: result.height,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  };
}
