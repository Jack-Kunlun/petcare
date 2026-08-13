import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminClassroomArticleListResponse,
  AdminContentPostListResponse,
  AdminContentRewardListResponse,
  PublicClassroomArticleAuthor,
  PublicClassroomArticleDetail,
  PublicClassroomArticleListItem,
  PublicClassroomArticleListQuery,
  PublicClassroomArticleListResponse,
} from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AdminClassroomArticleListQueryDto,
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

const publicArticleAuthorSelect = {
  nickname: true,
  username: true,
  avatar: true,
} as const;

const publicArticleListSelect = {
  id: true,
  title: true,
  summary: true,
  coverUrl: true,
  publishedAt: true,
  author: { select: publicArticleAuthorSelect },
} as const;

const publicArticleDetailSelect = {
  ...publicArticleListSelect,
  content: true,
} as const;

function excerpt(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 120 ? `${normalized.slice(0, 120)}…` : normalized;
}

function asAuthor(value: {
  id: string;
  phone: string;
  username: string | null;
  nickname: string;
  avatar: string | null;
}) {
  return value;
}

function asPublicAuthor(
  value: { nickname: string; username: string | null; avatar: string | null } | null,
): PublicClassroomArticleAuthor | null {
  if (!value) {
    return null;
  }

  const displayName = value.nickname.trim() || value.username?.trim();

  return displayName ? { displayName, avatar: value.avatar } : null;
}

function asPublicArticleListItem(value: {
  id: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  publishedAt: Date | null;
  author: { nickname: string; username: string | null; avatar: string | null } | null;
}): PublicClassroomArticleListItem {
  return {
    slug: value.id,
    title: value.title,
    summary: value.summary,
    coverUrl: value.coverUrl,
    author: asPublicAuthor(value.author),
    publishedAt: value.publishedAt?.toISOString() ?? null,
  };
}

function escapePlainText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replaceAll(String.fromCharCode(34), "&quot;")
    .replace(/'/g, "&#39;");
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
      filters.push({ status: query.status });
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
        status: post.status as AdminContentPostListResponse["list"][number]["status"],
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** 查询课堂文章列表，正文只用于关键词匹配，不返回给列表页面。 */
  async findArticlePage(
    query: AdminClassroomArticleListQueryDto,
  ): Promise<AdminClassroomArticleListResponse> {
    const keyword = query.keyword?.trim();
    const filters: object[] = [];

    if (keyword) {
      filters.push({
        OR: [
          { title: { contains: keyword, mode: "insensitive" } },
          { summary: { contains: keyword, mode: "insensitive" } },
          { content: { contains: keyword, mode: "insensitive" } },
        ],
      });
    }

    if (query.status) {
      filters.push({ status: query.status });
    }

    const where = filters.length > 0 ? { AND: filters } : {};
    const [list, total] = await Promise.all([
      this.prisma.classroomArticle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          title: true,
          summary: true,
          coverUrl: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          author: { select: authorSelect },
        },
      }),
      this.prisma.classroomArticle.count({ where }),
    ]);

    return {
      list: list.map((article) => ({
        id: article.id,
        title: article.title,
        summary: article.summary,
        coverUrl: article.coverUrl,
        status: article.status as AdminClassroomArticleListResponse["list"][number]["status"],
        author: article.author ? asAuthor(article.author) : null,
        publishedAt: article.publishedAt?.toISOString() ?? null,
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Returns only published classroom articles for unauthenticated website readers. */
  async findPublishedArticlePage(
    query: PublicClassroomArticleListQuery,
  ): Promise<PublicClassroomArticleListResponse> {
    const where = { status: "published" };
    const [list, total] = await Promise.all([
      this.prisma.classroomArticle.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: publicArticleListSelect,
      }),
      this.prisma.classroomArticle.count({ where }),
    ]);

    return {
      list: list.map(asPublicArticleListItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Returns one published classroom article by its stable ID route value. */
  async findPublishedArticleBySlug(slug: string): Promise<PublicClassroomArticleDetail> {
    const article = await this.prisma.classroomArticle.findFirst({
      where: { id: slug, status: "published" },
      select: publicArticleDetailSelect,
    });

    if (!article) {
      throw new NotFoundException("Public classroom article was not found");
    }

    return {
      ...asPublicArticleListItem(article),
      body: escapePlainText(article.content),
    };
  }
}
