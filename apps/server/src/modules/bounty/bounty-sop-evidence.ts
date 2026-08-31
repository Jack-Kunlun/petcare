import { HttpStatus } from "@nestjs/common";
import {
  BOUNTY_ERROR_CODE,
  BOUNTY_SOP_EVIDENCE_KIND,
  BOUNTY_SOP_LIMITS,
  type BountySopEvidenceKind,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { validateWebsiteMediaFile } from "../website-content/media/website-media-file";

/** Raw multipart evidence fields accepted after presence validation. */
export interface BountySopEvidenceFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

/** Byte-validated evidence safe to hand to managed object storage. */
export interface ValidatedBountySopEvidence {
  body: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  extension: "jpg" | "png" | "webp" | "mp4";
  kind: BountySopEvidenceKind;
}

/** Validates SOP photo or MP4 bytes without trusting the client filename. */
export async function validateBountySopEvidence(
  file: BountySopEvidenceFile,
  kind: BountySopEvidenceKind,
): Promise<ValidatedBountySopEvidence> {
  if (kind === BOUNTY_SOP_EVIDENCE_KIND.PHOTO) {
    const image = await validateWebsiteMediaFile(file.buffer, file.originalName, file.mimeType, {
      subject: "履约照片",
      errorFactory: bountySopEvidenceInvalid,
    });

    return {
      body: file.buffer,
      mimeType: image.mimeType,
      extension: image.extension,
      kind,
    };
  }

  if (
    kind !== BOUNTY_SOP_EVIDENCE_KIND.VIDEO ||
    file.buffer.length === 0 ||
    file.buffer.length > BOUNTY_SOP_LIMITS.VIDEO_MAX_BYTES ||
    file.buffer.length < 12 ||
    file.buffer.subarray(4, 8).toString("ascii") !== "ftyp"
  ) {
    throw bountySopEvidenceInvalid("履约视频必须是 1 字节到 50 MiB 的 MP4 文件");
  }

  return {
    body: file.buffer,
    mimeType: "video/mp4",
    extension: "mp4",
    kind,
  };
}

/** Builds the stable validation error shared by multipart presence and byte checks. */
export function bountySopEvidenceInvalid(message: string): ApiException {
  return new ApiException(BOUNTY_ERROR_CODE.SOP_EVIDENCE_INVALID, message, HttpStatus.BAD_REQUEST);
}
