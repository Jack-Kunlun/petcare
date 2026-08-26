import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_CONTENT_POST_STATUS,
  COMMUNITY_MEDIA_STATUS,
  COMMUNITY_POST_MODERATION_ACTION,
} from "@petcare/shared-types";
import type {
  AdminContentPostDetail,
  AdminContentPostListResponse,
  AdminContentPostStateRequest,
  AdminContentRewardListResponse,
  CommunityPostModerationAction,
} from "@petcare/shared-types";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { WebsiteMediaStorage } from "../website-content/media/website-media-storage.types";
import { WEBSITE_MEDIA_STORAGE } from "../website-content/website-media.service";
import { normalizeCommunityPostStatus } from "./community-post-status";
import {
  communityPostConcurrentUpdate,
  communityPostMediaUnavailable,
  communityPostNotFound,
  communityPostReasonRequired,
  communityPostStateConflict,
} from "./community-post.errors";
import {
  AdminContentPostListQueryDto,
  AdminContentRewardListQueryDto,
} from "./dto/admin-content-query.dto";

const authorSelect = {
  id: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
} as const;

const petSelect = {
  id: true,
  name: true,
  breed: true,
} as const;

const postListSelect = {
  id: true,
  content: true,
  mediaUrls: true,
  likesCount: true,
  commentsCount: true,
  sharesCount: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  author: { select: authorSelect },
} as const;

const postDetailSelect = {
  ...postListSelect,
  moderationReason: true,
  moderationEvents: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      action: true,
      previousStatus: true,
      nextStatus: true,
      reason: true,
      createdAt: true,
      operator: { select: authorSelect },
    },
  },
} as const;

const postModerationSelect = {
  id: true,
  status: true,
  mediaUrls: true,
  updatedAt: true,
  mediaAssets: { select: { storageKey: true, status: true } },
} as const;

type PostListRecord = Prisma.PostGetPayload<{ select: typeof postListSelect }>;
type PostDetailRecord = Prisma.PostGetPayload<{ select: typeof postDetailSelect }>;

function excerpt(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized;
}

function asAuthor(value: {
  id: string;
  phone: string | null;
  username: string | null;
  nickname: string;
  avatar: string | null;
}) {
  return value;
}

