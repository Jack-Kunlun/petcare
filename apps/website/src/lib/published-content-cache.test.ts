import type { WebsitePublicContent } from "@petcare/shared-types";
import { describe, expect, it } from "vitest";
import { PublishedContentUnavailableError, PublishedContentCache } from "./published-content-cache";

const snapshot = {
  contentKey: "home",
  businessVersion: 1,
  publishedAt: "2026-08-13T00:00:00.000Z",
  seo: {
    title: "Home",
    description: "Home description",
    canonicalPath: "/",
    image: null,
  },
  sections: [],
} satisfies WebsitePublicContent;

describe("PublishedContentCache", () => {
  it("returns a recent successful published snapshot for its fixed key", () => {
    const cache = new PublishedContentCache({ ttlMilliseconds: 300_000, now: () => 1_000 });

    cache.store(snapshot);

    expect(cache.read("home")).toEqual(snapshot);
  });

  it("rejects a snapshot that is older than the five-minute fallback window", () => {
    let now = 1_000;
    const cache = new PublishedContentCache({ ttlMilliseconds: 300_000, now: () => now });

    cache.store(snapshot);
    now += 300_001;

    expect(() => cache.read("home")).toThrow(PublishedContentUnavailableError);
  });

  it("does not invent a published fallback when no successful response exists", () => {
    const cache = new PublishedContentCache({ ttlMilliseconds: 300_000, now: () => 1_000 });

    expect(() => cache.read("site_shell")).toThrow(PublishedContentUnavailableError);
  });

  it("strictly refuses preview snapshots so drafts cannot become a public fallback", () => {
    const cache = new PublishedContentCache({ ttlMilliseconds: 300_000, now: () => 1_000 });

    expect(() =>
      cache.store({ contentKey: "home", revision: 2, seo: {}, sections: [] } as unknown as WebsitePublicContent),
    ).toThrow("published snapshot");
    expect(() => cache.read("home")).toThrow(PublishedContentUnavailableError);
  });
});
