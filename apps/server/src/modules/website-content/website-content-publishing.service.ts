import { Injectable, Logger } from "@nestjs/common";
import {
  type PublishWebsiteContentResponse,
  type WebsiteContentVersion,
  type WebsitePublicMediaAsset,
} from "@petcare/shared-types";
import { WebsiteContentCacheService } from "./website-content-cache.service";
import { toWebsitePublicContent } from "./website-content-public.service";
import {
  websiteContentRevisionConflict,
  websiteContentValidationFailed,
} from "./website-content.errors";
import {
  type PublishWebsiteContentCommand,
  WebsiteContentRepository,
} from "./website-content.repository";
import { WebsitePageTemplateRegistry } from "./website-page-template.registry";
import { WebsiteSectionTypeRegistry } from "./website-section-type.registry";

/** Narrow preflight boundary for media-object checks outside the transaction. */
export interface WebsiteContentPublishPreflight {
  verify(
    version: WebsiteContentVersion,
    assetIds: readonly string[],
  ): Promise<ReadonlyMap<string, WebsitePublicMediaAsset>>;
}

/** Minimal logger surface used to report non-fatal post-commit cache failures. */
export interface WebsiteContentPublishingLogger {
  warn(message: string): void;
}

/** Explicitly publishes one saved Website Content draft without network I/O in the transaction. */
@Injectable()
export class WebsiteContentPublishingService {
  private readonly logger: WebsiteContentPublishingLogger;

  constructor(
    private readonly repository: WebsiteContentRepository,
    private readonly pageTemplateRegistry: WebsitePageTemplateRegistry,
    private readonly sectionTypeRegistry: WebsiteSectionTypeRegistry,
    private readonly preflight: WebsiteContentPublishPreflight,
    private readonly cache: WebsiteContentCacheService,
    logger?: WebsiteContentPublishingLogger,
  ) {
    this.logger = logger ?? new Logger(WebsiteContentPublishingService.name);
  }

  /** Preflights and publishes a single saved draft; retries reuse the idempotency key. */
  async publish(command: PublishWebsiteContentCommand): Promise<PublishWebsiteContentResponse> {
    if (
      command.changeSummary.trim().length === 0 ||
      command.idempotencyKey.trim().length === 0 ||
      command.requestId.trim().length === 0
    ) {
      throw websiteContentValidationFailed("发布说明、幂等键和请求标识不能为空");
    }

    const { draft } = await this.repository.getDraftAndPublished(command.contentKey);

    if (draft.revision !== command.revision) {
      throw websiteContentRevisionConflict();
    }

    this.pageTemplateRegistry.validateSnapshot(command.contentKey, draft.sections);
    const assetIds = this.assetIds(draft);

    const assets = await this.preflight.verify(draft, assetIds);

    const result = await this.repository.publishDraft(command, assetIds);

    await this.prewarm(result.published, assets);

    return result;
  }

  private assetIds(version: WebsiteContentVersion): string[] {
    const ids = version.sections.flatMap((section) =>
      this.sectionTypeRegistry.resolveAssetIds(section),
    );

    if (version.seo.image?.assetId) {
      ids.unshift(version.seo.image.assetId);
    }

    return [...new Set(ids)];
  }

  private async prewarm(
    version: WebsiteContentVersion,
    assets: ReadonlyMap<string, WebsitePublicMediaAsset>,
  ): Promise<void> {
    try {
      const stored = await this.cache.set(version.id, toWebsitePublicContent(version, assets));

      if (!stored) {
        this.logger.warn("Website Content cache prewarm failed after a committed publish.");
      }
    } catch (error) {
      const reason = error instanceof Error ? `: ${error.message}` : ".";

      this.logger.warn(`Website Content cache prewarm failed after a committed publish${reason}`);
    }
  }
}
