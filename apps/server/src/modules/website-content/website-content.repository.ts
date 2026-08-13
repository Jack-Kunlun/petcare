import { Injectable } from "@nestjs/common";
import {
  WEBSITE_CONTENT_STATUS,
  WEBSITE_MEDIA_STATUS,
  type WebsiteContentHistoryQuery,
  type WebsiteContentHistoryResponse,
  type WebsiteContentKey,
  type WebsiteContentOverviewResponse,
  type PublishWebsiteContentResponse,
  type WebsiteContentSection,
  type WebsiteContentVersion,
  type WebsiteSeoContent,
} from "@petcare/shared-types";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  websiteContentInvalidMedia,
  websiteContentNotFound,
  websiteContentRevisionConflict,
  websiteContentVersionNotFound,
} from "./website-content.errors";

/** Exact application command for creating a new immutable draft snapshot. */
export interface SaveWebsiteContentDraftCommand {
  contentKey: WebsiteContentKey;
  revision: number;
  changeSummary: string;
  seo: WebsiteSeoContent;
  sections: WebsiteContentSection[];
  operatorId: string;
  requestId: string;
}

/** Exact application command for restoring a historical snapshot as a draft. */
export interface RestoreWebsiteContentDraftCommand {
  contentKey: WebsiteContentKey;
  versionId: string;
  revision: number;
  changeSummary: string;
  operatorId: string;
  requestId: string;
}

/** Exact application command for explicitly publishing one content unit. */
export interface PublishWebsiteContentCommand {
  contentKey: WebsiteContentKey;
  revision: number;
  idempotencyKey: string;
  changeSummary: string;
  operatorId: string;
  requestId: string;
}

const versionInclude = {
  websiteContent: { select: { contentKey: true } },
  sections: { orderBy: { sortOrder: "asc" as const } },
  createdBy: { select: { id: true, nickname: true, username: true } },
  publishedBy: { select: { id: true, nickname: true, username: true } },
} satisfies Prisma.WebsiteContentVersionInclude;

type VersionRecord = Prisma.WebsiteContentVersionGetPayload<{ include: typeof versionInclude }>;

function operatorSummary(user: { id: string; nickname: string; username: string | null }) {
  return { id: user.id, displayName: user.nickname || user.username || user.id };
}