function toPostListItem(post: PostListRecord): AdminContentPostListResponse["list"][number] {
  return {
    id: post.id,
    author: asAuthor(post.author),
    contentExcerpt: excerpt(post.content),
    mediaCount: post.mediaUrls.length,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    sharesCount: post.sharesCount,
    status: normalizeCommunityPostStatus(post.status),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function toPostDetail(post: PostDetailRecord): AdminContentPostDetail {
  return {
    ...toPostListItem(post),
    content: post.content,
    mediaUrls: post.mediaUrls,
    moderationReason: post.moderationReason,
    moderationHistory: post.moderationEvents.map((event) => ({
      id: event.id,
      action: event.action as CommunityPostModerationAction,
      previousStatus: normalizeCommunityPostStatus(event.previousStatus),
      nextStatus: normalizeCommunityPostStatus(event.nextStatus),
      reason: event.reason,
      operator: asAuthor(event.operator),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

/** 提供后台内容查询和社区帖子审核状态机。 */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEBSITE_MEDIA_STORAGE) private readonly storage: WebsiteMediaStorage,
  ) {}

  /** 查询悬赏订单列表，并固定限制为 reward 类型。 */
  async findRewardPage(
    query: AdminContentRewardListQueryDto,
  ): Promise<AdminContentRewardListResponse> {
    const keyword = query.keyword?.trim();
    const filters: object[] = [{ orderType: "reward" }];

    if (keyword) {
      filters.push({
        OR: [
          { id: { contains: keyword, mode: "insensitive" } },
          { owner: { phone: { contains: keyword } } },
          { owner: { nickname: { contains: keyword, mode: "insensitive" } } },
          { pet: { name: { contains: keyword, mode: "insensitive" } } },
        ],
      });
    }

    if (query.serviceType) {
      filters.push({ serviceType: query.serviceType });
    }

    if (query.status) {
      filters.push({ status: query.status });
    }

    const where = { AND: filters };
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          serviceType: true,
          status: true,
          serviceTime: true,
          createdAt: true,
          reward: { select: { rewardAmount: true } },
          owner: { select: authorSelect },
          pet: { select: petSelect },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      list: list.map((order) => ({
        id: order.id,
        serviceType:
          order.serviceType as AdminContentRewardListResponse["list"][number]["serviceType"],
        owner: asAuthor(order.owner),
        pet: order.pet,
        rewardAmount: (order.reward?.rewardAmount ?? 0) / 100,
        status: order.status as AdminContentRewardListResponse["list"][number]["status"],
        serviceTime: order.serviceTime.toISOString(),
        createdAt: order.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** 查询社区帖子列表，仅返回后台表格所需摘要字段。 */
  async findPostPage(query: AdminContentPostListQueryDto): Promise<AdminContentPostListResponse> {
    const keyword = query.keyword?.trim();
    const filters: object[] = [];

    if (keyword) {
      filters.push({
        OR: [
          { id: { contains: keyword, mode: "insensitive" } },
          { content: { contains: keyword, mode: "insensitive" } },
          { author: { phone: { contains: keyword } } },
          { author: { nickname: { contains: keyword, mode: "insensitive" } } },
        ],
      });
    }

    if (query.status) {
      filters.push(
        query.status === ADMIN_CONTENT_POST_STATUS.PENDING
          ? { status: { in: [ADMIN_CONTENT_POST_STATUS.PENDING, "draft"] } }
          : { status: query.status },
      );
    }

    const where = filters.length > 0 ? { AND: filters } : {};
    const [list, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: postListSelect,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      list: list.map(toPostListItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Returns full post content, managed media, and moderation history for administrators. */
  async findPostDetail(id: string): Promise<AdminContentPostDetail> {
    const post = await this.prisma.post.findUnique({ where: { id }, select: postDetailSelect });

    if (!post) {
      throw communityPostNotFound();
    }

    return toPostDetail(post);
  }

  /** Publishes one pending post after every managed image remains available. */
  approvePost(
    id: string,
    operatorId: string,
    request: AdminContentPostStateRequest,
  ): Promise<AdminContentPostDetail> {
    return this.transitionPost(id, operatorId, request, {
      action: COMMUNITY_POST_MODERATION_ACTION.APPROVE,
      allowedDatabaseStatuses: [ADMIN_CONTENT_POST_STATUS.PENDING, "draft"],
      expectedStatus: ADMIN_CONTENT_POST_STATUS.PENDING,
      nextStatus: ADMIN_CONTENT_POST_STATUS.PUBLISHED,
      requireReason: false,
      verifyMedia: true,
    });
  }

  /** Rejects one pending post with an author-visible reason. */
  rejectPost(
    id: string,
    operatorId: string,
    request: AdminContentPostStateRequest,
  ): Promise<AdminContentPostDetail> {
    return this.transitionPost(id, operatorId, request, {
      action: COMMUNITY_POST_MODERATION_ACTION.REJECT,
      allowedDatabaseStatuses: [ADMIN_CONTENT_POST_STATUS.PENDING, "draft"],
      expectedStatus: ADMIN_CONTENT_POST_STATUS.PENDING,
      nextStatus: ADMIN_CONTENT_POST_STATUS.REJECTED,
      requireReason: true,
      verifyMedia: false,
    });
  }

  /** Takes one published post offline with an auditable reason. */
  offlinePost(
    id: string,
    operatorId: string,
    request: AdminContentPostStateRequest,
  ): Promise<AdminContentPostDetail> {
    return this.transitionPost(id, operatorId, request, {
      action: COMMUNITY_POST_MODERATION_ACTION.OFFLINE,
      allowedDatabaseStatuses: [ADMIN_CONTENT_POST_STATUS.PUBLISHED],
      expectedStatus: ADMIN_CONTENT_POST_STATUS.PUBLISHED,
      nextStatus: ADMIN_CONTENT_POST_STATUS.OFFLINE,
      requireReason: true,
      verifyMedia: false,
    });
  }

  private async transitionPost(
    id: string,
    operatorId: string,
    request: AdminContentPostStateRequest,
    transition: {
      action: CommunityPostModerationAction;
      allowedDatabaseStatuses: string[];
      expectedStatus: AdminContentPostDetail["status"];
      nextStatus: AdminContentPostDetail["status"];
      requireReason: boolean;
      verifyMedia: boolean;
    },
  ): Promise<AdminContentPostDetail> {
    const current = await this.prisma.post.findUnique({
      where: { id },
      select: postModerationSelect,
    });

    if (!current) {
      throw communityPostNotFound();
    }

    if (normalizeCommunityPostStatus(current.status) !== transition.expectedStatus) {
      throw communityPostStateConflict();
    }

    const observedAt = new Date(request.expectedUpdatedAt);

    if (current.updatedAt.getTime() !== observedAt.getTime()) {
      throw communityPostConcurrentUpdate();
    }

    const reason = request.reason?.trim() || null;

    if (transition.requireReason && !reason) {
      throw communityPostReasonRequired();
    }

    if (transition.verifyMedia) {
      if (
        current.mediaUrls.length !== current.mediaAssets.length ||
        current.mediaAssets.some((asset) => asset.status !== COMMUNITY_MEDIA_STATUS.ACTIVE)
      ) {
        throw communityPostMediaUnavailable();
      }

      try {
        await Promise.all(current.mediaAssets.map((asset) => this.storage.head(asset.storageKey)));
      } catch {
        throw communityPostMediaUnavailable();
      }
    }

    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.post.updateMany({
        where: {
          id,
          status: { in: transition.allowedDatabaseStatuses },
          updatedAt: observedAt,
        },
        data: {
          status: transition.nextStatus,
          moderationReason: transition.requireReason ? reason : null,
        },
      });

      if (updated.count !== 1) {
        throw communityPostConcurrentUpdate();
      }

      await transaction.communityPostModerationEvent.create({
        data: {
          postId: id,
          operatorId,
          action: transition.action,
          previousStatus: transition.expectedStatus,
          nextStatus: transition.nextStatus,
          reason: transition.requireReason ? reason : null,
        },
      });
    });

    return this.findPostDetail(id);
  }
}
