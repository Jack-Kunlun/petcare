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
      count: jest.fn(),
    },
    communityMediaAsset: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const storage = {
    resolvePublicUrl: jest.fn((key: string) => `https://cdn.example/${key}`),
  };
  const service = new CommunityPostService(prisma as never, storage as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (operation: (transaction: typeof prisma) => Promise<unknown>) => operation(prisma),
    );
    prisma.communityMediaAsset.findMany.mockResolvedValue([]);
    prisma.communityMediaAsset.updateMany.mockResolvedValue({ count: 0 });
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
      expect.objectContaining({ where: { authorId: "user-1" }, skip: 10, take: 10 }),
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
});
