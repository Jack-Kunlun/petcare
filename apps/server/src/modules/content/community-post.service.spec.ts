import { ADMIN_CONTENT_POST_STATUS } from "@petcare/shared-types";
import { CommunityPostService } from "./community-post.service";

describe("CommunityPostService", () => {
  const prisma = {
    post: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const service = new CommunityPostService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it("trims text and always creates a pending post owned by the authenticated user", async () => {
    prisma.post.create.mockResolvedValue({
      id: "post-1",
      content: "今天带旺财散步",
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
      status: ADMIN_CONTENT_POST_STATUS.PENDING,
      moderationReason: null,
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

  it("scopes moderation reads to the author and only exposes rejection reasons", async () => {
    prisma.post.findMany.mockResolvedValue([
      {
        id: "post-rejected",
        content: "被驳回的动态",
        status: "rejected",
        moderationReason: "包含联系方式",
        createdAt: new Date("2026-08-26T08:00:00.000Z"),
        updatedAt: new Date("2026-08-26T08:10:00.000Z"),
      },
      {
        id: "post-offline",
        content: "已下架的动态",
        status: "offline",
        moderationReason: "运营下架原因",
        createdAt: new Date("2026-08-25T08:00:00.000Z"),
        updatedAt: new Date("2026-08-26T08:20:00.000Z"),
      },
    ]);
    prisma.post.count.mockResolvedValue(2);

    await expect(service.findMine("user-1", { page: 2, pageSize: 10 })).resolves.toMatchObject({
      list: [
        { id: "post-rejected", moderationReason: "包含联系方式" },
        { id: "post-offline", moderationReason: null },
      ],
      total: 2,
      page: 2,
      pageSize: 10,
    });

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId: "user-1" },
        skip: 10,
        take: 10,
      }),
    );
    expect(prisma.post.count).toHaveBeenCalledWith({ where: { authorId: "user-1" } });
  });

  it("exposes a legacy draft as pending", async () => {
    prisma.post.findMany.mockResolvedValue([
      {
        id: "post-legacy",
        content: "历史动态",
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
