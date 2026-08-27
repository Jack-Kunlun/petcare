import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalWebsiteMediaStorage } from "./local-website-media.storage";

describe("LocalWebsiteMediaStorage", () => {
  let rootDirectory: string;
  let storage: LocalWebsiteMediaStorage;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), "petcare-website-media-"));
    storage = new LocalWebsiteMediaStorage(rootDirectory, "http://localhost:8080/media", {
      now: () => new Date("2026-08-27T00:00:00Z"),
      uuid: () => "00000000-0000-4000-8000-000000000000",
    });
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it.each(["website-media", "community-media", "pet-media"] as const)(
    "persists and removes validated %s bytes through the shared local provider",
    async (area) => {
      const result = await storage.put({
        area,
        body: Buffer.from(`${area}-png`),
        mimeType: "image/png",
        extension: "png",
      });

      expect(result).toEqual({
        storageKey: `public/${area}/2026/08/00000000-0000-4000-8000-000000000000.png`,
        publicUrl: `http://localhost:8080/media/public/${area}/2026/08/00000000-0000-4000-8000-000000000000.png`,
      });
      await expect(storage.head(result.storageKey)).resolves.toBeUndefined();
      await expect(readFile(join(rootDirectory, result.storageKey), "utf8")).resolves.toBe(
        `${area}-png`,
      );
      expect(storage.resolvePublicUrl(result.storageKey)).toBe(result.publicUrl);
      await expect(storage.delete(result.storageKey)).resolves.toBeUndefined();
      await expect(storage.delete(result.storageKey)).resolves.toBeUndefined();
    },
  );

  it("maps missing and unmanaged keys to the stable storage error", async () => {
    await expect(storage.head("public/pet-media/2026/08/missing.png")).rejects.toMatchObject({
      code: "WEBSITE_CONTENT_STORAGE_UNAVAILABLE",
      status: 503,
    });
    expect(() => storage.resolvePublicUrl("../outside.png")).toThrow(
      expect.objectContaining({ code: "WEBSITE_CONTENT_STORAGE_UNAVAILABLE", status: 503 }),
    );
  });
});
