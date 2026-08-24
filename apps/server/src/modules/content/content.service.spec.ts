import { ContentService } from "./content.service";

describe("ContentService", () => {
  const prisma = {
    order: { findMany: jest.fn(), count: jest.fn() },
    post: { findMany: jest.fn(), count: jest.fn() },
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
});
