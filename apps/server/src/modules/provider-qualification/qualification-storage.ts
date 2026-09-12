import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";
import { Injectable } from "@nestjs/common";
import COS from "cos-nodejs-sdk-v5";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";

/** Private namespace in the shared COS bucket; never served by public media routes. */
export const QUALIFICATION_OBJECT_PREFIX = "private/provider-qualifications/";
/** Maximum validated material size, also enforced when reading objects. */
export const QUALIFICATION_MATERIAL_MAX_BYTES = 10 * 1024 * 1024;

/** Sanitized storage error; SDK exceptions can contain credentials and object coordinates. */
export function qualificationStorageUnavailable(): ApiException {
  return new ApiException("QUALIFICATION_STORAGE_UNAVAILABLE", "资格材料存储暂不可用", 503);
}

/** Private storage only; callers must authorize ownership or material-read permissions. */
@Injectable()
export class QualificationStorage {
  private readonly coordinates: ReturnType<QualificationStorage["readConfiguration"]>;
  private readonly cos: Pick<COS, "putObject" | "getObject" | "deleteObject"> | null;

  constructor(config: ConfigService) {
    this.coordinates = this.readConfiguration(config);
    this.cos = this.coordinates
      ? new COS({
          SecretId: this.coordinates.secretId,
          SecretKey: this.coordinates.secretKey,
          Protocol: "https:",
          Timeout: 30000,
        })
      : null;
  }

  private readConfiguration(config: ConfigService) {
    return config.qualificationStorage;
  }

  /** Allocates an opaque key before upload so failed uploads can still be cleaned up. */
  createKey(): string {
    return `${QUALIFICATION_OBJECT_PREFIX}${randomUUID()}`;
  }

  /** Writes validated material with private ACL and COS-managed encryption. */
  async put(key: string, bytes: Buffer, mimeType: string): Promise<void> {
    const params = this.objectParams(key);

    if (
      bytes.length === 0 ||
      bytes.length > QUALIFICATION_MATERIAL_MAX_BYTES ||
      !["image/jpeg", "image/png", "image/webp"].includes(mimeType)
    ) {
      throw new ApiException("QUALIFICATION_INVALID_MATERIAL", "资格材料格式或大小无效", 400);
    }

    try {
      await this.cos!.putObject({
        ...params,
        Body: bytes,
        ContentLength: bytes.length,
        ContentType: mimeType,
        ACL: "private",
        CacheControl: "no-store",
        ServerSideEncryption: "AES256",
      });
    } catch {
      throw qualificationStorageUnavailable();
    }
  }

  /** Reads into bounded memory; no object URL or SDK metadata is returned to clients. */
  async read(key: string): Promise<Buffer> {
    const params = this.objectParams(key);
    const chunks: Buffer[] = [];
    let size = 0;
    const output = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        size += chunk.length;

        if (size > QUALIFICATION_MATERIAL_MAX_BYTES) {
          callback(qualificationStorageUnavailable());

          return;
        }

        chunks.push(Buffer.from(chunk));
        callback();
      },
    });

    try {
      await Promise.all([
        finished(output),
        new Promise<void>((resolve, reject) => {
          this.cos!.getObject({ ...params, Output: output }, (error) => {
            if (error) {
              reject(qualificationStorageUnavailable());
            } else {
              resolve();
            }
          });
        }),
      ]);

      if (!size || size > QUALIFICATION_MATERIAL_MAX_BYTES) {
        throw qualificationStorageUnavailable();
      }

      return Buffer.concat(chunks);
    } catch {
      throw qualificationStorageUnavailable();
    } finally {
      output.destroy();
    }
  }

  /** Deletes only keys owned by this domain; missing objects are safe to retry. */
  async delete(key: string): Promise<void> {
    const params = this.objectParams(key);

    try {
      await this.cos!.deleteObject(params);
    } catch {
      throw qualificationStorageUnavailable();
    }
  }

  private objectParams(key: string) {
    if (
      !/^private\/provider-qualifications\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        key,
      )
    ) {
      throw new ApiException("QUALIFICATION_INVALID_MATERIAL", "资格材料标识无效", 400);
    }

    if (!this.cos || !this.coordinates) {
      throw qualificationStorageUnavailable();
    }

    return { Bucket: this.coordinates.bucket, Region: this.coordinates.region, Key: key };
  }
}
