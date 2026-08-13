import type { WebsitePublicContent } from "@petcare/shared-types";
import { describe, expect, it, vi } from "vitest";
import {
  loadPublishedPageContent,
  loadPreviewPageContent,
  type WebsiteContentReader,
} from "./load-page-content";
import { PublishedContentCache } from "./published-content-cache";

const shell = {
  contentKey: "site_shell",
  businessVersion: 1,
  publishedAt: "2026-08-13T00:00:00.000Z",
  seo: {
    title: "PetCare",
    description: "PetCare shell",
    canonicalPath: "/",
    image: null,
  },
  sections: [],
} satisfies WebsitePublicContent;

const page = {
  contentKey: "home",
  businessVersion: 2,
  publishedAt: "2026-08-13T00:00:00.000Z",
  seo: {
    title: "Home",
    description: "Home page",
    canonicalPath: "/",
    image: null,
  },
  sections: [],
} satisfies WebsitePublicContent;

function reader(overrides: Partial<WebsiteContentReader> = {}): WebsiteContentReader {
  return {
    getPublished: vi.fn(async (contentKey) => (contentKey === "site_shell" ? shell : page)),
    getPreview: vi.fn(),
    ...overrides,
  };
}

describe("loadPublishedPageContent", () => {
  it("loads the shared shell and fixed page content in parallel and remembers successes", async () => {
    const api = reader();
    const cache = new PublishedContentCache({ ttlMilliseconds: 300_000, now: () => 1_000 });

    await expect(loadPublishedPageContent({ api, cache, contentKey: "home" })).resolves.toEqual({
      shell,
      page,
    });
    expect(api.getPublished).toHaveBeenCalledWith("site_shell");
    expect(api.getPublished).toHaveBeenCalledWith("home");
    expect(cache.read("site_shell")).toEqual(shell);
    expect(cache.read("home")).toEqual(page);
  });

  it("uses the last successful page snapshot when only the page API read fails", async () => {
    const cache = new PublishedContentCache({ ttlMilliseconds: 300_000, now: () => 1_000 });

    cache.store(page);
    const api = reader({
      getPublished: vi.fn(async (contentKey) => {
        if (contentKey === "home") {
          throw new Error("upstream unavailable");
        }

        return shell;
      }),
    });

    await expect(loadPublishedPageContent({ api, cache, contentKey: "home" })).resolves.toEqual({
      shell,
      page,
    });
  });

  it("uses the code-level minimum shell only when no shell fallback exists", async () => {
    const api = reader({
      getPublished: vi.fn(async (contentKey) => {
        if (contentKey === "site_shell") {
          throw new Error("upstream unavailable");
        }

        return page;
      }),
    });
    const cache = new PublishedContentCache({ ttlMilliseconds: 300_000, now: () => 1_000 });
    const fallbackShell = { contentKey: "site_shell" as const, sections: [] };

    await expect(
      loadPublishedPageContent({ api, cache, contentKey: "home", fallbackShell }),
    ).resolves.toEqual({ shell: fallbackShell, page });
  });

  it("reads only the capability-scoped page and does not use a public last-success cache", async () => {
    const api = reader({
      getPreview: vi.fn(async () => ({
        contentKey: "home" as const,
        revision: 2,
        seo: page.seo,
        sections: [],
      })),
    });
    const cache = new PublishedContentCache({ ttlMilliseconds: 300_000, now: () => 1_000 });

    await expect(
      loadPreviewPageContent({ api, contentKey: "home", token: "preview-token" }),
    ).resolves.toEqual({
      page: { contentKey: "home", revision: 2, seo: page.seo, sections: [] },
    });
    expect(api.getPreview).toHaveBeenCalledTimes(1);
    expect(api.getPreview).toHaveBeenCalledWith("home", "preview-token");
    expect(() => cache.read("home")).toThrow();
  });
});
