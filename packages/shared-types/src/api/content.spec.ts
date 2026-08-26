import { describe, expect, it } from "vitest";
import {
  ADMIN_CLASSROOM_ARTICLE_STATUS,
  ADMIN_CONTENT_POST_STATUS,
  CLASSROOM_ARTICLE_CATEGORY,
  CLASSROOM_ARTICLE_CATEGORY_LABELS,
  COMMUNITY_MEDIA_ERROR_CODE,
  COMMUNITY_MEDIA_STATUS,
  COMMUNITY_POST_MODERATION_ACTION,
  COMMUNITY_POST_REPORT_REASON,
  COMMUNITY_POST_REPORT_STATUS,
  type AdminClassroomArticleDetail,
  type AdminClassroomArticleListResponse,
  type AdminClassroomArticleStateRequest,
  type AdminContentPostDetail,
  type AdminContentPostListResponse,
  type AdminContentPostStateRequest,
  type AdminContentRewardListResponse,
  type CommunityMediaAsset,
  type CreateCommunityPostRequest,
  type CreateAdminClassroomArticleRequest,
  type MyCommunityPostListResponse,
  type PublicClassroomArticleDetail,
  type PublicClassroomArticleListResponse,
  type PublicCommunityPostDetail,
  type PublicCommunityPostListResponse,
  type UpdateAdminClassroomArticleRequest,
  type UploadAdminClassroomArticleMediaResponse,
} from "./content";

