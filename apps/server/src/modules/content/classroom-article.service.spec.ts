import { ClassroomArticleService } from "./classroom-article.service";

describe("ClassroomArticleService", () => {
  const prisma = {
    classroomArticle: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const media = { resolvePublicAsset: jest.fn(), resolvePublicAssets: jest.fn() };
  const service = new ClassroomArticleService(
    prisma as never,
    media as never,
    { websitePublicUrl: "https://petcare-home.com" } as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
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
      list: [
        {
          title: "幼犬喂养课堂",
          status: "draft",
          publishedAt: null,
          author: null,
          publicUrl: "https://petcare-home.com/articles/article-1",
        },
      ],
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
        title: "幼猫喂养课堂",
        summary: "基础喂养知识",
        coverUrl: "https://example.com/cover.jpg",
        publishedAt: new Date("2026-08-01T09:00:00.000Z"),
        author: { nickname: "宠物医生", username: "doctor", avatar: null },
      },
    ]);
    prisma.classroomArticle.count.mockResolvedValue(1);

    await expect(service.findPublishedArticlePage({ page: 1, pageSize: 20 })).resolves.toEqual({
      list: [
        {
          slug: "article-public-1",
          title: "幼猫喂养课堂",
          summary: "基础喂养知识",
          coverUrl: "https://example.com/cover.jpg",
          author: { displayName: "宠物医生", avatar: null },
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

  it("reads a published article by its stable id slug and escapes HTML-looking legacy text", async () => {
    prisma.classroomArticle.findFirst.mockResolvedValue({
      id: "article-public-1",
      title: "幼猫喂养课堂",
      summary: "基础喂养知识",
      coverUrl: null,
      content: '<script>alert("x")</script>\n护理正文',
      publishedAt: new Date("2026-08-01T09:00:00.000Z"),
      author: { nickname: "", username: "doctor", avatar: "https://example.com/avatar.jpg" },
    });

    await expect(service.findPublishedArticleBySlug("article-public-1")).resolves.toEqual({
      slug: "article-public-1",
      title: "幼猫喂养课堂",
      summary: "基础喂养知识",
      coverUrl: null,
      author: { displayName: "doctor", avatar: "https://example.com/avatar.jpg" },
      publishedAt: "2026-08-01T09:00:00.000Z",
      bodyHtml: "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p><p>护理正文</p>",
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

  it("creates a draft with the current administrator and v1 content", async () => {
    prisma.classroomArticle.create.mockResolvedValue({
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: null,
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      status: "draft",
      publishedAt: null,
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
      author: null,
    });

    await service.createDraft("admin-1", {
      title: " 幼犬喂养课堂 ",
      summary: " 基础知识 ",
      bodyHtml: "<p>正文</p>",
      coverAssetId: null,
    });

    expect(prisma.classroomArticle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "幼犬喂养课堂",
          summary: "基础知识",
          status: "draft",
          authorId: "admin-1",
          coverUrl: null,
          content: expect.stringMatching(/^PETCARE_CLASSROOM_RICH_TEXT_V1\n/u),
        }),
      }),
    );
  });

  it("resolves inline images only through the managed media service", async () => {
    const image = {
      id: "asset-body-1",
      url: "https://cdn.example.com/body.png",
      width: 800,
      height: 600,
      mimeType: "image/png",
    };

    media.resolvePublicAssets.mockResolvedValue(new Map([[image.id, image]]));
    prisma.classroomArticle.create.mockResolvedValue({
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: null,
      content:
        'PETCARE_CLASSROOM_RICH_TEXT_V1\n<img src="https://cdn.example.com/body.png" alt="" data-asset-id="asset-body-1" />',
      status: "draft",
      publishedAt: null,
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
      author: null,
    });

    await service.createDraft("admin-1", {
      title: "幼犬喂养课堂",
      summary: "基础知识",
      bodyHtml: '<img src="https://cdn.example.com/body.png" data-asset-id="asset-body-1">',
    });

    expect(media.resolvePublicAssets).toHaveBeenCalledWith(["asset-body-1"]);
  });

  it("returns an admin article detail with its server-generated public URL", async () => {
    prisma.classroomArticle.findUnique.mockResolvedValue({
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: null,
      content: "护理正文",
      status: "offline",
      publishedAt: null,
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
      author: null,
    });

    await expect(service.findAdminArticle("article-1")).resolves.toMatchObject({
      id: "article-1",
      publicUrl: "https://petcare-home.com/articles/article-1",
      bodyHtml: "<p>护理正文</p>",
    });
  });

  it("rejects editing a published article", async () => {
    prisma.classroomArticle.findUnique.mockResolvedValue({
      id: "article-1",
      status: "published",
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      coverUrl: null,
    });

    await expect(
      service.updateEditable("article-1", {
        title: "幼犬喂养课堂",
        summary: "更新后的基础知识",
        bodyHtml: "<p>正文</p>",
        expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_STATE_CONFLICT", status: 409 });
    expect(prisma.classroomArticle.updateMany).not.toHaveBeenCalled();
  });

  it("retains an omitted cover while updating an offline article", async () => {
    const observedAt = new Date("2026-08-24T00:00:00.000Z");
    const article = {
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: "https://cdn.example.com/old-cover.png",
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      status: "offline",
      publishedAt: null,
      createdAt: observedAt,
      updatedAt: observedAt,
      author: null,
    };

    prisma.classroomArticle.findUnique.mockResolvedValue(article);
    prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });

    await service.updateEditable("article-1", {
      title: " 幼犬喂养课堂 ",
      summary: " 更新后的基础知识 ",
      bodyHtml: "<p>正文</p>",
      expectedUpdatedAt: observedAt.toISOString(),
    });

    expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith({
      where: {
        id: "article-1",
        status: { in: ["draft", "offline"] },
        updatedAt: observedAt,
      },
      data: {
        title: "幼犬喂养课堂",
        summary: "更新后的基础知识",
        coverUrl: "https://cdn.example.com/old-cover.png",
        content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      },
    });
    expect(media.resolvePublicAsset).not.toHaveBeenCalled();
  });

  it("clears a cover when its managed asset id is null", async () => {
    const observedAt = new Date("2026-08-24T00:00:00.000Z");
    const article = {
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: "https://cdn.example.com/old-cover.png",
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      status: "draft",
      publishedAt: null,
      createdAt: observedAt,
      updatedAt: observedAt,
      author: null,
    };

    prisma.classroomArticle.findUnique.mockResolvedValue(article);
    prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });

    await service.updateEditable("article-1", {
      title: "幼犬喂养课堂",
      summary: "更新后的基础知识",
      bodyHtml: "<p>正文</p>",
      coverAssetId: null,
      expectedUpdatedAt: observedAt.toISOString(),
    });

    expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ coverUrl: null }) }),
    );
  });

  it("replaces a cover only through the managed media service", async () => {
    const observedAt = new Date("2026-08-24T00:00:00.000Z");
    const article = {
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: null,
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      status: "draft",
      publishedAt: null,
      createdAt: observedAt,
      updatedAt: observedAt,
      author: null,
    };

    prisma.classroomArticle.findUnique.mockResolvedValue(article);
    prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });
    media.resolvePublicAsset.mockResolvedValue({
      id: "asset-cover-1",
      url: "https://cdn.example.com/new-cover.png",
      width: 800,
      height: 600,
      mimeType: "image/png",
    });

    await service.updateEditable("article-1", {
      title: "幼犬喂养课堂",
      summary: "更新后的基础知识",
      bodyHtml: "<p>正文</p>",
      coverAssetId: "asset-cover-1",
      expectedUpdatedAt: observedAt.toISOString(),
    });

    expect(media.resolvePublicAsset).toHaveBeenCalledWith("asset-cover-1");
    expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coverUrl: "https://cdn.example.com/new-cover.png" }),
      }),
    );
  });

  it("returns a concurrent update conflict when the observed timestamp no longer matches", async () => {
    prisma.classroomArticle.findUnique.mockResolvedValue({
      id: "article-1",
      status: "draft",
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      coverUrl: null,
    });
    prisma.classroomArticle.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateEditable("article-1", {
        title: "幼犬喂养课堂",
        summary: "更新后的基础知识",
        bodyHtml: "<p>正文</p>",
        expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_CONCURRENT_UPDATE", status: 409 });
  });

  it("publishes a non-empty draft with a fresh publication timestamp", async () => {
    const observedAt = new Date("2026-08-24T00:00:00.000Z");
    const article = {
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: null,
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      status: "draft",
      publishedAt: null,
      createdAt: observedAt,
      updatedAt: observedAt,
      author: null,
    };

    prisma.classroomArticle.findUnique.mockResolvedValue(article);
    prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });
    const publishedAt = new Date("2026-08-24T02:00:00.000Z");

    jest.useFakeTimers();
    jest.setSystemTime(publishedAt);

    try {
      await service.publish("article-1", { expectedUpdatedAt: observedAt.toISOString() });
    } finally {
      jest.useRealTimers();
    }

    expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith({
      where: {
        id: "article-1",
        status: { in: ["draft", "offline"] },
        updatedAt: observedAt,
      },
      data: { status: "published", publishedAt },
    });
  });

  it("sets a fresh publication timestamp when republishing an offline article", async () => {
    const observedAt = new Date("2026-08-24T00:00:00.000Z");
    const article = {
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: null,
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      status: "offline",
      publishedAt: new Date("2026-08-24T01:00:00.000Z"),
      createdAt: observedAt,
      updatedAt: observedAt,
      author: null,
    };

    prisma.classroomArticle.findUnique.mockResolvedValue(article);
    prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });
    const republishedAt = new Date("2026-08-24T03:00:00.000Z");

    jest.useFakeTimers();
    jest.setSystemTime(republishedAt);

    try {
      await service.publish("article-1", { expectedUpdatedAt: observedAt.toISOString() });
    } finally {
      jest.useRealTimers();
    }

    expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "published", publishedAt: republishedAt } }),
    );
  });

  it("rejects publishing an empty cleaned body", async () => {
    prisma.classroomArticle.findUnique.mockResolvedValue({
      id: "article-1",
      status: "draft",
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p><br /></p>",
      coverUrl: null,
    });

    await expect(
      service.publish("article-1", { expectedUpdatedAt: "2026-08-24T00:00:00.000Z" }),
    ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_INVALID_CONTENT", status: 400 });
    expect(prisma.classroomArticle.updateMany).not.toHaveBeenCalled();
  });

  it("publishes an article whose body consists of one verified managed image", async () => {
    const observedAt = new Date("2026-08-24T00:00:00.000Z");
    const image = {
      id: "asset-body-1",
      url: "https://cdn.example.com/body.png",
      width: 800,
      height: 600,
      mimeType: "image/png",
    };

    prisma.classroomArticle.findUnique.mockResolvedValue({
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: null,
      content:
        'PETCARE_CLASSROOM_RICH_TEXT_V1\n<img src="https://cdn.example.com/body.png" alt="" data-asset-id="asset-body-1" />',
      status: "draft",
      publishedAt: null,
      createdAt: observedAt,
      updatedAt: observedAt,
      author: null,
    });
    media.resolvePublicAssets.mockResolvedValue(new Map([[image.id, image]]));
    prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });

    await service.publish("article-1", { expectedUpdatedAt: observedAt.toISOString() });

    expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "published" }) }),
    );
  });

  it("offlines a published article without changing its publication timestamp", async () => {
    const observedAt = new Date("2026-08-24T00:00:00.000Z");
    const publishedAt = new Date("2026-08-24T01:00:00.000Z");

    prisma.classroomArticle.findUnique.mockResolvedValue({
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础知识",
      coverUrl: null,
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      status: "published",
      publishedAt,
      createdAt: observedAt,
      updatedAt: observedAt,
      author: null,
    });
    prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });

    await service.offline("article-1", { expectedUpdatedAt: observedAt.toISOString() });

    expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith({
      where: { id: "article-1", status: "published", updatedAt: observedAt },
      data: { status: "offline" },
    });
  });

  it.each([
    ["publish", "published"],
    ["offline", "draft"],
  ] as const)("rejects %s from %s", async (action, status) => {
    prisma.classroomArticle.findUnique.mockResolvedValue({
      id: "article-1",
      status,
      content: "PETCARE_CLASSROOM_RICH_TEXT_V1\n<p>正文</p>",
      coverUrl: null,
    });

    const request = { expectedUpdatedAt: "2026-08-24T00:00:00.000Z" };
    const operation =
      action === "publish" ? service.publish.bind(service) : service.offline.bind(service);

    await expect(operation("article-1", request)).rejects.toMatchObject({
      code: "CONTENT_ARTICLE_STATE_CONFLICT",
      status: 409,
    });
  });

  it("returns a stable not-found error for a missing article write", async () => {
    prisma.classroomArticle.findUnique.mockResolvedValue(null);

    await expect(
      service.publish("missing", { expectedUpdatedAt: "2026-08-24T00:00:00.000Z" }),
    ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_NOT_FOUND", status: 404 });
  });
});
