import { ContentService } from "./content.service";

describe("ContentService", () => {
  const prisma = {
    order: { findMany: jest.fn(), count: jest.fn() },
    post: { findMany: jest.fn(), count: jest.fn() },
    classroomArticle: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
  };
  const service = new ContentService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queries reward orders with a fixed reward type and returns yuan amounts", async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: "reward-1",
        serviceType: "feeding",
        status: "pending_confirm",
        serviceTime: new Date("2026-08-01T10:00:00.000Z"),
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
        reward: { rewardAmount: 12500 },
        owner: {
          id: "user-1",
          phone: "13800138000",
          username: "owner",
          nickname: "小明",
          avatar: null,
        },
        pet: { id: "pet-1", name: "团团", breed: "金毛" },
      },
    ]);
    prisma.order.count.mockResolvedValue(1);

    await expect(
      service.findRewardPage({ page: 2, pageSize: 10, keyword: "小明", status: "pending_confirm" }),
    ).resolves.toMatchObject({
      list: [{ id: "reward-1", rewardAmount: 125, owner: { nickname: "小明" } }],
      total: 1,
      page: 2,
      pageSize: 10,
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ orderType: "reward" }, { status: "pending_confirm" }]),
        }),
      }),
    );
  });

  it("returns post excerpts and media counts without leaking full content", async () => {
    prisma.post.findMany.mockResolvedValue([
      {
        id: "post-1",
        content: "  这是一段帖子正文  ",
        mediaUrls: ["a.jpg", "b.jpg"],
        likesCount: 3,
        commentsCount: 2,
        sharesCount: 1,
        status: "published",
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
        updatedAt: new Date("2026-08-01T09:00:00.000Z"),
        author: {
          id: "user-1",
          phone: "13800138000",
          username: null,
          nickname: "小明",
          avatar: null,
        },
      },
    ]);
    prisma.post.count.mockResolvedValue(1);

    await expect(service.findPostPage({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      list: [{ contentExcerpt: "这是一段帖子正文", mediaCount: 2 }],
    });
  });

  it("returns classroom article metadata with nullable publication time", async () => {
    prisma.classroomArticle.findMany.mockResolvedValue([
      {
        id: "article-1",
        title: "幼犬喂养课堂",
        summary: "基础喂养知识",
        coverUrl: null,
        status: "draft",
        publishedAt: null,
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
        updatedAt: new Date("2026-08-01T09:00:00.000Z"),
        author: null,
      },
    ]);
    prisma.classroomArticle.count.mockResolvedValue(1);

    await expect(
      service.findArticlePage({ page: 1, pageSize: 20, status: "draft" }),
    ).resolves.toMatchObject({
      list: [{ title: "幼犬喂养课堂", status: "draft", publishedAt: null, author: null }],
    });

    expect(prisma.classroomArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ status: "draft" }] },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("returns only published classroom articles through the public page seam", async () => {
    prisma.classroomArticle.findMany.mockResolvedValue([
      {
        id: "article-public-1",
        title: "\u5e7c\u732b\u55c2\u517b\u8bfe\u5802",
        summary: "\u57fa\u7840\u55c2\u517b\u77e5\u8bc6",
        coverUrl: "https://example.com/cover.jpg",
        publishedAt: new Date("2026-08-01T09:00:00.000Z"),
        author: { nickname: "\u5ba0\u7269\u533b\u751f", username: "doctor", avatar: null },
      },
    ]);
    prisma.classroomArticle.count.mockResolvedValue(1);

    await expect(service.findPublishedArticlePage({ page: 1, pageSize: 20 })).resolves.toEqual({
      list: [
        {
          slug: "article-public-1",
          title: "\u5e7c\u732b\u55c2\u517b\u8bfe\u5802",
          summary: "\u57fa\u7840\u55c2\u517b\u77e5\u8bc6",
          coverUrl: "https://example.com/cover.jpg",
          author: { displayName: "\u5ba0\u7269\u533b\u751f", avatar: null },
          publishedAt: "2026-08-01T09:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(prisma.classroomArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "published" },
        orderBy: { publishedAt: "desc" },
      }),
    );
  });

  it("reads a published article by its stable id slug and returns escaped plain text", async () => {
    prisma.classroomArticle.findFirst.mockResolvedValue({
      id: "article-public-1",
      title: "\u5e7c\u732b\u55c2\u517b\u8bfe\u5802",
      summary: "\u57fa\u7840\u55c2\u517b\u77e5\u8bc6",
      coverUrl: null,
      content: "<h1>\u4e0d\u53ef\u4fe1\u4efb</h1> & \u5b89\u5168",
      publishedAt: new Date("2026-08-01T09:00:00.000Z"),
      author: { nickname: "", username: "doctor", avatar: "https://example.com/avatar.jpg" },
    });

    await expect(service.findPublishedArticleBySlug("article-public-1")).resolves.toEqual({
      slug: "article-public-1",
      title: "\u5e7c\u732b\u55c2\u517b\u8bfe\u5802",
      summary: "\u57fa\u7840\u55c2\u517b\u77e5\u8bc6",
      coverUrl: null,
      author: { displayName: "doctor", avatar: "https://example.com/avatar.jpg" },
      publishedAt: "2026-08-01T09:00:00.000Z",
      body: "&lt;h1&gt;\u4e0d\u53ef\u4fe1\u4efb&lt;/h1&gt; &amp; \u5b89\u5168",
    });

    expect(prisma.classroomArticle.findFirst).toHaveBeenCalledWith({
      where: { id: "article-public-1", status: "published" },
      select: expect.any(Object),
    });
  });

  it("does not reveal draft, offline, or missing articles through the public detail seam", async () => {
    prisma.classroomArticle.findFirst.mockResolvedValue(null);

    await expect(service.findPublishedArticleBySlug("draft-or-missing")).rejects.toMatchObject({
      status: 404,
    });

    expect(prisma.classroomArticle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "draft-or-missing", status: "published" } }),
    );
  });
});
