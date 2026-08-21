import { createReadStream, createWriteStream } from "node:fs";
import { PassThrough } from "node:stream";
import { ConfigService } from "../config/config.service";
import { formatDatabaseBackupCliError } from "./database-backup-cli";
import { DatabaseBackupStorage } from "./database-backup-storage";

jest.mock("node:fs", () => ({
  ...jest.requireActual("node:fs"),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
}));

describe("DatabaseBackupStorage", () => {
  const config = {
    backupCosBucket: "petcare-backup-1250000000",
    backupCosRegion: "ap-guangzhou",
  } as ConfigService;
  const cos = { putObject: jest.fn(), getObject: jest.fn() };
  const storage = new DatabaseBackupStorage(cos as never, config);
  let readStream: PassThrough;
  let writeStream: PassThrough;

  beforeEach(() => {
    jest.clearAllMocks();
    readStream = new PassThrough();
    writeStream = new PassThrough();
    jest.mocked(createReadStream).mockReturnValue(readStream as never);
    jest.mocked(createWriteStream).mockReturnValue(writeStream as never);
    cos.putObject.mockImplementation((_params, callback) => callback(null, {}));
    cos.getObject.mockImplementation((_params, callback) => callback(null, {}));
  });

  it("uploads a private encrypted dump", async () => {
    await storage.upload(
      "/backup/database.dump",
      "postgresql/2026/08/petcare-20260820T010203Z.dump",
    );

    expect(createReadStream).toHaveBeenCalledWith("/backup/database.dump");
    expect(cos.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "petcare-backup-1250000000",
        Region: "ap-guangzhou",
        Key: "postgresql/2026/08/petcare-20260820T010203Z.dump",
        Body: readStream,
        ServerSideEncryption: "AES256",
      }),
      expect.any(Function),
    );
  });

  it("does not expose COS upload callback details", async () => {
    const fakeCredential = "AKID-fake-backup-credential";
    const filePath = "/backup/tenant-a/database.dump";
    const objectKey = "postgresql/tenant-a/private.dump";

    cos.putObject.mockImplementation((_params, callback) =>
      callback(new Error(`${fakeCredential} ${filePath} ${objectKey}`)),
    );

    const error = await storage.upload(filePath, objectKey).catch((failure: unknown) => failure);

    expect(error).toEqual(new Error("Database backup upload failed"));
    const message = error instanceof Error ? error.message : String(error);

    expect(message).not.toContain(fakeCredential);
    expect(message).not.toContain(filePath);
    expect(message).not.toContain(objectKey);
  });

  it.each(["createReadStream", "putObject"])(
    "does not expose synchronous upload %s details",
    async (source) => {
      const fakeCredential = "AKID-fake-upload-sync-credential";
      const filePath = "/backup/tenant-sync/database.dump";
      const objectKey = "postgresql/tenant-sync/private.dump";
      const error = new Error(`${fakeCredential} ${filePath} ${objectKey}`);

      if (source === "createReadStream") {
        jest.mocked(createReadStream).mockImplementation(() => {
          throw error;
        });
      } else {
        cos.putObject.mockImplementation(() => {
          throw error;
        });
      }

      await expect(storage.upload(filePath, objectKey)).rejects.toEqual(
        new Error("Database backup upload failed"),
      );
    },
  );

  it("maps read stream errors once without exposing upload details", async () => {
    const fakeCredential = "AKID-fake-upload-stream-credential";
    const filePath = "/backup/tenant-stream/database.dump";
    const objectKey = "postgresql/tenant-stream/private.dump";

    cos.putObject.mockImplementation(() => undefined);

    const operation = storage.upload(filePath, objectKey);
    const callback = cos.putObject.mock.calls[0][1] as (error: Error | null) => void;

    readStream.emit("error", new Error(`${fakeCredential} ${filePath} ${objectKey}`));
    callback(null);

    await expect(operation).rejects.toEqual(new Error("Database backup upload failed"));
  });

  it("downloads only the explicitly selected object", async () => {
    await storage.download(
      "postgresql/2026/08/petcare-20260820T010203Z.dump",
      "/restore/database.dump",
    );

    expect(createWriteStream).toHaveBeenCalledWith("/restore/database.dump", {
      flags: "wx",
      mode: 0o600,
    });
    expect(cos.getObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "petcare-backup-1250000000",
        Region: "ap-guangzhou",
        Key: "postgresql/2026/08/petcare-20260820T010203Z.dump",
        Output: writeStream,
      }),
      expect.any(Function),
    );
  });

  it("does not expose COS download callback details", async () => {
    const fakeCredential = "AKID-fake-restore-credential";
    const objectKey = "postgresql/tenant-b/private.dump";
    const filePath = "/restore/tenant-b/database.dump";

    cos.getObject.mockImplementation((_params, callback) =>
      callback(new Error(`${fakeCredential} ${objectKey} ${filePath}`)),
    );

    const error = await storage.download(objectKey, filePath).catch((failure: unknown) => failure);

    expect(error).toEqual(new Error("Database backup download failed"));
    const message = error instanceof Error ? error.message : String(error);

    expect(message).not.toContain(fakeCredential);
    expect(message).not.toContain(objectKey);
    expect(message).not.toContain(filePath);
  });

  it.each(["createWriteStream", "getObject"])(
    "does not expose synchronous download %s details",
    async (source) => {
      const fakeCredential = "AKID-fake-download-sync-credential";
      const objectKey = "postgresql/tenant-sync/private.dump";
      const filePath = "/restore/tenant-sync/database.dump";
      const error = new Error(`${fakeCredential} ${objectKey} ${filePath}`);

      if (source === "createWriteStream") {
        jest.mocked(createWriteStream).mockImplementation(() => {
          throw error;
        });
      } else {
        cos.getObject.mockImplementation(() => {
          throw error;
        });
      }

      await expect(storage.download(objectKey, filePath)).rejects.toEqual(
        new Error("Database backup download failed"),
      );
    },
  );

  it("rejects an existing restore target without exposing stream details", async () => {
    const fakeCredential = "AKID-fake-download-stream-credential";
    const objectKey = "postgresql/tenant-existing/private.dump";
    const filePath = "/restore/tenant-existing/database.dump";

    cos.getObject.mockImplementation(() => undefined);

    const operation = storage.download(objectKey, filePath);
    const callback = cos.getObject.mock.calls[0][1] as (error: Error | null) => void;
    const existingFileError = Object.assign(
      new Error(`${fakeCredential} ${objectKey} ${filePath}`),
      { code: "EEXIST" },
    );

    writeStream.emit("error", existingFileError);
    callback(null);

    await expect(operation).rejects.toEqual(new Error("Database backup download failed"));
  });
});

describe("database backup CLI", () => {
  it("does not echo unknown error details", () => {
    expect(
      formatDatabaseBackupCliError(
        new Error("AKID-fake-cli-credential /backup/private.dump postgresql/private.dump"),
      ),
    ).toBe("Database backup operation failed");
  });
});