describe("content contracts", () => {
  it("exposes stable status values and unified pagination shapes", () => {
    expect(Object.values(ADMIN_CONTENT_POST_STATUS)).toEqual([
      "pending",
      "published",
      "rejected",
      "offline",
      "deleted",
    ]);
    expect(Object.values(ADMIN_CLASSROOM_ARTICLE_STATUS)).toEqual([
      "draft",
      "published",
      "offline",
    ]);
    expect(Object.values(CLASSROOM_ARTICLE_CATEGORY)).toEqual([
      "feeding_guide",
      "health_management",
      "behavior_training",
      "disease_prevention",
    ]);
    expect(CLASSROOM_ARTICLE_CATEGORY_LABELS[CLASSROOM_ARTICLE_CATEGORY.FEEDING_GUIDE]).toBe(
      "喂养指南",
    );

    const responses: Array<
      | AdminContentRewardListResponse
      | AdminContentPostListResponse
      | AdminClassroomArticleListResponse
    > = [];

    expect(responses).toEqual([]);
  });

  it("keeps community submission author-scoped and pending by contract", () => {
    const media: CommunityMediaAsset = {
      id: "00000000-0000-4000-8000-000000000001",
      url: "https://cdn.example/community.png",
      mimeType: "image/png",
      width: 640,
      height: 480,
      sizeBytes: 1024,
    };
    const create: CreateCommunityPostRequest = {
      content: "今天带旺财散步",
      mediaAssetIds: [media.id],
    };
    const mine: MyCommunityPostListResponse = {
      list: [
        {
          id: "post-1",
          content: create.content,
          mediaUrls: [media.url],
          status: ADMIN_CONTENT_POST_STATUS.PENDING,
          moderationReason: null,
          createdAt: "2026-08-26T08:00:00.000Z",
          updatedAt: "2026-08-26T08:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    expect(mine.list[0].status).toBe("pending");
    expect(COMMUNITY_MEDIA_STATUS.ACTIVE).toBe("active");
    expect(COMMUNITY_MEDIA_ERROR_CODE.STORAGE_UNAVAILABLE).toBe(
      "COMMUNITY_MEDIA_STORAGE_UNAVAILABLE",
    );
  });

  it("records community moderation commands and history with stable actions", () => {
    const request: AdminContentPostStateRequest = {
      expectedUpdatedAt: "2026-08-26T08:00:00.000Z",
      reason: "包含联系方式",
    };
    const detail: AdminContentPostDetail = {
      id: "post-1",
      author: {
        id: "user-1",
        phone: "13800138000",
        username: null,
        nickname: "小明",
        avatar: null,
      },
      contentExcerpt: "今天带旺财散步",
      mediaCount: 1,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      reportsCount: 1,
      status: ADMIN_CONTENT_POST_STATUS.REJECTED,
      createdAt: "2026-08-26T08:00:00.000Z",
      updatedAt: "2026-08-26T08:01:00.000Z",
      content: "今天带旺财散步",
      mediaUrls: ["https://cdn.example/community.png"],
      moderationReason: request.reason ?? null,
      moderationHistory: [
        {
          id: "event-1",
          action: COMMUNITY_POST_MODERATION_ACTION.REJECT,
          previousStatus: ADMIN_CONTENT_POST_STATUS.PENDING,
          nextStatus: ADMIN_CONTENT_POST_STATUS.REJECTED,
          reason: request.reason ?? null,
          operator: {
            id: "admin-1",
            phone: "17679141879",
            username: "operator",
            nickname: "运营",
            avatar: null,
          },
          createdAt: "2026-08-26T08:01:00.000Z",
        },
      ],
    };

    expect(Object.values(COMMUNITY_POST_MODERATION_ACTION)).toEqual([
      "approve",
      "reject",
      "offline",
    ]);
    expect(detail.moderationHistory[0].reason).toBe("包含联系方式");
  });

  it("defines controlled community report reasons and lifecycle states", () => {
    expect(Object.values(COMMUNITY_POST_REPORT_REASON)).toEqual([
      "spam",
      "harassment",
      "inappropriate",
      "privacy",
      "other",
    ]);
    expect(Object.values(COMMUNITY_POST_REPORT_STATUS)).toEqual(["pending", "resolved"]);
  });

  it("keeps public community posts free of private and unsupported interaction fields", () => {
    const list: PublicCommunityPostListResponse = {
      list: [
        {
          id: "post-1",
          author: { displayName: "旺财家长", avatar: null },
          content: "今天带旺财散步",
          mediaUrls: ["https://cdn.example/community.png"],
          createdAt: "2026-08-26T08:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    const detail: PublicCommunityPostDetail = list.list[0];

    expect(detail.author.displayName).toBe("旺财家长");
    expect("phone" in detail.author).toBe(false);
    expect("moderationReason" in detail).toBe(false);
    expect("likesCount" in detail).toBe(false);
  });

  it("keeps official website article contracts limited to public fields", () => {
    const list: PublicClassroomArticleListResponse = {
      list: [
        {
          slug: "article-id",
          category: CLASSROOM_ARTICLE_CATEGORY.HEALTH_MANAGEMENT,
          title: "Article title",
          summary: "Article summary",
          coverUrl: null,
          author: { displayName: "Author", avatar: null },
          publishedAt: "2026-08-01T09:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    const detail: PublicClassroomArticleDetail = {
      ...list.list[0],
      bodyHtml: "<p>Plain text</p>",
    };

    expect(detail.slug).toBe("article-id");
    expect(detail.category).toBe(CLASSROOM_ARTICLE_CATEGORY.HEALTH_MANAGEMENT);
    expect("status" in detail).toBe(false);
  });

  it("defines editable classroom article requests and safe public HTML", () => {
    const detail: AdminClassroomArticleDetail = {
      id: "article-1",
      category: CLASSROOM_ARTICLE_CATEGORY.FEEDING_GUIDE,
      title: "幼犬喂养课堂",
      summary: "基础喂养知识",
      coverUrl: null,
      status: "draft",
      author: null,
      publishedAt: null,
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
      publicUrl: "https://petcare-home.com/articles/article-1",
      bodyHtml: "<p>正文</p>",
    };
    const create: CreateAdminClassroomArticleRequest = {
      category: CLASSROOM_ARTICLE_CATEGORY.FEEDING_GUIDE,
      title: "幼犬喂养课堂",
      summary: "基础喂养知识",
      bodyHtml: "<p>正文</p>",
      coverAssetId: null,
    };
    const update: UpdateAdminClassroomArticleRequest = {
      ...create,
      expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
    };
    const state: AdminClassroomArticleStateRequest = {
      expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
    };
    const publicDetail: PublicClassroomArticleDetail = {
      slug: "article-1",
      category: CLASSROOM_ARTICLE_CATEGORY.FEEDING_GUIDE,
      title: "幼犬喂养课堂",
      summary: "基础喂养知识",
      coverUrl: null,
      author: null,
      publishedAt: "2026-08-24T00:00:00.000Z",
      bodyHtml: "<p>正文</p>",
    };
    const media: UploadAdminClassroomArticleMediaResponse = {
      id: "media-1",
      url: "https://petcare-home.com/media/media-1.webp",
      width: 640,
      height: 480,
      mimeType: "image/webp",
    };

    expect({ detail, update, state, publicDetail, create, media }).toBeDefined();
  });
});
