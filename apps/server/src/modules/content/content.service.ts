import { Injectable } from "@nestjs/common";
import { ADMIN_CONTENT_POST_STATUS } from "@petcare/shared-types";
import type {
  AdminContentPostListResponse,
  AdminContentRewardListResponse,
} from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeCommunityPostStatus } from "./community-post-status";
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

/** 提供后台内容管理的只读分页查询。 */
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

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
        select: {
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
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      list: list.map((post) => ({
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
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
