import { Inject, Injectable } from "@nestjs/common";
import { COMMUNITY_MEDIA_STATUS } from "@petcare/shared-types";
import type { CommunityMediaAsset } from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { validateWebsiteMediaFile } from "../website-content/media/website-media-file";
import type { WebsiteMediaStorage } from "../website-content/media/website-media-storage.types";
import { WEBSITE_MEDIA_STORAGE } from "../website-content/website-media.service";
import {
  communityMediaConflict,
  communityMediaForbidden,
  communityMediaInvalid,
  communityMediaStorageUnavailable,
} from "./community-media.errors";

/** Raw multipart fields passed through server-side byte validation. */
export interface CommunityMediaUploadFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

/** Validates, stores, and registers community-owned image uploads. */
@Injectable()
export class CommunityMediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEBSITE_MEDIA_STORAGE) private readonly storage: WebsiteMediaStorage,
  ) {}

  /** Uploads one image under the community prefix and records its owner. */
  async upload(ownerId: string, file: CommunityMediaUploadFile): Promise<CommunityMediaAsset> {
    const valid = await validateWebsiteMediaFile(file.buffer, file.originalName, file.mimeType, {
      subject: "社区图片",
      errorFactory: communityMediaInvalid,
    });
    let stored: Awaited<ReturnType<WebsiteMediaStorage["put"]>>;

    try {
      stored = await this.storage.put({
        body: file.buffer,
        mimeType: valid.mimeType,
        extension: valid.extension,
        area: "community-media",
      });
    } catch {
      throw communityMediaStorageUnavailable();
    }

    try {
      const record = await this.prisma.communityMediaAsset.create({
        data: {
          ownerId,
          storageKey: stored.storageKey,
          originalName: file.originalName || `community-image.${valid.extension}`,
          mimeType: valid.mimeType,
          sizeBytes: valid.sizeBytes,
          width: valid.width,
          height: valid.height,
          checksum: valid.checksum,
          status: COMMUNITY_MEDIA_STATUS.ACTIVE,
        },
      });

      return {
        id: record.id,
        url: stored.publicUrl,
        mimeType: valid.mimeType,
        width: valid.width,
        height: valid.height,
        sizeBytes: valid.sizeBytes,
      };
    } catch (error) {
      await this.storage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  /** Invalidates one unbound owned upload and best-effort removes its object. */
  async discard(ownerId: string, assetId: string): Promise<void> {
    const asset = await this.prisma.communityMediaAsset.findUnique({
      where: { id: assetId },
      select: { ownerId: true, postId: true, status: true, storageKey: true },
    });

    if (!asset) {
      throw communityMediaInvalid();
    }

    if (asset.ownerId !== ownerId) {
      throw communityMediaForbidden();
    }

    if (asset.status === COMMUNITY_MEDIA_STATUS.DISCARDED) {
      return;
    }

    if (asset.status !== COMMUNITY_MEDIA_STATUS.ACTIVE || asset.postId !== null) {
      throw communityMediaConflict();
    }

    const discarded = await this.prisma.communityMediaAsset.updateMany({
      where: {
        id: assetId,
        ownerId,
        status: COMMUNITY_MEDIA_STATUS.ACTIVE,
        postId: null,
      },
      data: { status: COMMUNITY_MEDIA_STATUS.DISCARDED },
    });

    if (discarded.count !== 1) {
      throw communityMediaConflict();
    }

    await this.storage.delete(asset.storageKey).catch(() => undefined);
  }
}
