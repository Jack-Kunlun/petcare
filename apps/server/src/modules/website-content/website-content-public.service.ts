import { Injectable } from "@nestjs/common";
import {
  WEBSITE_CONTENT_STATUS,
  type WebsiteContentKey,
  type WebsiteContentVersion,
  type WebsitePublicContent,
  type WebsitePublicContentSection,
  type WebsitePublicMediaAsset,
} from "@petcare/shared-types";
import { WebsiteContentCacheService } from "./website-content-cache.service";
import { websiteContentNotFound } from "./website-content.errors";
import { WebsiteContentRepository } from "./website-content.repository";
import { WebsiteMediaService } from "./website-media.service";

type ResolvedPublicValue =
  string | number | boolean | null | ResolvedPublicValue[] | { [key: string]: ResolvedPublicValue };

function isImageReference(value: Record<string, unknown>): boolean {
  return (
    (typeof value.assetId === "string" || value.assetId === null) &&
    typeof value.altText === "string"
  );
}

function resolvePublicImages(
  value: unknown,
  assets: ReadonlyMap<string, WebsitePublicMediaAsset>,
): ResolvedPublicValue {
  if (Array.isArray(value)) {
    return value.map((item) => resolvePublicImages(item, assets));
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const resolved = Object.fromEntries(
      Object.entries(record).map(([key, child]) => [key, resolvePublicImages(child, assets)]),
    ) as { [key: string]: ResolvedPublicValue };

    if (isImageReference(record)) {
      const asset =
        typeof record.assetId === "string" ? (assets.get(record.assetId) ?? null) : null;

      return { ...resolved, asset } as unknown as ResolvedPublicValue;
    }

    return resolved;
  }

  return value as string | number | boolean | null;
}

function collectImageAssetIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageAssetIds(item, ids));
  } else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;

    if (isImageReference(record) && typeof record.assetId === "string") {
      ids.add(record.assetId);
    }

    Object.values(record).forEach((child) => collectImageAssetIds(child, ids));
  }

  return ids;
}

/** Converts one published administrative snapshot into the strictly public contract. */
export function toWebsitePublicContent(
  version: WebsiteContentVersion,
  assets: ReadonlyMap<string, WebsitePublicMediaAsset> = new Map(),
): WebsitePublicContent {
  if (
    version.status !== WEBSITE_CONTENT_STATUS.PUBLISHED ||
    version.businessVersion === null ||
    version.publishedAt === null
  ) {
    throw websiteContentNotFound(version.contentKey);
  }

  return {
    contentKey: version.contentKey,
    businessVersion: version.businessVersion,
    publishedAt: version.publishedAt,
    seo: resolvePublicImages(version.seo, assets) as unknown as WebsitePublicContent["seo"],
    sections: version.sections
      .filter((section) => section.isEnabled)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(
        (section) => resolvePublicImages(section, assets) as unknown as WebsitePublicContentSection,
      ),
  };
}

/** Converts an authorized preview snapshot without requiring published lifecycle metadata. */
export function toWebsitePreviewContent(
  version: WebsiteContentVersion,
  assets: ReadonlyMap<string, WebsitePublicMediaAsset> = new Map(),
): Omit<WebsitePublicContent, "businessVersion" | "publishedAt"> & { revision: number } {
  return {
    contentKey: version.contentKey,
    revision: version.revision,
    seo: resolvePublicImages(version.seo, assets) as unknown as WebsitePublicContent["seo"],
    sections: version.sections
      .filter((section) => section.isEnabled)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(
        (section) => resolvePublicImages(section, assets) as unknown as WebsitePublicContentSection,
      ),
  };
}

/** Reads only current published Website Content through immutable version cache entries. */
@Injectable()
export class WebsiteContentPublicService {
  constructor(
    private readonly repository: WebsiteContentRepository,
    private readonly cache: WebsiteContentCacheService,
    private readonly media: WebsiteMediaService,
  ) {}

  /** Resolves a current public pointer through Redis and PostgreSQL fallbacks. */
  async getPublished(contentKey: WebsiteContentKey): Promise<WebsitePublicContent> {
    const pointer = await this.repository.getPublishedPointer(contentKey);

    if (!pointer.publishedVersionId) {
      throw websiteContentNotFound(contentKey);
    }

    const cached = await this.readCache(pointer.publishedVersionId);

    if (cached?.contentKey === contentKey) {
      return cached;
    }

    const version = await this.repository.getPublishedVersion(
      contentKey,
      pointer.publishedVersionId,
    );
    const assets = await this.media.resolvePublicAssets([...collectImageAssetIds(version)]);
    const content = toWebsitePublicContent(version, assets);

    await this.fillCache(pointer.publishedVersionId, content);

    return content;
  }

  /** Resolves one authorized draft snapshot through the same public-media contract. */
  async getPreview(
    version: WebsiteContentVersion,
  ): Promise<Omit<WebsitePublicContent, "businessVersion" | "publishedAt"> & { revision: number }> {
    const assets = await this.media.resolvePublicAssets([...collectImageAssetIds(version)]);

    return toWebsitePreviewContent(version, assets);
  }

  private async readCache(versionId: string): Promise<WebsitePublicContent | null> {
    try {
      return await this.cache.get(versionId);
    } catch {
      return null;
    }
  }

  private async fillCache(versionId: string, content: WebsitePublicContent): Promise<void> {
    try {
      await this.cache.set(versionId, content);
    } catch {
      // PostgreSQL remains the source of truth when a best-effort cache write fails.
    }
  }
}
