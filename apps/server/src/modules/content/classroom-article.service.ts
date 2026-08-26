import { Injectable } from "@nestjs/common";
import type {
  AdminClassroomArticleDetail,
  AdminClassroomArticleListItem,
  AdminClassroomArticleListResponse,
  AdminClassroomArticleStateRequest,
  AdminClassroomArticleStatus,
  ClassroomArticleCategory,
  CreateAdminClassroomArticleRequest,
  UpdateAdminClassroomArticleRequest,
  PublicClassroomArticleAuthor,
  PublicClassroomArticleListItem,
  PublicClassroomArticleListQuery,
  PublicClassroomArticleListResponse,
  PublicClassroomArticleDetail,
} from "@petcare/shared-types";
import { ConfigService } from "../../config/config.service";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsiteMediaService } from "../website-content/website-media.service";
import {
  decodeArticleBody,
  encodeArticleBody,
  isPublishableArticleBody,
} from "./classroom-article-content";
import {
  classroomArticleConcurrentUpdate,
  classroomArticleInvalidContent,
  classroomArticleNotFound,
  classroomArticleStateConflict,
} from "./classroom-article.errors";
import { AdminClassroomArticleListQueryDto } from "./dto/admin-content-query.dto";

const authorSelect = {
  id: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
} as const;

const adminArticleListSelect = {
  id: true,
  category: true,
  title: true,
  summary: true,
  coverUrl: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: authorSelect },
} as const;

const adminArticleDetailSelect = {
  ...adminArticleListSelect,
  content: true,
} as const;

const publicArticleAuthorSelect = {
  nickname: true,
  username: true,
  avatar: true,
} as const;

