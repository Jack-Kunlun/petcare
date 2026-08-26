import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_CONTENT_POST_STATUS,
  COMMUNITY_MEDIA_STATUS,
  COMMUNITY_POST_REPORT_STATUS,
} from "@petcare/shared-types";
import type {
  AdminCommunityPostReportResponse,
  CommunityPostReportReceipt,
  CreateCommunityPostReportRequest,
  CreateCommunityPostRequest,
  MyCommunityPostListItem,
  MyCommunityPostListQuery,
  MyCommunityPostListResponse,
  PublicCommunityPostDetail,
  PublicCommunityPostListItem,
  PublicCommunityPostListQuery,
  PublicCommunityPostListResponse,
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
import {
  communityPostDuplicateReport,
  communityPostForbidden,
  communityPostNotFound,
  communityPostSelfReport,
} from "./community-post.errors";
import { CommunityRateLimitService } from "./community-rate-limit.service";

const MAX_MEDIA_COUNT = 9;

const authorSelect = {
  id: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
} as const;

type PostRow = {
  id: string;
  content: string;
  mediaUrls: string[];
  status: string;
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PublicPostRow = {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: Date;
  author: {
    nickname: string;
    username: string | null;
    avatar: string | null;
  };
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

function toPublicPost(row: PublicPostRow): PublicCommunityPostListItem {
  return {
    id: row.id,
    author: {
      displayName: row.author.nickname.trim() || row.author.username?.trim() || "宠伴用户",
      avatar: row.author.avatar,
    },
    content: row.content,
    mediaUrls: row.mediaUrls,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Handles authenticated community post submission and author-only reads. */
@Injectable()
export class CommunityPostService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEBSITE_MEDIA_STORAGE) private readonly storage: WebsiteMediaStorage,
    private readonly rateLimits: CommunityRateLimitService,
  ) {}

  /** Creates one community post that always enters the pending moderation state. */
  async create(
    authorId: string,
    request: CreateCommunityPostRequest,
  ): Promise<MyCommunityPostListItem> {
    await this.rateLimits.assertPostCreateAllowed(authorId);
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
    const where = { authorId, status: { not: ADMIN_CONTENT_POST_STATUS.DELETED } };
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

  /** Returns only published posts without private author or moderation fields. */
  async findPublished(
    query: PublicCommunityPostListQuery,
  ): Promise<PublicCommunityPostListResponse> {
    const where = { status: ADMIN_CONTENT_POST_STATUS.PUBLISHED };
    const select = {
      id: true,
      content: true,
      mediaUrls: true,
      createdAt: true,
      author: { select: { nickname: true, username: true, avatar: true } },
    } as const;
    const [list, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      list: list.map(toPublicPost),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Returns one published post; every non-public state is indistinguishable from missing data. */
  async findPublishedById(id: string): Promise<PublicCommunityPostDetail> {
    const post = await this.prisma.post.findFirst({
      where: { id, status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
      select: {
        id: true,
        content: true,
        mediaUrls: true,
        createdAt: true,
        author: { select: { nickname: true, username: true, avatar: true } },
      },
    });

    if (!post) {
      throw communityPostNotFound();
    }

    return toPublicPost(post);
  }

  /** Accepts one report per reporter for a currently published post. */
  async report(
    reporterId: string,
    id: string,
    request: CreateCommunityPostReportRequest,
  ): Promise<CommunityPostReportReceipt> {
    const post = await this.prisma.post.findFirst({
      where: { id, status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
      select: { authorId: true },
    });

    if (!post) {
      throw communityPostNotFound();
    }

    if (post.authorId === reporterId) {
      throw communityPostSelfReport();
    }

    try {
      const report = await this.prisma.communityPostReport.create({
        data: {
          postId: id,
          reporterId,
          reason: request.reason,
          description: request.description?.trim() || null,
          status: COMMUNITY_POST_REPORT_STATUS.PENDING,
        },
        select: { id: true, status: true, createdAt: true },
      });

      return {
        id: report.id,
        status: report.status as CommunityPostReportReceipt["status"],
        createdAt: report.createdAt.toISOString(),
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw communityPostDuplicateReport();
      }

      throw error;
    }
  }

  /** Returns every report for one post to an independently authorized moderator. */
  async findReportsForAdmin(id: string): Promise<AdminCommunityPostReportResponse> {
    const [post, reports] = await Promise.all([
      this.prisma.post.findUnique({ where: { id }, select: { id: true } }),
      this.prisma.communityPostReport.findMany({
        where: { postId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reason: true,
          description: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          reporter: { select: authorSelect },
          post: { select: { id: true, status: true } },
        },
      }),
    ]);

    if (!post) {
      throw communityPostNotFound();
    }

    return {
      list: reports.map((report) => ({
        id: report.id,
        reporter: report.reporter,
        post: {
          id: report.post.id,
          status: normalizeCommunityPostStatus(report.post.status),
        },
        reason: report.reason as AdminCommunityPostReportResponse["list"][number]["reason"],
        description: report.description,
        status: report.status as AdminCommunityPostReportResponse["list"][number]["status"],
        createdAt: report.createdAt.toISOString(),
        resolvedAt: report.resolvedAt?.toISOString() ?? null,
      })),
      total: reports.length,
    };
  }

  /** Soft-deletes an author's own post and treats repeated deletion as success. */
  async deleteOwn(authorId: string, id: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true, status: true },
    });

    if (!post) {
      throw communityPostNotFound();
    }

    if (post.authorId !== authorId) {
      throw communityPostForbidden();
    }

    if (post.status === ADMIN_CONTENT_POST_STATUS.DELETED) {
      return;
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.post.updateMany({
        where: { id, authorId, status: { not: ADMIN_CONTENT_POST_STATUS.DELETED } },
        data: { status: ADMIN_CONTENT_POST_STATUS.DELETED, moderationReason: null },
      });
      await transaction.communityPostReport.updateMany({
        where: { postId: id, status: COMMUNITY_POST_REPORT_STATUS.PENDING },
        data: { status: COMMUNITY_POST_REPORT_STATUS.RESOLVED, resolvedAt: new Date() },
      });
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
