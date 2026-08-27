import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppLogger } from "../logging/app-logger.service";
import { LocalPublicAvatarStorage } from "./local-public-avatar.storage";

describe("LocalPublicAvatarStorage", () => {
  let rootDirectory: string;
  let logger: { write: jest.Mock };
  let storage: LocalPublicAvatarStorage;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), "petcare-local-avatar-"));
    logger = { write: jest.fn() };
    storage = new LocalPublicAvatarStorage(
      rootDirectory,
      "http://localhost:8080/media",
      logger as unknown as AppLogger,
      () => "00000000-0000-4000-8000-000000000000",
    );
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it.each(["admin-avatars", "user-avatars"] as const)(
    "stores and deletes a validated %s image",
    async (scope) => {
      const result = await storage.upload({
        scope,
        userId: "user-1",
        body: Buffer.from("avatar-png"),
        contentType: "image/png",
        extension: "png",
      });

      expect(result).toEqual({
        objectKey: `public/${scope}/user-1/00000000-0000-4000-8000-000000000000.png`,
        publicUrl: `http://localhost:8080/media/public/${scope}/user-1/00000000-0000-4000-8000-000000000000.png`,
      });
      await expect(readFile(join(rootDirectory, result.objectKey), "utf8")).resolves.toBe(
        "avatar-png",
      );
      await expect(storage.delete(result.objectKey)).resolves.toBeUndefined();
      await expect(storage.delete(result.objectKey)).resolves.toBeUndefined();
      expect(logger.write).not.toHaveBeenCalled();
    },
  );

  it("rejects unsafe owner and object keys without logging local paths", async () => {
    await expect(
      storage.upload({
        scope: "user-avatars",
        userId: "../owner",
        body: Buffer.from("avatar-png"),
        contentType: "image/png",
        extension: "png",
      }),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE", status: 503 });
    await expect(storage.delete("../outside.png")).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      status: 503,
    });
    expect(logger.write).toHaveBeenNthCalledWith(1, "error", "public_avatar_storage.upload_failed");
    expect(logger.write).toHaveBeenNthCalledWith(2, "error", "public_avatar_storage.delete_failed");
  });
});