const publicArticleListSelect = {
  id: true,
  category: true,
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

type AdminArticleListRecord = Prisma.ClassroomArticleGetPayload<{
  select: typeof adminArticleListSelect;
}>;

type AdminArticleDetailRecord = Prisma.ClassroomArticleGetPayload<{
  select: typeof adminArticleDetailSelect;
}>;

function asPublicAuthor(
  value: { nickname: string; username: string | null; avatar: string | null } | null,
): PublicClassroomArticleAuthor | null {
  if (!value) {
    return null;
  }

  const displayName = value.nickname.trim() || value.username?.trim();

  return displayName ? { displayName, avatar: value.avatar } : null;
}

function toPublicArticleListItem(value: {
  id: string;
  category: string | null;
  title: string;
  summary: string;
  coverUrl: string | null;
  publishedAt: Date | null;
  author: { nickname: string; username: string | null; avatar: string | null } | null;
}): PublicClassroomArticleListItem {
  return {
    slug: value.id,
    category: value.category as ClassroomArticleCategory | null,
    title: value.title,
    summary: value.summary,
    coverUrl: value.coverUrl,
    author: asPublicAuthor(value.author),
    publishedAt: value.publishedAt?.toISOString() ?? null,
  };
}

/** Manages classroom article reads and publishing lifecycle persistence. */
@Injectable()
export class ClassroomArticleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: WebsiteMediaService,
    private readonly config: ConfigService,
  ) {}

  /** Creates an editable draft owned by the currently authenticated administrator. */
  async createDraft(
    operatorId: string,
    request: CreateAdminClassroomArticleRequest,
  ): Promise<AdminClassroomArticleDetail> {
    const body = await encodeArticleBody(request.bodyHtml, (assetIds) =>
      this.media.resolvePublicAssets(assetIds),
    );
    const cover = request.coverAssetId
      ? await this.media.resolvePublicAsset(request.coverAssetId)
      : null;
    const article = await this.prisma.classroomArticle.create({
      data: {
        category: request.category,
        title: request.title.trim(),
        summary: request.summary.trim(),
        coverUrl: cover?.url ?? null,
        content: body.storedContent,
        status: "draft",
        authorId: operatorId,
      },
      select: adminArticleDetailSelect,
    });

    return this.toAdminDetail(article);
  }

  /** Returns one classroom article for an authorized administrator, regardless of lifecycle state. */
  async findAdminArticle(id: string): Promise<AdminClassroomArticleDetail> {
    const article = await this.prisma.classroomArticle.findUnique({
      where: { id },
      select: adminArticleDetailSelect,
    });

    if (!article) {
      throw classroomArticleNotFound();
    }

    return this.toAdminDetail(article);
  }

  /** Updates a draft or offline classroom article with optimistic concurrency protection. */
  async updateEditable(
    id: string,
    request: UpdateAdminClassroomArticleRequest,
  ): Promise<AdminClassroomArticleDetail> {
    const current = await this.requireArticle(id);

    if (current.status !== "draft" && current.status !== "offline") {
      throw classroomArticleStateConflict();
    }

    const body = await encodeArticleBody(request.bodyHtml, (assetIds) =>
      this.media.resolvePublicAssets(assetIds),
    );
    let coverUrl = current.coverUrl;

    if (request.coverAssetId !== undefined) {
      coverUrl = request.coverAssetId
        ? (await this.media.resolvePublicAsset(request.coverAssetId)).url
        : null;
    }

    const result = await this.prisma.classroomArticle.updateMany({
      where: {
        id,
        status: { in: ["draft", "offline"] },
        updatedAt: new Date(request.expectedUpdatedAt),
      },
      data: {
        category: request.category,
        title: request.title.trim(),
        summary: request.summary.trim(),
        coverUrl,
        content: body.storedContent,
      },
    });

    if (result.count === 0) {
      throw classroomArticleConcurrentUpdate();
    }

    return this.findAdminArticle(id);
  }

  /** Publishes a draft or offline classroom article when its sanitized body is publishable. */
  async publish(
    id: string,
    request: AdminClassroomArticleStateRequest,
  ): Promise<AdminClassroomArticleDetail> {
    const current = await this.requireArticle(id);

    if (current.status !== "draft" && current.status !== "offline") {
      throw classroomArticleStateConflict();
    }

    if (!current.category) {
      throw classroomArticleInvalidContent("发布前必须选择文章分类");
    }

    const bodyHtml = await decodeArticleBody(current.content, (assetIds) =>
      this.media.resolvePublicAssets(assetIds),
    );

    if (!isPublishableArticleBody(bodyHtml)) {
      throw classroomArticleInvalidContent("发布前必须填写正文或插入图片");
    }

    const result = await this.prisma.classroomArticle.updateMany({
      where: {
        id,
        status: { in: ["draft", "offline"] },
        updatedAt: new Date(request.expectedUpdatedAt),
      },
      data: { status: "published", publishedAt: new Date() },
    });

    if (result.count === 0) {
      throw classroomArticleConcurrentUpdate();
    }

    return this.findAdminArticle(id);
  }

  /** Takes a published classroom article offline without altering its last publication time. */
  async offline(
    id: string,
    request: AdminClassroomArticleStateRequest,
  ): Promise<AdminClassroomArticleDetail> {
    const current = await this.requireArticle(id);

    if (current.status !== "published") {
      throw classroomArticleStateConflict();
    }

    const result = await this.prisma.classroomArticle.updateMany({
      where: { id, status: "published", updatedAt: new Date(request.expectedUpdatedAt) },
      data: { status: "offline" },
    });

    if (result.count === 0) {
      throw classroomArticleConcurrentUpdate();
    }

    return this.findAdminArticle(id);
  }

  /** Returns paginated classroom articles for authorized administrators. */
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
        select: adminArticleListSelect,
      }),
      this.prisma.classroomArticle.count({ where }),
    ]);

    return {
      list: list.map((article) => this.toAdminListItem(article)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Returns only published classroom article summaries for unauthenticated website readers. */
  async findPublishedArticlePage(
    query: PublicClassroomArticleListQuery,
  ): Promise<PublicClassroomArticleListResponse> {
    const keyword = query.keyword?.trim();
    const filters: Prisma.ClassroomArticleWhereInput[] = [{ status: "published" }];

    if (keyword) {
      filters.push({
        OR: [
          { title: { contains: keyword, mode: "insensitive" } },
          { summary: { contains: keyword, mode: "insensitive" } },
          { content: { contains: keyword, mode: "insensitive" } },
        ],
      });
    }

    if (query.category) {
      filters.push({ category: query.category });
    }

    const where = { AND: filters };
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
      list: list.map(toPublicArticleListItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Returns one published classroom article by its stable route value. */
  async findPublishedArticleBySlug(slug: string): Promise<PublicClassroomArticleDetail> {
    const article = await this.prisma.classroomArticle.findFirst({
      where: { id: slug, status: "published" },
      select: publicArticleDetailSelect,
    });

    if (!article) {
      throw classroomArticleNotFound();
    }

    return {
      ...toPublicArticleListItem(article),
      bodyHtml: await decodeArticleBody(article.content, (assetIds) =>
        this.media.resolvePublicAssets(assetIds),
      ),
    };
  }

  private toAdminListItem(article: AdminArticleListRecord): AdminClassroomArticleListItem {
    return {
      id: article.id,
      category: article.category as ClassroomArticleCategory | null,
      title: article.title,
      summary: article.summary,
      coverUrl: article.coverUrl,
      publicUrl: new URL(
        `/articles/${encodeURIComponent(article.id)}`,
        this.config.websitePublicUrl,
      ).toString(),
      status: article.status as AdminClassroomArticleStatus,
      author: article.author,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };
  }

  private async toAdminDetail(
    article: AdminArticleDetailRecord,
  ): Promise<AdminClassroomArticleDetail> {
    return {
      ...this.toAdminListItem(article),
      bodyHtml: await decodeArticleBody(article.content, (assetIds) =>
        this.media.resolvePublicAssets(assetIds),
      ),
    };
  }

  private async requireArticle(id: string) {
    const article = await this.prisma.classroomArticle.findUnique({
      where: { id },
      select: { id: true, category: true, status: true, content: true, coverUrl: true },
    });

    if (!article) {
      throw classroomArticleNotFound();
    }

    return article;
  }
}
