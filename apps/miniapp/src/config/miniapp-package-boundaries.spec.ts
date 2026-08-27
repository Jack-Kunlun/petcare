import { readdirSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(import.meta.dirname, "..");
const mainPackageRoots = ["api", "components", "config", "domain", "pages", "resolver", "state"];
const sourceExtensions = new Set([".ts", ".tsx", ".vue"]);
const subpackageImport = /(?:from\s+|import\(\s*)["']@\/pages-(?:account|bounty|care|content)\//u;

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return productionSources(path);
    }

    return sourceExtensions.has(extname(entry.name)) && !entry.name.includes(".spec.")
      ? [path]
      : [];
  });
}

describe("miniapp package boundaries", () => {
  it("keeps main-package production modules independent from subpackages", () => {
    const invalidSources = mainPackageRoots
      .flatMap((directory) => productionSources(resolve(sourceRoot, directory)))
      .filter((path) => subpackageImport.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(sourceRoot.length + 1));

    expect(invalidSources).toEqual([]);
  });
});
