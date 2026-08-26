import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { NotificationController, NotificationListQueryDto } from "./notification.controller";

describe("NotificationController", () => {
  const notifications = {
    findMine: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  };
  const controller = new NotificationController(notifications as never);
  const request = { user: { sub: "user-1" } } as never;

  beforeEach(() => jest.clearAllMocks());

  it("requires authentication and delegates only the access-token subject", async () => {
    notifications.findMine.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 });
    notifications.markRead.mockResolvedValue({ id: "notification-1", isRead: true });
    notifications.markAllRead.mockResolvedValue({ updatedCount: 1 });
    const query = { page: 1, pageSize: 20, category: "interaction" } as const;

    expect(Reflect.getMetadata("path", NotificationController)).toBe("notifications");
    expect(Reflect.getMetadata(GUARDS_METADATA, NotificationController)).toEqual([
      AccessTokenGuard,
    ]);
    await expect(controller.findMine(request, query)).resolves.toMatchObject({ total: 0 });
    await expect(controller.markRead(request, "notification-1")).resolves.toMatchObject({
      isRead: true,
    });
    await expect(controller.markAllRead(request)).resolves.toEqual({ updatedCount: 1 });
    expect(notifications.findMine).toHaveBeenCalledWith("user-1", query);
    expect(notifications.markRead).toHaveBeenCalledWith("user-1", "notification-1");
    expect(notifications.markAllRead).toHaveBeenCalledWith("user-1");
  });

  it("validates bounded pagination and controlled categories", async () => {
    const valid = plainToInstance(NotificationListQueryDto, {
      page: "2",
      pageSize: "10",
      category: "interaction",
    });
    const invalid = plainToInstance(NotificationListQueryDto, {
      page: 0,
      pageSize: 51,
      category: "chat",
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
    expect(valid).toMatchObject({ page: 2, pageSize: 10, category: "interaction" });
  });
});
