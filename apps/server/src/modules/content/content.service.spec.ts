import { ContentService } from "./content.service";

describe("ContentService", () => {
  const transaction = {
    post: { updateMany: jest.fn() },
    communityPostModerationEvent: { create: jest.fn() },
    communityPostReport: { updateMany: jest.fn() },
  };
  const prisma = {
    post: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  const storage = { head: jest.fn() };
  const service = new ContentService(prisma as never, storage as never);
  const observedAt = new Date("2026-08-26T08:00:00.000Z");
  const author = {
    id: "user-1",
    phone: "13800138000",
    username: null,
    nickname: "小明",
    avatar: null,
  };
  const moderationPost = {
    id: "post-1",
    status: "pending",
    mediaUrls: ["https://cdn.example/community.png"],
    updatedAt: observedAt,
    mediaAssets: [{ storageKey: "public/community-media/a.png", status: "active" }],
  };
  const detailPost = {
    id: "post-1",
    content: "今天带旺财散步",
    mediaUrls: moderationPost.mediaUrls,
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    _count: { reports: 1 },
    status: "published",
    moderationReason: null,
    createdAt: observedAt,
    updatedAt: new Date("2026-08-26T08:01:00.000Z"),
    author,
    moderationEvents: [
      {
        id: "event-1",
        action: "approve",
        previousStatus: "pending",
        nextStatus: "published",
        reason: null,
        createdAt: new Date("2026-08-26T08:01:00.000Z"),
        operator: { ...author, id: "admin-1", nickname: "运营" },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.post.updateMany.mockResolvedValue({ count: 1 });
    transaction.communityPostModerationEvent.create.mockResolvedValue({ id: "event-1" });
    transaction.communityPostReport.updateMany.mockResolvedValue({ count: 0 });
    storage.head.mockResolvedValue(undefined);
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
        _count: { reports: 2 },
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
      list: [{ contentExcerpt: "这是一段帖子正文", mediaCount: 2, reportsCount: 2 }],
    });
  });

  it("treats legacy draft posts as pending in filters and responses", async () => {
    prisma.post.findMany.mockResolvedValue([
      {
        id: "post-legacy",
        content: "历史草稿",
        mediaUrls: [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        _count: { reports: 0 },
        status: "draft",
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

    await expect(
      service.findPostPage({ page: 1, pageSize: 20, status: "pending" }),
    ).resolves.toMatchObject({ list: [{ status: "pending" }] });
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ status: { in: ["pending", "draft"] } }] },
      }),
    );
  });

  it("returns full post content and moderation history to administrators", async () => {
    prisma.post.findUnique.mockResolvedValue(detailPost);

    await expect(service.findPostDetail("post-1")).resolves.toMatchObject({
      id: "post-1",
      content: "今天带旺财散步",
      mediaUrls: ["https://cdn.example/community.png"],
      moderationHistory: [
        {
          action: "approve",
          previousStatus: "pending",
          nextStatus: "published",
          operator: { id: "admin-1" },
        },
      ],
    });
  });

  it("approves a current pending post only after checking every managed image", async () => {
    prisma.post.findUnique.mockResolvedValueOnce(moderationPost).mockResolvedValueOnce(detailPost);

    await expect(
      service.approvePost("post-1", "admin-1", {
        expectedUpdatedAt: observedAt.toISOString(),
      }),
    ).resolves.toMatchObject({ status: "published" });

    expect(storage.head).toHaveBeenCalledWith("public/community-media/a.png");
    expect(transaction.post.updateMany).toHaveBeenCalledWith({
      where: {
        id: "post-1",
        status: { in: ["pending", "draft"] },
        updatedAt: observedAt,
      },
      data: { status: "published", moderationReason: null },
    });
    expect(transaction.communityPostModerationEvent.create).toHaveBeenCalledWith({
      data: {
        postId: "post-1",
        operatorId: "admin-1",
        action: "approve",
        previousStatus: "pending",
        nextStatus: "published",
        reason: null,
      },
    });
  });

  it.each([
    ["rejects", "rejectPost", "pending", "rejected", "包含联系方式"],
    ["takes offline", "offlinePost", "published", "offline", "违反社区规范"],
  ] as const)(
    "%s a valid post with a required reason",
    async (_label, method, status, next, reason) => {
      prisma.post.findUnique
        .mockResolvedValueOnce({ ...moderationPost, status, mediaUrls: [], mediaAssets: [] })
        .mockResolvedValueOnce({
          ...detailPost,
          status: next,
          mediaUrls: [],
          moderationReason: reason,
        });

      await expect(
        service[method]("post-1", "admin-1", {
          expectedUpdatedAt: observedAt.toISOString(),
          reason: `  ${reason}  `,
        }),
      ).resolves.toMatchObject({ status: next, moderationReason: reason });
      expect(transaction.communityPostModerationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: method === "rejectPost" ? "reject" : "offline",
            reason,
          }),
        }),
      );
      expect(transaction.communityPostReport.updateMany).toHaveBeenCalledTimes(
        method === "offlinePost" ? 1 : 0,
      );
    },
  );

  it("requires reasons and rejects invalid or stale moderation commands", async () => {
    prisma.post.findUnique.mockResolvedValue({ ...moderationPost, mediaUrls: [], mediaAssets: [] });

    await expect(
      service.rejectPost("post-1", "admin-1", {
        expectedUpdatedAt: observedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "CONTENT_POST_REASON_REQUIRED", status: 400 });

    prisma.post.findUnique.mockResolvedValue({ ...moderationPost, status: "published" });
    await expect(
      service.approvePost("post-1", "admin-1", {
        expectedUpdatedAt: observedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "CONTENT_POST_STATE_CONFLICT", status: 409 });

    prisma.post.findUnique.mockResolvedValue(moderationPost);
    await expect(
      service.approvePost("post-1", "admin-1", {
        expectedUpdatedAt: "2026-08-26T07:59:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "CONTENT_POST_CONCURRENT_UPDATE", status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not approve missing, inactive, or unreadable managed images", async () => {
    prisma.post.findUnique.mockResolvedValueOnce({ ...moderationPost, mediaAssets: [] });
    await expect(
      service.approvePost("post-1", "admin-1", {
        expectedUpdatedAt: observedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "CONTENT_POST_MEDIA_UNAVAILABLE", status: 409 });

    prisma.post.findUnique.mockResolvedValueOnce({
      ...moderationPost,
      mediaAssets: [{ storageKey: "a", status: "discarded" }],
    });
    await expect(
      service.approvePost("post-1", "admin-1", {
        expectedUpdatedAt: observedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "CONTENT_POST_MEDIA_UNAVAILABLE", status: 409 });

    prisma.post.findUnique.mockResolvedValueOnce(moderationPost);
    storage.head.mockRejectedValueOnce(new Error("missing"));
    await expect(
      service.approvePost("post-1", "admin-1", {
        expectedUpdatedAt: observedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: "CONTENT_POST_MEDIA_UNAVAILABLE", status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a moderation race before writing an audit event", async () => {
    prisma.post.findUnique.mockResolvedValueOnce({
      ...moderationPost,
      mediaUrls: [],
      mediaAssets: [],
    });
    transaction.post.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.rejectPost("post-1", "admin-1", {
        expectedUpdatedAt: observedAt.toISOString(),
        reason: "包含联系方式",
      }),
    ).rejects.toMatchObject({ code: "CONTENT_POST_CONCURRENT_UPDATE", status: 409 });
    expect(transaction.communityPostModerationEvent.create).not.toHaveBeenCalled();
  });
});
