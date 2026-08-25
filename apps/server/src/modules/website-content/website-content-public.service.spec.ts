import {
  WEBSITE_CONTENT_KEY,
  WEBSITE_CONTENT_STATUS,
  type WebsiteContentKey,
  type WebsiteContentVersion,
} from "@petcare/shared-types";
import { WEBSITE_CONTENT_SEED_TEMPLATES } from "../../seed/seed-website-content";
import { WebsiteContentPublicService } from "./website-content-public.service";

function publishedVersion(
  contentKey: WebsiteContentKey = WEBSITE_CONTENT_KEY.HOME,
): WebsiteContentVersion {
  const template = WEBSITE_CONTENT_SEED_TEMPLATES.find(
    (candidate) => candidate.contentKey === contentKey,
  )!;

  return {
    id: `published-${contentKey}-1`,
    contentKey,
    revision: 2,
    businessVersion: 1,
    status: WEBSITE_CONTENT_STATUS.PUBLISHED,
    changeSummary: "Publish home",
    seo: structuredClone(template.seo),
    sections: structuredClone(template.sections),
    sourceVersionId: "draft-home-1",
    createdBy: { id: "admin-1", displayName: "Admin" },
    createdAt: "2026-08-13T00:00:00.000Z",
    publishedBy: { id: "admin-1", displayName: "Admin" },
    publishedAt: "2026-08-13T00:01:00.000Z",
  };
}

function createPublicService(version: WebsiteContentVersion) {
  const repository = {
    getPublishedPointer: jest.fn(async () => ({
      contentId: `content-${version.contentKey}`,
      publishedVersionId: version.id,
    })),
    getPublishedVersion: jest.fn(async () => version),
  };
  const cache = { get: jest.fn(async () => null), set: jest.fn(async () => false) };
  const media = { resolvePublicAssets: jest.fn(async () => new Map()) };
  const service = new WebsiteContentPublicService(
    repository as never,
    cache as never,
    media as never,
  );

  return { service, repository, cache };
}

describe("WebsiteContentPublicService", () => {
  it("returns enabled Help categories from the published pointer only", async () => {
    const version = publishedVersion(WEBSITE_CONTENT_KEY.HELP);

    version.sections[0].isEnabled = false;

    const { service } = createPublicService(version);

    const result = await service.getPublished(WEBSITE_CONTENT_KEY.HELP);

    expect(result.contentKey).toBe("help");
    expect(result.sections).toHaveLength(3);
    expect(result.sections.every((section) => section.sectionType === "rich_text")).toBe(true);
  });

  it("reads the public pointer, falls back to PostgreSQL, and best-effort fills Redis", async () => {
    const version = publishedVersion();
    const { service, repository, cache } = createPublicService(version);

    const result = await service.getPublished(WEBSITE_CONTENT_KEY.HOME);

    expect(repository.getPublishedVersion).toHaveBeenCalledWith(
      WEBSITE_CONTENT_KEY.HOME,
      version.id,
    );
    expect(cache.set).toHaveBeenCalledWith(version.id, result);
    expect(result).toMatchObject({
      contentKey: WEBSITE_CONTENT_KEY.HOME,
      businessVersion: 1,
      publishedAt: "2026-08-13T00:01:00.000Z",
    });
    expect(result.sections).toHaveLength(
      version.sections.filter((section) => section.isEnabled).length,
    );
    expect(JSON.stringify(result)).not.toContain("admin-1");
    expect(JSON.stringify(result)).not.toContain("draft-home-1");
  });

  it("uses a valid immutable cache hit without querying the version row", async () => {
    const version = publishedVersion();
    const cached = {
      contentKey: WEBSITE_CONTENT_KEY.HOME,
      businessVersion: 1,
      publishedAt: "2026-08-13T00:01:00.000Z",
      seo: { ...version.seo, image: null },
      sections: [],
    };
    const repository = {
      getPublishedPointer: jest.fn(async () => ({
        contentId: "content-home",
        publishedVersionId: version.id,
      })),
      getPublishedVersion: jest.fn(),
    };
    const cache = { get: jest.fn(async () => cached), set: jest.fn() };
    const media = { resolvePublicAssets: jest.fn(async () => new Map()) };
    const service = new WebsiteContentPublicService(
      repository as never,
      cache as never,
      media as never,
    );

    await expect(service.getPublished(WEBSITE_CONTENT_KEY.HOME)).resolves.toEqual(cached);
    expect(repository.getPublishedVersion).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("falls back to PostgreSQL when Redis read failures escape the cache adapter", async () => {
    const version = publishedVersion();
    const repository = {
      getPublishedPointer: jest.fn(async () => ({
        contentId: "content-home",
        publishedVersionId: version.id,
      })),
      getPublishedVersion: jest.fn(async () => version),
    };
    const cache = {
      get: jest.fn(async () => {
        throw new Error("redis unavailable");
      }),
      set: jest.fn(async () => {
        throw new Error("redis unavailable");
      }),
    };
    const media = { resolvePublicAssets: jest.fn(async () => new Map()) };
    const service = new WebsiteContentPublicService(
      repository as never,
      cache as never,
      media as never,
    );

    await expect(service.getPublished(WEBSITE_CONTENT_KEY.HOME)).resolves.toMatchObject({
      contentKey: WEBSITE_CONTENT_KEY.HOME,
    });
  });

  it("resolves managed images for published and preview snapshots", async () => {
    const version = publishedVersion();
    const hero = version.sections.find((section) => section.sectionType === "hero");

    if (!hero || hero.sectionType !== "hero") {
      throw new Error("Home hero is required for this test");
    }

    hero.content.image.assetId = "asset-1";

    const repository = {
      getPublishedPointer: jest.fn(async () => ({
        contentId: "content-home",
        publishedVersionId: version.id,
      })),
      getPublishedVersion: jest.fn(async () => version),
    };
    const cache = { get: jest.fn(async () => null), set: jest.fn(async () => true) };
    const asset = {
      id: "asset-1",
      url: "https://cdn.example.com/asset-1.webp",
      width: 1200,
      height: 800,
      mimeType: "image/webp" as const,
    };
    const media = {
      resolvePublicAssets: jest.fn(async () => new Map([[asset.id, asset]])),
    };
    const service = new WebsiteContentPublicService(
      repository as never,
      cache as never,
      media as never,
    );

    const published = await service.getPublished(WEBSITE_CONTENT_KEY.HOME);
    const preview = await service.getPreview(version);
    const publishedHero = published.sections.find((section) => section.sectionType === "hero");
    const previewHero = preview.sections.find((section) => section.sectionType === "hero");

    expect(publishedHero?.content.image.asset).toEqual(asset);
    expect(previewHero?.content.image.asset).toEqual(asset);
    expect(media.resolvePublicAssets).toHaveBeenCalledWith(["asset-1"]);
  });
});
