import { NOTIFICATION_CATEGORY, NOTIFICATION_TYPE } from "@petcare/shared-types";
import { NotificationService } from "./notification.service";

describe("NotificationService", () => {
  const prisma = {
    notification: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new NotificationService(prisma as never);
  const row = {
    id: "notification-1",
    type: NOTIFICATION_TYPE.COMMUNITY_COMMENT,
    title: "收到新评论",
    content: "好可爱",
    referenceId: "post-1",
    isRead: false,
    createdAt: new Date("2026-08-26T08:00:00.000Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(0);
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    prisma.notification.findFirst.mockResolvedValue(null);
  });

  it("returns only the recipient's requested notification category", async () => {
    prisma.notification.findMany.mockResolvedValue([row]);
    prisma.notification.count.mockResolvedValue(1);

    await expect(
      service.findMine("user-1", {
        page: 2,
        pageSize: 10,
        category: NOTIFICATION_CATEGORY.INTERACTION,
      }),
    ).resolves.toEqual({
      list: [
        {
          ...row,
          category: NOTIFICATION_CATEGORY.INTERACTION,
          createdAt: "2026-08-26T08:00:00.000Z",
        },
      ],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          type: {
            in: [NOTIFICATION_TYPE.COMMUNITY_LIKE, NOTIFICATION_TYPE.COMMUNITY_COMMENT],
          },
        },
        skip: 10,
        take: 10,
      }),
    );
  });

  it("idempotently marks only an owned notification as read", async () => {
    prisma.notification.findFirst.mockResolvedValue({ ...row, isRead: true });

    await expect(service.markRead("user-1", row.id)).resolves.toMatchObject({
      id: row.id,
      isRead: true,
    });
    await expect(service.markRead("user-1", row.id)).resolves.toMatchObject({
      id: row.id,
      isRead: true,
    });

    expect(prisma.notification.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: row.id, userId: "user-1", isRead: false },
      data: { isRead: true },
    });
    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: row.id, userId: "user-1" } }),
    );
  });

  it("hides notifications owned by another user", async () => {
    await expect(service.markRead("user-2", row.id)).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
    });
  });

  it("marks every unread notification for one recipient and is repeat-safe", async () => {
    prisma.notification.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(service.markAllRead("user-1")).resolves.toEqual({ updatedCount: 2 });
    await expect(service.markAllRead("user-1")).resolves.toEqual({ updatedCount: 0 });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isRead: false },
      data: { isRead: true },
    });
  });
});
