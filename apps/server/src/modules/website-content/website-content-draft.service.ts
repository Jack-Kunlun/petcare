import { Injectable } from "@nestjs/common";
import {
  type WebsiteContentKey,
  type WebsiteContentVersion,
  type WebsiteSeoContent,
} from "@petcare/shared-types";
import { WEBSITE_CONTENT_SEED_TEMPLATES } from "../../seed/seed-website-content";
import { websiteContentValidationFailed } from "./website-content.errors";
import {
  type SaveWebsiteContentDraftCommand,
  WebsiteContentRepository,
} from "./website-content.repository";
import { WebsitePageTemplateRegistry } from "./website-page-template.registry";
import { WebsiteSectionTypeRegistry } from "./website-section-type.registry";

const HTML_PATTERN = /<\/?[a-z][^>]*>/iu;

function validateSeo(contentKey: WebsiteContentKey, seo: WebsiteSeoContent): void {
  const expectedPath = WEBSITE_CONTENT_SEED_TEMPLATES.find(
    (template) => template.contentKey === contentKey,
  )?.seo.canonicalPath;

  if (
    seo.title.trim().length === 0 ||
    seo.description.trim().length === 0 ||
    HTML_PATTERN.test(seo.title) ||
    HTML_PATTERN.test(seo.description) ||
    seo.canonicalPath !== expectedPath
  ) {
    throw websiteContentValidationFailed("官网 SEO 元数据未通过校验");
  }
}

/** Validates and saves complete immutable Website Content draft snapshots. */
@Injectable()
export class WebsiteContentDraftService {
  constructor(
    private readonly repository: WebsiteContentRepository,
    private readonly pageTemplateRegistry: WebsitePageTemplateRegistry,
    private readonly sectionTypeRegistry: WebsiteSectionTypeRegistry,
  ) {}

  /** Saves a new revision after validating its fixed template and media references. */
  async saveDraft(command: SaveWebsiteContentDraftCommand): Promise<WebsiteContentVersion> {
    if (command.changeSummary.trim().length === 0 || command.requestId.trim().length === 0) {
      throw websiteContentValidationFailed("变更说明和请求标识不能为空");
    }

    validateSeo(command.contentKey, command.seo);
    this.pageTemplateRegistry.validateSnapshot(command.contentKey, command.sections);

    const assetIds = command.sections.flatMap((section) =>
      this.sectionTypeRegistry.resolveAssetIds(section),
    );

    if (command.seo.image?.assetId) {
      assetIds.unshift(command.seo.image.assetId);
    }

    return this.repository.saveDraft(command, [...new Set(assetIds)]);
  }
}
