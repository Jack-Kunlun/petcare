import {
  ADMIN_CONTENT_POST_STATUS,
  COMMUNITY_MEDIA_ERROR_CODE,
  COMMUNITY_MEDIA_STATUS,
} from "@petcare/shared-types";
import { CommunityPostService } from "./community-post.service";

describe("CommunityPostService", () => {
  const prisma = {
    post: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    communityMediaAsset: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    communityPostReport: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    communityPostLike: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const storage = {
    resolvePublicUrl: jest.fn((key: string) => `https://cdn.example/${key}`),
  };
  const rateLimits = { assertPostCreateAllowed: jest.fn() };
  const service = new CommunityPostService(prisma as never, storage as never, rateLimits as never);

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimits.assertPostCreateAllowed.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(
      async (operation: (transaction: typeof prisma) => Promise<unknown>) => operation(prisma),
    );
    prisma.communityMediaAsset.findMany.mockResolvedValue([]);
    prisma.communityMediaAsset.updateMany.mockResolvedValue({ count: 0 });
    prisma.communityPostReport.findMany.mockResolvedValue([]);
    prisma.communityPostReport.updateMany.mockResolvedValue({ count: 0 });
    prisma.communityPostLike.createMany.mockResolvedValue({ count: 0 });
    prisma.communityPostLike.deleteMany.mockResolvedValue({ count: 0 });
    prisma.communityPostLike.findUnique.mockResolvedValue(null);
  });

  it("trims text and creates a pending text-only post", async () => {
    prisma.post.create.mockResolvedValue({
      id: "post-1",
      content: "今天带旺财散步",
      mediaUrls: [],
      status: "pending",
      moderationReason: null,
      createdAt: new Date("2026-08-26T08:00:00.000Z"),
      updatedAt: new Date("2026-08-26T08:00:00.000Z"),
    });

    await expect(
      service.create("user-1", { content: "  今天带旺财散步  " }),
    ).resolves.toMatchObject({
      id: "post-1",
      content: "今天带旺财散步",
      mediaUrls: [],
      status: ADMIN_CONTENT_POST_STATUS.PENDING,
    });
    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          authorId: "user-1",
          content: "今天带旺财散步",
          mediaUrls: [],
          tags: [],
          status: ADMIN_CONTENT_POST_STATUS.PENDING,
        },
      }),
    );
    expect(rateLimits.assertPostCreateAllowed).toHaveBeenCalledWith("user-1");
  });

  it("does not write a post when the publishing limiter rejects it", async () => {
    rateLimits.assertPostCreateAllowed.mockRejectedValueOnce({
      code: "COMMUNITY_POST_RATE_LIMITED",
    });

    await expect(service.create("user-1", { content: "受限动态" })).rejects.toMatchObject({
      code: "COMMUNITY_POST_RATE_LIMITED",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it("atomically binds owned active media in request order", async () => {
    prisma.communityMediaAsset.findMany.mockResolvedValue([
      {
        id: "asset-2",
        ownerId: "user-1",
        postId: null,
        status: COMMUNITY_MEDIA_STATUS.ACTIVE,
        storageKey: "public/community-media/2.png",
      },
      {
        id: "asset-1",
        ownerId: "user-1",
        postId: null,
        status: COMMUNITY_MEDIA_STATUS.ACTIVE,
        storageKey: "public/community-media/1.png",
      },
    ]);
    prisma.post.create.mockResolvedValue({
      id: "post-1",
      content: "两张图片",
      mediaUrls: [
        "https://cdn.example/public/community-media/1.png",
        "https://cdn.example/public/community-media/2.png",
      ],
      status: "pending",
      moderationReason: null,
      createdAt: new Date("2026-08-26T08:00:00.000Z"),
      updatedAt: new Date("2026-08-26T08:00:00.000Z"),
    });
    prisma.communityMediaAsset.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.create("user-1", {
        content: "两张图片",
        mediaAssetIds: ["asset-1", "asset-2"],
      }),
    ).resolves.toMatchObject({ id: "post-1", mediaUrls: expect.any(Array) });
    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaUrls: [
            "https://cdn.example/public/community-media/1.png",
            "https://cdn.example/public/community-media/2.png",
          ],
        }),
      }),
    );
    expect(prisma.communityMediaAsset.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["asset-1", "asset-2"] },
        ownerId: "user-1",
        status: COMMUNITY_MEDIA_STATUS.ACTIVE,
        postId: null,
      },
      data: { postId: "post-1" },
    });
  });

  it("rejects media owned by another user", async () => {
    prisma.communityMediaAsset.findMany.mockResolvedValue([
      {
        id: "asset-1",
        ownerId: "user-2",
        postId: null,
        status: COMMUNITY_MEDIA_STATUS.ACTIVE,
        storageKey: "public/community-media/1.png",
      },
    ]);

    await expect(
      service.create("user-1", { content: "越权", mediaAssetIds: ["asset-1"] }),
    ).rejects.toMatchObject({ code: COMMUNITY_MEDIA_ERROR_CODE.MEDIA_FORBIDDEN });
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      status: COMMUNITY_MEDIA_STATUS.DISCARDED,
      postId: null,
      code: COMMUNITY_MEDIA_ERROR_CODE.INVALID_MEDIA,
    },
    {
      status: COMMUNITY_MEDIA_STATUS.ACTIVE,
      postId: "post-existing",
      code: COMMUNITY_MEDIA_ERROR_CODE.MEDIA_CONFLICT,
    },
  ])("rejects unavailable media with $code", async ({ status, postId, code }) => {
    prisma.communityMediaAsset.findMany.mockResolvedValue([
      {
        id: "asset-1",
        ownerId: "user-1",
        postId,
        status,
        storageKey: "public/community-media/1.png",
      },
    ]);

    await expect(
      service.create("user-1", { content: "不可用", mediaAssetIds: ["asset-1"] }),
    ).rejects.toMatchObject({ code });
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it("rejects a concurrent second binding so its transaction can roll back", async () => {
    prisma.communityMediaAsset.findMany.mockResolvedValue([
      {
        id: "asset-1",
        ownerId: "user-1",
        postId: null,
        status: COMMUNITY_MEDIA_STATUS.ACTIVE,
        storageKey: "public/community-media/1.png",
      },
    ]);
    prisma.post.create.mockResolvedValue({
      id: "post-race",
      content: "并发",
      mediaUrls: ["https://cdn.example/public/community-media/1.png"],
      status: "pending",
      moderationReason: null,
      createdAt: new Date("2026-08-26T08:00:00.000Z"),
      updatedAt: new Date("2026-08-26T08:00:00.000Z"),
    });
    prisma.communityMediaAsset.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.create("user-1", { content: "并发", mediaAssetIds: ["asset-1"] }),
    ).rejects.toMatchObject({ code: COMMUNITY_MEDIA_ERROR_CODE.MEDIA_CONFLICT });
  });

  it("rejects duplicate and excessive media before opening a transaction", async () => {
    await expect(
      service.create("user-1", { content: "重复", mediaAssetIds: ["same", "same"] }),
    ).rejects.toMatchObject({ code: COMMUNITY_MEDIA_ERROR_CODE.INVALID_MEDIA });
    await expect(
      service.create("user-1", {
        content: "太多",
        mediaAssetIds: Array.from({ length: 10 }, (_, index) => `asset-${index}`),
      }),
    ).rejects.toMatchObject({ code: COMMUNITY_MEDIA_ERROR_CODE.INVALID_MEDIA });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("scopes moderation reads to the author and only exposes rejection reasons", async () => {
    prisma.post.findMany.mockResolvedValue([
      {
        id: "post-rejected",
        content: "被驳回的动态",
        mediaUrls: ["https://cdn.example/1.png"],
        status: "rejected",
        moderationReason: "包含联系方式",
        createdAt: new Date("2026-08-26T08:00:00.000Z"),
        updatedAt: new Date("2026-08-26T08:10:00.000Z"),
      },
      {
        id: "post-offline",
        content: "已下架的动态",
        mediaUrls: [],
        status: "offline",
        moderationReason: "运营下架原因",
        createdAt: new Date("2026-08-25T08:00:00.000Z"),
        updatedAt: new Date("2026-08-26T08:20:00.000Z"),
      },
    ]);
    prisma.post.count.mockResolvedValue(2);

    await expect(service.findMine("user-1", { page: 2, pageSize: 10 })).resolves.toMatchObject({
      list: [
        {
          id: "post-rejected",
          mediaUrls: ["https://cdn.example/1.png"],
          moderationReason: "包含联系方式",
        },
        { id: "post-offline", moderationReason: null },
      ],
      total: 2,
      page: 2,
      pageSize: 10,
    });
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: "user-1", status: { not: ADMIN_CONTENT_POST_STATUS.DELETED } },
        skip: 10,
        take: 10,
      }),
    );
  });

  it("exposes a legacy draft as pending", async () => {
    prisma.post.findMany.mockResolvedValue([
      {
        id: "post-legacy",
        content: "历史动态",
        mediaUrls: [],
        status: "draft",
        moderationReason: null,
        createdAt: new Date("2026-08-26T08:00:00.000Z"),
        updatedAt: new Date("2026-08-26T08:00:00.000Z"),
      },
    ]);
    prisma.post.count.mockResolvedValue(1);

    await expect(service.findMine("user-1", { page: 1, pageSize: 20 })).resolves.toMatchObject({
      list: [{ id: "post-legacy", status: ADMIN_CONTENT_POST_STATUS.PENDING }],
    });
  });

  it("lists only published posts with safe public author fields", async () => {
    prisma.post.findMany.mockResolvedValue([
      {
        id: "post-public",
        content: "公开动态",
        mediaUrls: ["https://cdn.example/1.png"],
        likesCount: 3,
        commentsCount: 2,
        createdAt: new Date("2026-08-26T08:00:00.000Z"),
        author: { nickname: "  ", username: "public-user", avatar: null },
      },
    ]);
    prisma.post.count.mockResolvedValue(1);

    await expect(service.findPublished({ page: 2, pageSize: 10 })).resolves.toEqual({
      list: [
        {
          id: "post-public",
          author: { displayName: "public-user", avatar: null },
          content: "公开动态",
          mediaUrls: ["https://cdn.example/1.png"],
          likesCount: 3,
          commentsCount: 2,
          createdAt: "2026-08-26T08:00:00.000Z",
        },
      ],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
        skip: 10,
        take: 10,
      }),
    );
  });

  it("uses the same not-found response for missing and non-public post detail", async () => {
    prisma.post.findFirst.mockResolvedValue(null);

    await expect(service.findPublishedById("post-private")).rejects.toMatchObject({
      code: "CONTENT_POST_NOT_FOUND",
    });
    expect(prisma.post.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post-private", status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
      }),
    );
  });

  it("reads the current user's like state only for a published post", async () => {
    prisma.post.findFirst.mockResolvedValue({ likesCount: 4 });
    prisma.communityPostLike.findUnique.mockResolvedValue({ id: "like-1" });

    await expect(service.findLikeState("user-1", "post-1")).resolves.toEqual({
      liked: true,
      likesCount: 4,
    });
    expect(prisma.communityPostLike.findUnique).toHaveBeenCalledWith({
      where: { postId_userId: { postId: "post-1", userId: "user-1" } },
      select: { id: true },
    });

    prisma.post.findFirst.mockResolvedValueOnce(null);
    await expect(service.findLikeState("user-1", "post-private")).rejects.toMatchObject({
      code: "CONTENT_POST_NOT_FOUND",
    });
  });

  it("idempotently likes a published post and increments its count once", async () => {
    prisma.post.findFirst
      .mockResolvedValueOnce({ id: "post-1" })
      .mockResolvedValueOnce({ likesCount: 4 })
      .mockResolvedValueOnce({ id: "post-1" })
      .mockResolvedValueOnce({ likesCount: 4 });
    prisma.communityPostLike.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.post.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.like("user-1", "post-1")).resolves.toEqual({
      liked: true,
      likesCount: 4,
    });
    await expect(service.like("user-1", "post-1")).resolves.toEqual({
      liked: true,
      likesCount: 4,
    });

    expect(prisma.communityPostLike.createMany).toHaveBeenCalledWith({
      data: { postId: "post-1", userId: "user-1" },
      skipDuplicates: true,
    });
    expect(prisma.post.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: "post-1", status: ADMIN_CONTENT_POST_STATUS.PUBLISHED },
      data: { likesCount: { increment: 1 } },
    });
  });

  it("idempotently removes a like and never decrements twice", async () => {
    prisma.post.findFirst
      .mockResolvedValueOnce({ id: "post-1" })
      .mockResolvedValueOnce({ likesCount: 3 })
      .mockResolvedValueOnce({ id: "post-1" })
      .mockResolvedValueOnce({ likesCount: 3 });
    prisma.communityPostLike.deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.post.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.unlike("user-1", "post-1")).resolves.toEqual({
      liked: false,
      likesCount: 3,
    });
    await expect(service.unlike("user-1", "post-1")).resolves.toEqual({
      liked: false,
      likesCount: 3,
    });

    expect(prisma.post.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: {
        id: "post-1",
        status: ADMIN_CONTENT_POST_STATUS.PUBLISHED,
        likesCount: { gt: 0 },
      },
      data: { likesCount: { decrement: 1 } },
    });
  });

  it("does not create a like for a non-public post", async () => {
    prisma.post.findFirst.mockResolvedValue(null);

    await expect(service.like("user-1", "post-private")).rejects.toMatchObject({
      code: "CONTENT_POST_NOT_FOUND",
    });
    expect(prisma.communityPostLike.createMany).not.toHaveBeenCalled();
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });

  it("accepts one trimmed report for a published post", async () => {
    prisma.post.findFirst.mockResolvedValue({ authorId: "author-1" });
    prisma.communityPostReport.create.mockResolvedValue({
      id: "report-1",
      status: "pending",
      createdAt: new Date("2026-08-26T09:00:00.000Z"),
    });

    await expect(
      service.report("reporter-1", "post-1", {
        reason: "spam",
        description: "  重复广告  ",
      }),
    ).resolves.toEqual({
      id: "report-1",
      status: "pending",
      createdAt: "2026-08-26T09:00:00.000Z",
    });
    expect(prisma.communityPostReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          postId: "post-1",
          reporterId: "reporter-1",
          reason: "spam",
          description: "重复广告",
        }),
      }),
    );
  });

  it("rejects non-public, self, and duplicate reports without extra records", async () => {
    prisma.post.findFirst.mockResolvedValueOnce(null);
    await expect(service.report("reporter-1", "post-1", { reason: "spam" })).rejects.toMatchObject({
      code: "CONTENT_POST_NOT_FOUND",
    });

    prisma.post.findFirst.mockResolvedValueOnce({ authorId: "reporter-1" });
    await expect(service.report("reporter-1", "post-1", { reason: "spam" })).rejects.toMatchObject({
      code: "CONTENT_POST_REPORT_SELF",
    });

    prisma.post.findFirst.mockResolvedValueOnce({ authorId: "author-1" });
    prisma.communityPostReport.create.mockRejectedValueOnce({ code: "P2002" });
    await expect(service.report("reporter-1", "post-1", { reason: "spam" })).rejects.toMatchObject({
      code: "CONTENT_POST_REPORT_DUPLICATE",
    });
    expect(prisma.communityPostReport.create).toHaveBeenCalledTimes(1);
  });

  it("returns newest reports with reporter and related post context", async () => {
    prisma.post.findUnique.mockResolvedValue({ id: "post-1" });
    prisma.communityPostReport.findMany.mockResolvedValue([
      {
        id: "report-1",
        reason: "harassment",
        description: "辱骂",
        status: "pending",
        createdAt: new Date("2026-08-26T09:00:00.000Z"),
        resolvedAt: null,
        reporter: {
          id: "reporter-1",
          phone: "13800138000",
          username: null,
          nickname: "举报人",
          avatar: null,
        },
        post: { id: "post-1", status: "published" },
      },
    ]);

    await expect(service.findReportsForAdmin("post-1")).resolves.toMatchObject({
      total: 1,
      list: [
        {
          id: "report-1",
          reason: "harassment",
          reporter: { id: "reporter-1" },
          post: { id: "post-1", status: "published" },
          createdAt: "2026-08-26T09:00:00.000Z",
        },
      ],
    });
  });

  it("soft-deletes an owned post and treats a repeated delete as success", async () => {
    prisma.post.findUnique
      .mockResolvedValueOnce({ authorId: "user-1", status: "published" })
      .mockResolvedValueOnce({ authorId: "user-1", status: "deleted" });
    prisma.post.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.deleteOwn("user-1", "post-1")).resolves.toBeUndefined();
    await expect(service.deleteOwn("user-1", "post-1")).resolves.toBeUndefined();

    expect(prisma.post.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: {
        id: "post-1",
        authorId: "user-1",
        status: { not: ADMIN_CONTENT_POST_STATUS.DELETED },
      },
      data: { status: ADMIN_CONTENT_POST_STATUS.DELETED, moderationReason: null },
    });
    expect(prisma.communityPostReport.updateMany).toHaveBeenCalledWith({
      where: { postId: "post-1", status: "pending" },
      data: { status: "resolved", resolvedAt: expect.any(Date) },
    });
  });

  it("rejects deletion by a non-owner without changing the post", async () => {
    prisma.post.findUnique.mockResolvedValue({ authorId: "user-2", status: "published" });

    await expect(service.deleteOwn("user-1", "post-1")).rejects.toMatchObject({
      code: "CONTENT_POST_FORBIDDEN",
    });
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });
});
