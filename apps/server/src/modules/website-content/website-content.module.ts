import { Module } from "@nestjs/common";
import COS from "cos-nodejs-sdk-v5";
import { AuthModule } from "../../auth/auth.module";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminWebsiteContentController } from "./admin-website-content.controller";
import { DisabledWebsiteMediaStorage } from "./media/disabled-website-media.storage";
import { TencentCosWebsiteMediaStorage } from "./media/tencent-cos-website-media.storage";
import type { WebsiteMediaStorage } from "./media/website-media-storage.types";
import { PublicWebsiteContentController } from "./public-website-content.controller";
import { WebsiteContentAuditService } from "./website-content-audit.service";
import { WebsiteContentCacheService } from "./website-content-cache.service";
import { WebsiteContentDiffService } from "./website-content-diff.service";
import { WebsiteContentDraftService } from "./website-content-draft.service";
import { WebsiteContentHistoryService } from "./website-content-history.service";
import { WebsiteContentPermissionGuard } from "./website-content-permission.guard";
import { WebsiteContentPublicService } from "./website-content-public.service";
import { WebsiteContentPublishingService } from "./website-content-publishing.service";
import { WebsiteContentRepository } from "./website-content.repository";
import { WebsiteMediaService, WEBSITE_MEDIA_STORAGE } from "./website-media.service";
import { WebsitePageTemplateRegistry } from "./website-page-template.registry";
import { WebsitePreviewService, WEBSITE_PREVIEW_CONFIG } from "./website-preview.service";
import { WebsiteSectionTypeRegistry } from "./website-section-type.registry";

function createWebsiteMediaStorage(config: ConfigService): WebsiteMediaStorage {
  if (!config.tencentCosEnabled) {
    return new DisabledWebsiteMediaStorage();
  }

  const client = new COS({
    SecretId: config.tencentCosSecretId,
    SecretKey: config.tencentCosSecretKey,
  });

  return new TencentCosWebsiteMediaStorage(client as never, {
    bucket: config.tencentCosBucket,
    region: config.tencentCosRegion,
    publicBaseUrl: config.tencentCosPublicBaseUrl,
  });
}

/** Assembles bounded Website Content persistence, media, lifecycle, Admin, and public HTTP adapters. */
@Module({
  imports: [AuthModule],
  controllers: [AdminWebsiteContentController, PublicWebsiteContentController],
  providers: [
    WebsiteContentRepository,
    WebsiteSectionTypeRegistry,
    WebsitePageTemplateRegistry,
    WebsiteContentDraftService,
    WebsiteContentHistoryService,
    WebsiteContentDiffService,
    {
      provide: WebsiteContentCacheService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new WebsiteContentCacheService(config),
    },
    WebsiteContentPublicService,
    WebsiteContentAuditService,
    {
      provide: WebsitePreviewService,
      inject: [
        PrismaService,
        WEBSITE_PREVIEW_CONFIG,
        WebsiteContentAuditService,
        WebsiteContentRepository,
      ],
      useFactory: (prisma, config, audit, repository) =>
        new WebsitePreviewService(prisma, config, audit, repository),
    },
    {
      provide: WebsiteMediaService,
      inject: [PrismaService, WEBSITE_MEDIA_STORAGE],
      useFactory: (prisma, storage) => new WebsiteMediaService(prisma, storage),
    },
    {
      provide: WebsiteContentPublishingService,
      inject: [
        WebsiteContentRepository,
        WebsitePageTemplateRegistry,
        WebsiteSectionTypeRegistry,
        WebsiteMediaService,
        WebsiteContentCacheService,
      ],
      useFactory: (repository, templates, sections, media, cache) =>
        new WebsiteContentPublishingService(repository, templates, sections, media, cache),
    },
    WebsiteContentPermissionGuard,
    {
      provide: WEBSITE_PREVIEW_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config,
    },
    {
      provide: WEBSITE_MEDIA_STORAGE,
      inject: [ConfigService],
      useFactory: createWebsiteMediaStorage,
    },
  ],
  exports: [WebsiteMediaService],
})
export class WebsiteContentModule {}
