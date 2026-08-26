import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_CONTENT_POST_STATUS,
  COMMUNITY_MEDIA_STATUS,
  COMMUNITY_POST_COMMENT_STATUS,
  COMMUNITY_POST_REPORT_STATUS,
} from "@petcare/shared-types";
import type {
  AdminCommunityPostComment,
  AdminCommunityPostCommentListResponse,
  AdminCommunityPostCommentOfflineRequest,
  AdminCommunityPostReportResponse,
  CommunityPostLikeState,
  CommunityPostReportReceipt,
  CreateCommunityPostCommentRequest,
  CreateCommunityPostReportRequest,
  CreateCommunityPostRequest,
  MyCommunityPostListItem,
  MyCommunityPostListQuery,
  MyCommunityPostListResponse,
  PublicCommunityPostDetail,
  PublicCommunityPostComment,
  PublicCommunityPostCommentListResponse,
  PublicCommunityPostListItem,
  PublicCommunityPostListQuery,
  PublicCommunityPostListResponse,
} from "@petcare/shared-types";
import type { Prisma } from "../../generated/prisma/client";
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
  communityPostCommentForbidden,
  communityPostCommentNotFound,
  communityPostCommentStateConflict,
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

const publicCommentSelect = {
  id: true,
  commenterId: true,
  content: true,
  createdAt: true,
  commenter: { select: { nickname: true, avatar: true } },
} as const;

const adminCommentSelect = {
  id: true,
  postId: true,
  content: true,
  status: true,
  moderationReason: true,
  createdAt: true,
  updatedAt: true,
  commenter: { select: authorSelect },
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
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  author: {
    nickname: string;
    username: string | null;
    avatar: string | null;
  };
};

type PublicCommentRow = {
  id: string;
  commenterId: string;
  content: string;
  createdAt: Date;
  commenter: { nickname: string; avatar: string | null };
};

