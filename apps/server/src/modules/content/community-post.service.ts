import { Inject, Injectable } from "@nestjs/common";
import { ADMIN_CONTENT_POST_STATUS, COMMUNITY_MEDIA_STATUS } from "@petcare/shared-types";
import type {
  CreateCommunityPostRequest,
  MyCommunityPostListItem,
  MyCommunityPostListQuery,
  MyCommunityPostListResponse,
} from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { WebsiteMediaStorage } from "../website-content/media/website-media-storage.types";
import { WEBSITE_MEDIA_STORAGE } from "../website-content/website-media.service";
import {
  communityMediaConflict,
  communityMediaForbidden,
  communityMediaInvalid,
  communityMediaStorageUnavailable,
} from "./community-media.errors";
import { normalizeCommunityPostStatus } from "./community-post-status";

const MAX_MEDIA_COUNT = 9;

type PostRow = {
  id: string;
  content: string;
  mediaUrls: string[];
  status: string;
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toMyPost(row: PostRow): MyCommunityPostListItem {
  const status = normalizeCommunityPostStatus(row.status);

  return {
    id: row.id,
    content: row.content,
    mediaUrls: row.mediaUrls,
    status,
    moderationReason: status === ADMIN_CONTENT_POST_STATUS.REJECTED ? row.moderationReason : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Handles authenticated community post submission and author-only reads. */
@Injectable()
export class CommunityPostService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEBSITE_MEDIA_STORAGE) private readonly storage: WebsiteMediaStorage,
  ) {}

  /** Creates one community post that always enters the pending moderation state. */
  async create(
    authorId: string,
    request: CreateCommunityPostRequest,
  ): Promise<MyCommunityPostListItem> {
    const assetIds = request.mediaAssetIds ?? [];

    if (assetIds.length > MAX_MEDIA_COUNT) {
      throw communityMediaInvalid(`每条动态最多上传 ${MAX_MEDIA_COUNT} 张图片`);
    }

    if (new Set(assetIds).size !== assetIds.length) {
      throw communityMediaInvalid("同一张社区图片不能重复使用");
    }

    return this.prisma.$transaction(async (transaction) => {
      const assets =
        assetIds.length === 0
          ? []
          : await transaction.communityMediaAsset.findMany({
              where: { id: { in: assetIds } },
              select: { id: true, ownerId: true, postId: true, status: true, storageKey: true },
            });

      if (assets.length !== assetIds.length) {
        throw communityMediaInvalid();
      }

      if (assets.some((asset) => asset.ownerId !== authorId)) {
        throw communityMediaForbidden();
      }

      if (assets.some((asset) => asset.status !== COMMUNITY_MEDIA_STATUS.ACTIVE)) {
        throw communityMediaInvalid("社区图片已失效");
      }

      if (assets.some((asset) => asset.postId !== null)) {
        throw communityMediaConflict();
      }

      const storageKeys = new Map(assets.map((asset) => [asset.id, asset.storageKey]));
      let mediaUrls: string[];

      try {
        mediaUrls = assetIds.map((assetId) =>
          this.storage.resolvePublicUrl(storageKeys.get(assetId) ?? ""),
        );
      } catch {
        throw communityMediaStorageUnavailable();
      }

      const post = await transaction.post.create({
        data: {
          authorId,
          content: request.content.trim(),
          mediaUrls,
          tags: [],
          status: ADMIN_CONTENT_POST_STATUS.PENDING,
        },
        select: {
          id: true,
          content: true,
          mediaUrls: true,
          status: true,
          moderationReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (assetIds.length > 0) {
        const binding = await transaction.communityMediaAsset.updateMany({
          where: {
            id: { in: assetIds },
            ownerId: authorId,
            status: COMMUNITY_MEDIA_STATUS.ACTIVE,
            postId: null,
          },
          data: { postId: post.id },
        });

        if (binding.count !== assetIds.length) {
          throw communityMediaConflict();
        }
      }

      return toMyPost(post);
    });
  }

  /** Returns only the authenticated author's posts, including non-public moderation states. */
  async findMine(
    authorId: string,
    query: MyCommunityPostListQuery,
  ): Promise<MyCommunityPostListResponse> {
    const where = { authorId };
    const [list, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          content: true,
          mediaUrls: true,
          status: true,
          moderationReason: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      list: list.map(toMyPost),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
