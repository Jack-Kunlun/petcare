import { Inject, Injectable } from "@nestjs/common";
import {
  WEBSITE_MEDIA_STATUS,
  type WebsiteContentVersion,
  type WebsiteMediaAsset,
  type WebsiteMediaListQuery,
  type WebsiteMediaListResponse,
} from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { ValidatedWebsiteMediaFile } from "./media/website-media-file";
import type { WebsiteMediaStorage } from "./media/website-media-storage.types";
import { websiteContentInvalidMedia } from "./website-content.errors";

/** Injection token for the provider-specific Website Content media object store. */
export const WEBSITE_MEDIA_STORAGE = Symbol("WEBSITE_MEDIA_STORAGE");

/** Raw multipart file fields accepted after controller-level presence validation. */
export interface WebsiteMediaUploadFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  operatorId: string;
}

/** Coordinates validated media persistence, references, and COS object availability. */
@Injectable()
export class WebsiteMediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEBSITE_MEDIA_STORAGE) private readonly storage: WebsiteMediaStorage,
  ) {}

  /** Registers a validated object and compensates COS if database persistence fails. */
  async upload(file: WebsiteMediaUploadFile, valid: ValidatedWebsiteMediaFile): Promise<unknown> {
    const stored = await this.storage.put({
      body: file.buffer,
      mimeType: valid.mimeType,
      extension: valid.extension,
    });

    try {
      return await this.prisma.websiteMediaAsset.create({
        data: {
          storageKey: stored.storageKey,
          originalName: file.originalName,
          mimeType: valid.mimeType,
          sizeBytes: valid.sizeBytes,
          width: valid.width,
          height: valid.height,
          checksum: valid.checksum,
          status: WEBSITE_MEDIA_STATUS.ACTIVE,
          createdById: file.operatorId,
        },
      });
    } catch (error) {
      await this.storage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  /** Verifies the exact active managed objects referenced by a pending publish. */
  async verify(_version: WebsiteContentVersion, assetIds: readonly string[]): Promise<void> {
    const ids = [...new Set(assetIds)];

    if (ids.length === 0) {
      return;
    }

    const assets = await this.prisma.websiteMediaAsset.findMany({
      where: { id: { in: ids }, status: WEBSITE_MEDIA_STATUS.ACTIVE },
      select: { id: true, storageKey: true, status: true },
    });

    if (assets.length !== ids.length) {
      throw websiteContentInvalidMedia();
    }

    await Promise.all(assets.map((asset) => this.storage.head(asset.storageKey)));
  }

  /** Lists managed images without leaking provider object keys. */
  async list(query: WebsiteMediaListQuery): Promise<WebsiteMediaListResponse> {
    const where = query.status ? { status: query.status } : {};
    const [records, total] = await this.prisma.$transaction([
      this.prisma.websiteMediaAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { createdBy: { select: { id: true, nickname: true, username: true } } },
      }),
      this.prisma.websiteMediaAsset.count({ where }),
    ]);

    return {
      list: records.map((record) => this.toAsset(record as never)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Archives only objects not referenced by current draft or published snapshots. */
  async archive(
    assetId: string,
    _operatorId?: string,
    _requestId?: string,
  ): Promise<WebsiteMediaAsset> {
    const references = await this.findReferences(assetId);

    if (references.length > 0) {
      throw websiteContentInvalidMedia("仍被当前草稿或已发布内容引用的素材不能归档");
    }

    const record = await this.prisma.websiteMediaAsset.update({
      where: { id: assetId },
      data: { status: WEBSITE_MEDIA_STATUS.ARCHIVED, archivedAt: new Date() },
      include: { createdBy: { select: { id: true, nickname: true, username: true } } },
    });

    return this.toAsset(record);
  }

  /** Resolves a provider URL from a managed asset id. */
  async resolvePublicAsset(assetId: string): Promise<WebsiteMediaAsset["publicAsset"]> {
    const asset = await this.prisma.websiteMediaAsset.findFirst({
      where: { id: assetId, status: WEBSITE_MEDIA_STATUS.ACTIVE },
    });

    if (!asset) {
      throw websiteContentInvalidMedia();
    }

    return {
      id: asset.id,
      url: this.storage.resolvePublicUrl(asset.storageKey),
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType as WebsiteMediaAsset["mimeType"],
    };
  }

  private async findReferences(assetId: string): Promise<string[]> {
    const sections = await this.prisma.websiteContentSection.findMany({
      where: {
        version: {
          OR: [{ currentDraftFor: { isNot: null } }, { publishedFor: { isNot: null } }],
        },
      },
      select: { versionId: true, content: true },
    });

    return sections.filter((section) => JSON.stringify(section.content).includes(assetId))
      .map((section) => section.versionId);
  }

  private toAsset(record: {
    id: string; originalName: string; mimeType: string; sizeBytes: number; width: number; height: number;
    checksum: string; status: string; storageKey: string; createdAt: Date;
    createdBy: { id: string; nickname: string; username: string | null };
  }): WebsiteMediaAsset {
    return {
      id: record.id,
      originalName: record.originalName,
      mimeType: record.mimeType as WebsiteMediaAsset["mimeType"],
      sizeBytes: record.sizeBytes,
      width: record.width,
      height: record.height,
      checksum: record.checksum,
      status: record.status as WebsiteMediaAsset["status"],
      publicAsset: { id: record.id, url: this.storage.resolvePublicUrl(record.storageKey), width: record.width, height: record.height, mimeType: record.mimeType as WebsiteMediaAsset["mimeType"] },
      createdBy: { id: record.createdBy.id, displayName: record.createdBy.nickname || record.createdBy.username || record.createdBy.id },
      createdAt: record.createdAt.toISOString(),
      references: [],
    };
  }
}
