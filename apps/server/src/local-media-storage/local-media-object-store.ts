import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

/** Coordinates for the development-only filesystem object store. */
export interface LocalMediaObjectStoreConfig {
  rootDirectory: string;
  publicBaseUrl: string;
}

/** Minimal immutable object store backed by a directory owned by the Server process. */
export class LocalMediaObjectStore {
  private readonly rootDirectory: string;
  private readonly publicBaseUrl: string;

  constructor(config: LocalMediaObjectStoreConfig) {
    this.rootDirectory = resolve(config.rootDirectory);
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/+$/u, "");
  }

  async put(storageKey: string, body: Buffer): Promise<void> {
    const objectPath = this.resolveObjectPath(storageKey);
    const temporaryPath = resolve(dirname(objectPath), `.${randomUUID()}.tmp`);

    await mkdir(dirname(objectPath), { recursive: true, mode: 0o750 });

    try {
      await writeFile(temporaryPath, body, { flag: "wx", mode: 0o640 });
      await link(temporaryPath, objectPath);
    } finally {
      await this.removeIfPresent(temporaryPath);
    }
  }

  async head(storageKey: string): Promise<void> {
    const metadata = await lstat(this.resolveObjectPath(storageKey));

    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error("Local media object is not a regular file");
    }
  }

  async delete(storageKey: string): Promise<void> {
    await this.removeIfPresent(this.resolveObjectPath(storageKey));
  }

  resolvePublicUrl(storageKey: string): string {
    this.resolveObjectPath(storageKey);
    const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");

    return `${this.publicBaseUrl}/${encodedKey}`;
  }

  private resolveObjectPath(storageKey: string): string {
    if (
      storageKey !== storageKey.trim() ||
      storageKey.startsWith("/") ||
      storageKey.includes("\\") ||
      storageKey.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error("Invalid local media storage key");
    }

    const objectPath = resolve(this.rootDirectory, storageKey);
    const relativePath = relative(this.rootDirectory, objectPath);

    if (
      !relativePath ||
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error("Local media storage key escapes its root directory");
    }

    return objectPath;
  }

  private async removeIfPresent(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      if (!this.isMissingFile(error)) {
        throw error;
      }
    }
  }

  private isMissingFile(error: unknown): error is NodeJS.ErrnoException {
    return (
      typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
    );
  }
}
