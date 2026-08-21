import { createReadStream, createWriteStream } from "node:fs";
import type COS from "cos-nodejs-sdk-v5";
import { ConfigService } from "../config/config.service";

export class DatabaseBackupStorage {
  constructor(
    private readonly cos: Pick<COS, "putObject" | "getObject">,
    private readonly config: ConfigService,
  ) {}

  upload(filePath: string, objectKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (): void => {
        if (!settled) {
          settled = true;
          reject(new Error("Database backup upload failed"));
        }
      };
      const succeed = (): void => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      try {
        const body = createReadStream(filePath);

        body.on("error", fail);
        this.cos.putObject(
          {
            Bucket: this.config.backupCosBucket,
            Region: this.config.backupCosRegion,
            Key: objectKey,
            Body: body,
            ServerSideEncryption: "AES256",
          },
          (error) => (error ? fail() : succeed()),
        );
      } catch {
        fail();
      }
    });
  }

  download(objectKey: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (): void => {
        if (!settled) {
          settled = true;
          reject(new Error("Database backup download failed"));
        }
      };
      const succeed = (): void => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      try {
        const output = createWriteStream(filePath, { flags: "wx", mode: 0o600 });

        output.on("error", fail);
        this.cos.getObject(
          {
            Bucket: this.config.backupCosBucket,
            Region: this.config.backupCosRegion,
            Key: objectKey,
            Output: output,
          },
          (error) => (error ? fail() : succeed()),
        );
      } catch {
        fail();
      }
    });
  }
}