type AdminCommentRow = {
  id: string;
  postId: string;
  content: string;
  status: string;
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  commenter: {
    id: string;
    phone: string | null;
    username: string | null;
    nickname: string;
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
    likesCount: row.likesCount,
    commentsCount: row.commentsCount,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPublicComment(row: PublicCommentRow, viewerId?: string): PublicCommunityPostComment {
  return {
    id: row.id,
    author: {
      displayName: row.commenter.nickname.trim() || "宠伴用户",
      avatar: row.commenter.avatar,
    },
    content: row.content,
    canDelete: row.commenterId === viewerId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAdminComment(row: AdminCommentRow): AdminCommunityPostComment {
  return {
    id: row.id,
    postId: row.postId,
    commenter: row.commenter,
    content: row.content,
    status: row.status as AdminCommunityPostComment["status"],
    moderationReason: row.moderationReason,
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
      likesCount: true,
      commentsCount: true,
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
        likesCount: true,
        commentsCount: true,
        createdAt: true,
        author: { select: { nickname: true, username: true, avatar: true } },
      },
    });

    if (!post) {
      throw communityPostNotFound();
    }

    return toPublicPost(post);
  }

  /** Returns whether the authenticated user likes one currently published post. */
  async findLikeState(userId: string, id: string): Promise<CommunityPostLikeState> {
    const [post, like] = await Promise.all([
      this.prisma.post.findFirst({
        where: { id, status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
        select: { likesCount: true },
      }),
      this.prisma.communityPostLike.findUnique({
        where: { postId_userId: { postId: id, userId } },
        select: { id: true },
      }),
    ]);

    if (!post) {
      throw communityPostNotFound();
    }

    return { liked: Boolean(like), likesCount: post.likesCount };
  }

  /** Idempotently likes one currently published post. */
  like(userId: string, id: string): Promise<CommunityPostLikeState> {
    return this.setLikeState(userId, id, true);
  }

  /** Idempotently removes the current user's like from one published post. */
  unlike(userId: string, id: string): Promise<CommunityPostLikeState> {
    return this.setLikeState(userId, id, false);
  }

  /** Publishes one trimmed top-level comment and increments the visible count atomically. */
  createComment(
    commenterId: string,
    postId: string,
    request: CreateCommunityPostCommentRequest,
  ): Promise<PublicCommunityPostComment> {
    return this.prisma.$transaction(async (transaction) => {
      const post = await transaction.post.findFirst({
        where: { id: postId, status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
        select: { id: true },
      });

      if (!post) {
        throw communityPostNotFound();
      }

      const comment = await transaction.comment.create({
        data: {
          postId,
          commenterId,
          content: request.content.trim(),
          status: COMMUNITY_POST_COMMENT_STATUS.PUBLISHED,
        },
        select: publicCommentSelect,
      });
      const updated = await transaction.post.updateMany({
        where: { id: postId, status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
        data: { commentsCount: { increment: 1 } },
      });

      if (updated.count !== 1) {
        throw communityPostNotFound();
      }

      return toPublicComment(comment, commenterId);
    });
  }

  /** Lists only visible top-level comments while keeping non-public posts indistinguishable. */
  async findPublishedComments(
    postId: string,
    query: PublicCommunityPostListQuery,
    viewerId?: string,
  ): Promise<PublicCommunityPostCommentListResponse> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
      select: { id: true },
    });

    if (!post) {
      throw communityPostNotFound();
    }

    const where = {
      postId,
      parentCommentId: null,
      status: COMMUNITY_POST_COMMENT_STATUS.PUBLISHED,
    };
    const [list, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: publicCommentSelect,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      list: list.map((comment) => toPublicComment(comment, viewerId)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Idempotently deletes one owned comment and decrements its visible count at most once. */
  async deleteOwnComment(commenterId: string, postId: string, commentId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const comment = await transaction.comment.findFirst({
        where: { id: commentId, postId, parentCommentId: null },
        select: { commenterId: true },
      });

      if (!comment) {
        throw communityPostCommentNotFound();
      }

      if (comment.commenterId !== commenterId) {
        throw communityPostCommentForbidden();
      }

      const removedFromPublic = await transaction.comment.updateMany({
        where: {
          id: commentId,
          postId,
          commenterId,
          status: COMMUNITY_POST_COMMENT_STATUS.PUBLISHED,
        },
        data: {
          status: COMMUNITY_POST_COMMENT_STATUS.DELETED,
          moderationReason: null,
        },
      });

      if (removedFromPublic.count === 1) {
        await this.decrementVisibleCommentCount(transaction, postId);
      } else {
        await transaction.comment.updateMany({
          where: {
            id: commentId,
            postId,
            commenterId,
            status: COMMUNITY_POST_COMMENT_STATUS.OFFLINE,
          },
          data: {
            status: COMMUNITY_POST_COMMENT_STATUS.DELETED,
            moderationReason: null,
          },
        });
      }
    });
  }

  /** Returns every top-level comment state to a separately authorized post moderator. */
  async findCommentsForAdmin(
    postId: string,
    query: PublicCommunityPostListQuery,
  ): Promise<AdminCommunityPostCommentListResponse> {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true } });

    if (!post) {
      throw communityPostNotFound();
    }

    const where = { postId, parentCommentId: null };
    const [list, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: adminCommentSelect,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      list: list.map(toAdminComment),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Idempotently takes one visible comment offline and decrements its count at most once. */
  offlineComment(
    postId: string,
    commentId: string,
    request: AdminCommunityPostCommentOfflineRequest,
  ): Promise<AdminCommunityPostComment> {
    return this.prisma.$transaction(async (transaction) => {
      const removedFromPublic = await transaction.comment.updateMany({
        where: {
          id: commentId,
          postId,
          parentCommentId: null,
          status: COMMUNITY_POST_COMMENT_STATUS.PUBLISHED,
        },
        data: {
          status: COMMUNITY_POST_COMMENT_STATUS.OFFLINE,
          moderationReason: request.reason.trim(),
        },
      });

      if (removedFromPublic.count === 1) {
        await this.decrementVisibleCommentCount(transaction, postId);
      }

      const current = await transaction.comment.findFirst({
        where: { id: commentId, postId, parentCommentId: null },
        select: adminCommentSelect,
      });

      if (!current) {
        throw communityPostCommentNotFound();
      }

      return toAdminComment(current);
    });
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

  private async decrementVisibleCommentCount(
    transaction: Prisma.TransactionClient,
    postId: string,
  ): Promise<void> {
    const updated = await transaction.post.updateMany({
      where: { id: postId, commentsCount: { gt: 0 } },
      data: { commentsCount: { decrement: 1 } },
    });

    if (updated.count !== 1) {
      throw communityPostCommentStateConflict();
    }
  }

  private setLikeState(
    userId: string,
    id: string,
    liked: boolean,
  ): Promise<CommunityPostLikeState> {
    return this.prisma.$transaction(async (transaction) => {
      const post = await transaction.post.findFirst({
        where: { id, status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
        select: { id: true },
      });

      if (!post) {
        throw communityPostNotFound();
      }

      const changed = liked
        ? await transaction.communityPostLike.createMany({
            data: { postId: id, userId },
            skipDuplicates: true,
          })
        : await transaction.communityPostLike.deleteMany({ where: { postId: id, userId } });

      if (changed.count > 0) {
        const updated = await transaction.post.updateMany({
          where: {
            id,
            status: ADMIN_CONTENT_POST_STATUS.PUBLISHED,
            ...(!liked ? { likesCount: { gt: 0 } } : {}),
          },
          data: { likesCount: liked ? { increment: 1 } : { decrement: 1 } },
        });

        if (updated.count === 0) {
          throw communityPostNotFound();
        }
      }

      const current = await transaction.post.findFirst({
        where: { id, status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
        select: { likesCount: true },
      });

      if (!current) {
        throw communityPostNotFound();
      }

      return { liked, likesCount: current.likesCount };
    });
  }
}
