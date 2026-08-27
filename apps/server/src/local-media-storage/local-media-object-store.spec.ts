import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalMediaObjectStore } from "./local-media-object-store";

describe("LocalMediaObjectStore", () => {
  let rootDirectory: string;
  let store: LocalMediaObjectStore;

  beforeEach(async () => {
    rootDirectory = await mkdtemp(join(tmpdir(), "petcare-local-media-"));
    store = new LocalMediaObjectStore({
      rootDirectory,
      publicBaseUrl: "http://localhost:8080/media/",
    });
  });

  afterEach(async () => {
    await rm(rootDirectory, { recursive: true, force: true });
  });

  it("stores immutable bytes, exposes their public URL, and deletes idempotently", async () => {
    const storageKey = "public/pet-media/2026/08/photo.png";

    await store.put(storageKey, Buffer.from("pet-photo"));

    await expect(store.head(storageKey)).resolves.toBeUndefined();
    await expect(readFile(join(rootDirectory, storageKey), "utf8")).resolves.toBe("pet-photo");
    expect(store.resolvePublicUrl(storageKey)).toBe(
      "http://localhost:8080/media/public/pet-media/2026/08/photo.png",
    );
    await expect(store.put(storageKey, Buffer.from("replacement"))).rejects.toMatchObject({
      code: "EEXIST",
    });
    await expect(readFile(join(rootDirectory, storageKey), "utf8")).resolves.toBe("pet-photo");

    await expect(store.delete(storageKey)).resolves.toBeUndefined();
    await expect(store.delete(storageKey)).resolves.toBeUndefined();
    await expect(store.head(storageKey)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["../outside.png", "public/../outside.png", "/absolute.png", "public\\bad.png"])(
    "rejects a key outside the managed root: %s",
    async (storageKey) => {
      await expect(store.put(storageKey, Buffer.from("unsafe"))).rejects.toThrow(
        /Invalid local media storage key|escapes its root directory/u,
      );
      expect(() => store.resolvePublicUrl(storageKey)).toThrow(
        /Invalid local media storage key|escapes its root directory/u,
      );
    },
  );
});