function toVersion(record: VersionRecord): WebsiteContentVersion {
  return {
    id: record.id,
    contentKey: record.websiteContent.contentKey as WebsiteContentKey,
    revision: record.revision,
    businessVersion: record.businessVersion,
    status: record.status as WebsiteContentVersion["status"],
    changeSummary: record.changeSummary,
    seo: record.seo as unknown as WebsiteSeoContent,
    sections: record.sections.map((section) => ({
      sectionKey: section.sectionKey,
      sectionType: section.sectionType,
      sortOrder: section.sortOrder,
      isEnabled: section.isEnabled,
      schemaVersion: section.schemaVersion,
      content: section.content,
      settings: section.settings,
    })) as unknown as WebsiteContentSection[],
    sourceVersionId: record.sourceVersionId,
    createdBy: operatorSummary(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    publishedBy: record.publishedBy ? operatorSummary(record.publishedBy) : null,
    publishedAt: record.publishedAt?.toISOString() ?? null,
  };
}

function sectionCreateInput(section: WebsiteContentSection) {
  return {
    sectionKey: section.sectionKey,
    sectionType: section.sectionType,
    sortOrder: section.sortOrder,
    isEnabled: section.isEnabled,
    schemaVersion: section.schemaVersion,
    content: section.content as unknown as Prisma.InputJsonValue,
    settings: section.settings as unknown as Prisma.InputJsonValue,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Owns Website Content lifecycle persistence and optimistic pointer changes. */
@Injectable()
export class WebsiteContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists all independently managed content units and their current pointer summaries. */
  async getOverview(): Promise<WebsiteContentOverviewResponse> {
    const records = await this.prisma.websiteContent.findMany({
      include: {
        currentDraftVersion: {
          include: { createdBy: { select: { id: true, nickname: true, username: true } } },
        },
        publishedVersion: { select: { id: true, businessVersion: true, publishedAt: true } },
      },
      orderBy: { contentKey: "asc" },
    });

    return records.flatMap((record) => {
      const draft = record.currentDraftVersion;

      if (!draft) {
        return [];
      }

      return [{
        contentKey: record.contentKey as WebsiteContentKey,
        draftRevision: draft.revision,
        publishedBusinessVersion: record.publishedVersion?.businessVersion ?? null,
        hasUnpublishedChanges: draft.sourceVersionId !== record.publishedVersion?.id,
        lastEditedBy: operatorSummary(draft.createdBy),
        lastEditedAt: draft.createdAt.toISOString(),
        publishedAt: record.publishedVersion?.publishedAt?.toISOString() ?? null,
      }];
    });
  }

  /** Creates a new immutable draft and advances only the draft pointer. */
  async saveDraft(
    command: SaveWebsiteContentDraftCommand,
    assetIds: readonly string[],
  ): Promise<WebsiteContentVersion> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const content = await tx.websiteContent.findUnique({
          where: { contentKey: command.contentKey },
          include: { currentDraftVersion: { select: { id: true, revision: true, status: true } } },
        });

        if (!content) {
          throw websiteContentNotFound(command.contentKey);
        }

        const currentDraft = content.currentDraftVersion;

        if (
          !currentDraft ||
          currentDraft.revision !== command.revision ||
          currentDraft.status !== WEBSITE_CONTENT_STATUS.DRAFT
        ) {
          throw websiteContentRevisionConflict();
        }

        await this.assertActiveMedia(tx, assetIds);

        const superseded = await tx.websiteContentVersion.updateMany({
          where: {
            id: currentDraft.id,
            revision: command.revision,
            status: WEBSITE_CONTENT_STATUS.DRAFT,
          },
          data: { status: WEBSITE_CONTENT_STATUS.SUPERSEDED },
        });

        if (superseded.count !== 1) {
          throw websiteContentRevisionConflict();
        }

        const created = await tx.websiteContentVersion.create({
          data: {
            websiteContentId: content.id,
            status: WEBSITE_CONTENT_STATUS.DRAFT,
            revision: command.revision + 1,
            businessVersion: null,
            seo: command.seo as unknown as Prisma.InputJsonValue,
            sourceVersionId: currentDraft.id,
            idempotencyKey: null,
            changeSummary: command.changeSummary,
            createdById: command.operatorId,
            sections: { create: command.sections.map(sectionCreateInput) },
          },
          include: versionInclude,
        });

        const advanced = await tx.websiteContent.updateMany({
          where: { id: content.id, currentDraftVersionId: currentDraft.id },
          data: { currentDraftVersionId: created.id },
        });

        if (advanced.count !== 1) {
          throw websiteContentRevisionConflict();
        }

        await tx.websiteContentAuditLog.create({
          data: {
            websiteContentId: content.id,
            contentVersionId: created.id,
            operatorId: command.operatorId,
            action: "save_draft",
            targetType: "website_content_version",
            targetId: created.id,
            revision: created.revision,
            businessVersion: null,
            requestId: command.requestId,
            result: { status: "succeeded" },
          },
        });

        return toVersion(created);
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw websiteContentRevisionConflict();
      }

      throw error;
    }
  }

  /** Atomically publishes the selected draft and clones the next editable draft. */
  async publishDraft(
    command: PublishWebsiteContentCommand,
    assetIds: readonly string[],
  ): Promise<PublishWebsiteContentResponse> {
    const replay = await this.findPublishReplay(command);

    if (replay) {
      return replay;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const transactionReplay = await this.findPublishReplay(command, tx);

        if (transactionReplay) {
          return transactionReplay;
        }

        const content = await tx.websiteContent.findUnique({
          where: { contentKey: command.contentKey },
          include: {
            currentDraftVersion: {
              include: { sections: { orderBy: { sortOrder: "asc" } } },
            },
            publishedVersion: { select: { id: true, businessVersion: true } },
          },
        });

        if (!content) {
          throw websiteContentNotFound(command.contentKey);
        }

        const currentDraft = content.currentDraftVersion;

        if (
          !currentDraft ||
          currentDraft.revision !== command.revision ||
          currentDraft.status !== WEBSITE_CONTENT_STATUS.DRAFT
        ) {
          throw websiteContentRevisionConflict();
        }

        await this.assertActiveMedia(tx, assetIds);

        const highestBusinessVersion = await tx.websiteContentVersion.aggregate({
          where: { websiteContentId: content.id },
          _max: { businessVersion: true },
        });
        const businessVersion = (highestBusinessVersion._max.businessVersion ?? 0) + 1;

        if (content.publishedVersionId) {
          await tx.websiteContentVersion.updateMany({
            where: { id: content.publishedVersionId, status: WEBSITE_CONTENT_STATUS.PUBLISHED },
            data: { status: WEBSITE_CONTENT_STATUS.SUPERSEDED },
          });
        }

        const published = await tx.websiteContentVersion.update({
          where: { id: currentDraft.id },
          data: {
            status: WEBSITE_CONTENT_STATUS.PUBLISHED,
            businessVersion,
            idempotencyKey: command.idempotencyKey,
            changeSummary: command.changeSummary,
            publishedById: command.operatorId,
            publishedAt: new Date(),
          },
          include: versionInclude,
        });

        const draft = await tx.websiteContentVersion.create({
          data: {
            websiteContentId: content.id,
            status: WEBSITE_CONTENT_STATUS.DRAFT,
            revision: published.revision + 1,
            businessVersion: null,
            seo: published.seo,
            sourceVersionId: published.id,
            idempotencyKey: null,
            changeSummary: command.changeSummary,
            createdById: command.operatorId,
            sections: {
              create: currentDraft.sections.map((section) => ({
                sectionKey: section.sectionKey,
                sectionType: section.sectionType,
                sortOrder: section.sortOrder,
                isEnabled: section.isEnabled,
                schemaVersion: section.schemaVersion,
                content: section.content,
                settings: section.settings,
              })),
            },
          },
          include: versionInclude,
        });

        const advanced = await tx.websiteContent.updateMany({
          where: {
            id: content.id,
            currentDraftVersionId: currentDraft.id,
            publishedVersionId: content.publishedVersionId,
          },
          data: { currentDraftVersionId: draft.id, publishedVersionId: published.id },
        });

        if (advanced.count !== 1) {
          throw websiteContentRevisionConflict();
        }

        await tx.websiteContentAuditLog.create({
          data: {
            websiteContentId: content.id,
            contentVersionId: published.id,
            operatorId: command.operatorId,
            action: "publish",
            targetType: "website_content_version",
            targetId: published.id,
            revision: published.revision,
            businessVersion,
            requestId: command.requestId,
            result: {
              status: "succeeded",
              idempotencyKey: command.idempotencyKey,
              draftVersionId: draft.id,
            },
          },
        });

        await tx.websitePreviewToken.updateMany({
          where: { contentVersionId: published.id, revokedAt: null },
          data: { revokedAt: published.publishedAt ?? new Date() },
        });

        return { published: toVersion(published), draft: toVersion(draft) };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const concurrentReplay = await this.findPublishReplay(command);

        if (concurrentReplay) {
          return concurrentReplay;
        }

        throw websiteContentRevisionConflict();
      }

      throw error;
    }
  }

  /** Reads only the immutable public pointer for one content unit. */
  async getPublishedPointer(contentKey: WebsiteContentKey): Promise<{
    contentId: string;
    publishedVersionId: string | null;
  }> {
    const content = await this.prisma.websiteContent.findUnique({
      where: { contentKey },
      select: { id: true, publishedVersionId: true },
    });

    if (!content) {
      throw websiteContentNotFound(contentKey);
    }

    return { contentId: content.id, publishedVersionId: content.publishedVersionId };
  }

  /** Reads one published version by the already selected immutable pointer. */
  async getPublishedVersion(
    contentKey: WebsiteContentKey,
    versionId: string,
  ): Promise<WebsiteContentVersion> {
    const record = await this.prisma.websiteContentVersion.findFirst({
      where: {
        id: versionId,
        websiteContent: { contentKey },
        status: WEBSITE_CONTENT_STATUS.PUBLISHED,
      },
      include: versionInclude,
    });

    if (!record) {
      throw websiteContentVersionNotFound(versionId);
    }

    return toVersion(record);
  }

  /** Reads any exact immutable version for capability-scoped preview rendering. */
  async getVersionForPreview(
    contentKey: WebsiteContentKey,
    versionId: string,
    revision: number,
  ): Promise<WebsiteContentVersion> {
    const record = await this.prisma.websiteContentVersion.findFirst({
      where: { id: versionId, revision, websiteContent: { contentKey } },
      include: versionInclude,
    });

    if (!record) {
      throw websiteContentVersionNotFound(versionId);
    }

    return toVersion(record);
  }

  /** Resolves the exact currently saved draft scope used to mint a preview capability. */
  async getCurrentDraftScope(contentKey: WebsiteContentKey, revision: number): Promise<{
    contentId: string;
    versionId: string;
    revision: number;
  }> {
    const content = await this.prisma.websiteContent.findUnique({
      where: { contentKey },
      include: { currentDraftVersion: { select: { id: true, revision: true } } },
    });

    if (!content?.currentDraftVersion) {
      throw websiteContentNotFound(contentKey);
    }

    if (content.currentDraftVersion.revision !== revision) {
      throw websiteContentRevisionConflict();
    }

    return {
      contentId: content.id,
      versionId: content.currentDraftVersion.id,
      revision: content.currentDraftVersion.revision,
    };
  }

  /** Lists only versions that have entered the public business-version sequence. */
  async listHistory(
    contentKey: WebsiteContentKey,
    query: WebsiteContentHistoryQuery,
  ): Promise<WebsiteContentHistoryResponse> {
    const content = await this.prisma.websiteContent.findUnique({
      where: { contentKey },
      select: { id: true },
    });

    if (!content) {
      throw websiteContentNotFound(contentKey);
    }

    const where = { websiteContentId: content.id, businessVersion: { not: null } };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.websiteContentVersion.findMany({
        where,
        include: versionInclude,
        orderBy: { businessVersion: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.websiteContentVersion.count({ where }),
    ]);

    return { list: records.map(toVersion), total, page: query.page, pageSize: query.pageSize };
  }

  /** Reads one published-history version scoped to its content key. */
  async getHistoryVersion(
    contentKey: WebsiteContentKey,
    versionId: string,
  ): Promise<WebsiteContentVersion> {
    const record = await this.prisma.websiteContentVersion.findFirst({
      where: {
        id: versionId,
        websiteContent: { contentKey },
        businessVersion: { not: null },
      },
      include: versionInclude,
    });

    if (!record) {
      throw websiteContentVersionNotFound(versionId);
    }

    return toVersion(record);
  }

  /** Copies a published-history snapshot into a new draft without publishing it. */
  async restoreAsDraft(command: RestoreWebsiteContentDraftCommand): Promise<WebsiteContentVersion> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const content = await tx.websiteContent.findUnique({
          where: { contentKey: command.contentKey },
          include: { currentDraftVersion: { select: { id: true, revision: true, status: true } } },
        });

        if (!content) {
          throw websiteContentNotFound(command.contentKey);
        }

        const currentDraft = content.currentDraftVersion;

        if (!currentDraft || currentDraft.revision !== command.revision) {
          throw websiteContentRevisionConflict();
        }

        const source = await tx.websiteContentVersion.findFirst({
          where: {
            id: command.versionId,
            websiteContentId: content.id,
            businessVersion: { not: null },
          },
          include: { sections: { orderBy: { sortOrder: "asc" } } },
        });

        if (!source) {
          throw websiteContentVersionNotFound(command.versionId);
        }

        const sourceSections = source.sections.map((section) => ({
          sectionKey: section.sectionKey,
          sectionType: section.sectionType,
          sortOrder: section.sortOrder,
          isEnabled: section.isEnabled,
          schemaVersion: section.schemaVersion,
          content: section.content,
          settings: section.settings,
        })) as unknown as WebsiteContentSection[];

        await this.assertActiveMedia(tx, resolveAssetIds(source.seo, sourceSections));

        const superseded = await tx.websiteContentVersion.updateMany({
          where: { id: currentDraft.id, revision: command.revision, status: WEBSITE_CONTENT_STATUS.DRAFT },
          data: { status: WEBSITE_CONTENT_STATUS.SUPERSEDED },
        });

        if (superseded.count !== 1) {
          throw websiteContentRevisionConflict();
        }

        const restored = await tx.websiteContentVersion.create({
          data: {
            websiteContentId: content.id,
            status: WEBSITE_CONTENT_STATUS.DRAFT,
            revision: command.revision + 1,
            businessVersion: null,
            seo: source.seo,
            sourceVersionId: source.id,
            idempotencyKey: null,
            changeSummary: command.changeSummary,
            createdById: command.operatorId,
            sections: { create: sourceSections.map(sectionCreateInput) },
          },
          include: versionInclude,
        });

        const advanced = await tx.websiteContent.updateMany({
          where: { id: content.id, currentDraftVersionId: currentDraft.id },
          data: { currentDraftVersionId: restored.id },
        });

        if (advanced.count !== 1) {
          throw websiteContentRevisionConflict();
        }

        await tx.websiteContentAuditLog.create({
          data: {
            websiteContentId: content.id,
            contentVersionId: restored.id,
            operatorId: command.operatorId,
            action: "restore_as_draft",
            targetType: "website_content_version",
            targetId: restored.id,
            revision: restored.revision,
            businessVersion: null,
            requestId: command.requestId,
            result: { status: "succeeded", sourceVersionId: source.id },
          },
        });

        return toVersion(restored);
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw websiteContentRevisionConflict();
      }

      throw error;
    }
  }

  /** Loads the current draft and public pointer snapshots for a stable diff. */
  async getDraftAndPublished(contentKey: WebsiteContentKey): Promise<{
    draft: WebsiteContentVersion;
    published: WebsiteContentVersion | null;
  }> {
    const content = await this.prisma.websiteContent.findUnique({
      where: { contentKey },
      include: {
        currentDraftVersion: { include: versionInclude },
        publishedVersion: { include: versionInclude },
      },
    });

    if (!content?.currentDraftVersion) {
      throw websiteContentNotFound(contentKey);
    }

    return {
      draft: toVersion(content.currentDraftVersion),
      published: content.publishedVersion ? toVersion(content.publishedVersion) : null,
    };
  }

  /** Reads the current immutable draft snapshot selected by the draft pointer. */
  async getCurrentDraft(contentKey: WebsiteContentKey): Promise<WebsiteContentVersion> {
    return (await this.getDraftAndPublished(contentKey)).draft;
  }

  private async assertActiveMedia(
    tx: Prisma.TransactionClient,
    assetIds: readonly string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(assetIds)];

    if (uniqueIds.length === 0) {
      return;
    }

    const active = await tx.websiteMediaAsset.count({
      where: { id: { in: uniqueIds }, status: WEBSITE_MEDIA_STATUS.ACTIVE },
    });

    if (active !== uniqueIds.length) {
      throw websiteContentInvalidMedia();
    }
  }

  private async findPublishReplay(
    command: PublishWebsiteContentCommand,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<PublishWebsiteContentResponse | null> {
    const published = await client.websiteContentVersion.findUnique({
      where: { idempotencyKey: command.idempotencyKey },
      include: versionInclude,
    });

    if (!published) {
      return null;
    }

    if (
      published.websiteContent.contentKey !== command.contentKey ||
      published.revision !== command.revision ||
      published.changeSummary !== command.changeSummary
    ) {
      throw websiteContentRevisionConflict();
    }

    const draft = await client.websiteContentVersion.findUnique({
      where: {
        websiteContentId_revision: {
          websiteContentId: published.websiteContentId,
          revision: published.revision + 1,
        },
      },
      include: versionInclude,
    });

    if (!draft) {
      return null;
    }

    return { published: toVersion(published), draft: toVersion(draft) };
  }
}

function resolveAssetIds(seo: unknown, sections: WebsiteContentSection[]): string[] {
  const values: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (typeof value === "object" && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        if (key === "assetId" && typeof child === "string") {
          values.push(child);
        } else {
          walk(child);
        }
      }
    }
  };

  walk(seo);
  walk(sections);

  return [...new Set(values)];
}
