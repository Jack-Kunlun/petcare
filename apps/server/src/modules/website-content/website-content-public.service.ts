import { Injectable } from "@nestjs/common";
import {
  WEBSITE_CONTENT_STATUS,
  type WebsiteContentKey,
  type WebsiteContentVersion,
  type WebsitePublicContent,
  type WebsitePublicContentSection,
} from "@petcare/shared-types";
import { WebsiteContentCacheService } from "./website-content-cache.service";
import { websiteContentNotFound } from "./website-content.errors";
import { WebsiteContentRepository } from "./website-content.repository";

type ResolvedPublicValue =
  | string
  | number
  | boolean
  | null
  | ResolvedPublicValue[]
  | { [key: string]: ResolvedPublicValue };

function isImageReference(value: Record<string, unknown>): boolean {
  return typeof value.assetId === "string" || value.assetId === null;
}

function resolvePublicImages(value: unknown): ResolvedPublicValue {
  if (Array.isArray(value)) {
    return value.map(resolvePublicImages);
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const resolved = Object.fromEntries(
      Object.entries(record).map(([key, child]) => [key, resolvePublicImages(child)]),
    ) as { [key: string]: ResolvedPublicValue };

    if (isImageReference(record)) {
      return { ...resolved, asset: null };
    }

    return resolved;
  }

  return value as string | number | boolean | null;
}

/** Converts one published administrative snapshot into the strictly public contract. */
export function toWebsitePublicContent(version: WebsiteContentVersion): WebsitePublicContent {
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
    seo: resolvePublicImages(version.seo) as unknown as WebsitePublicContent["seo"],
    sections: version.sections
      .filter((section) => section.isEnabled)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((section) => resolvePublicImages(section) as unknown as WebsitePublicContentSection),
  };
}

/** Reads only current published Website Content through immutable version cache entries. */
@Injectable()
export class WebsiteContentPublicService {
  constructor(
    private readonly repository: WebsiteContentRepository,
    private readonly cache: WebsiteContentCacheService,
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

    const version = await this.repository.getPublishedVersion(contentKey, pointer.publishedVersionId);
    const content = toWebsitePublicContent(version);

    await this.fillCache(pointer.publishedVersionId, content);

    return content;
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
