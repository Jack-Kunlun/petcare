import { HttpStatus, Injectable } from "@nestjs/common";
import { NOTIFICATION_CATEGORY, NOTIFICATION_TYPE } from "@petcare/shared-types";
import type {
  NotificationCategory,
  NotificationListQuery,
  NotificationListResponse,
  NotificationReadAllResult,
  NotificationType,
  UserNotification,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { PrismaService } from "../../prisma/prisma.service";

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  content: true,
  referenceId: true,
  isRead: true,
  createdAt: true,
} as const;

const typesByCategory: Record<NotificationCategory, NotificationType[]> = {
  [NOTIFICATION_CATEGORY.SYSTEM]: [NOTIFICATION_TYPE.SYSTEM],
  [NOTIFICATION_CATEGORY.ORDER]: [NOTIFICATION_TYPE.ORDER],
  [NOTIFICATION_CATEGORY.INTERACTION]: [
    NOTIFICATION_TYPE.COMMUNITY_LIKE,
    NOTIFICATION_TYPE.COMMUNITY_COMMENT,
  ],
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  content: string;
  referenceId: string | null;
  isRead: boolean;
  createdAt: Date;
};

function notificationCategory(type: string): NotificationCategory {
  if (type === NOTIFICATION_TYPE.COMMUNITY_LIKE || type === NOTIFICATION_TYPE.COMMUNITY_COMMENT) {
    return NOTIFICATION_CATEGORY.INTERACTION;
  }

  return type === NOTIFICATION_TYPE.ORDER
    ? NOTIFICATION_CATEGORY.ORDER
    : NOTIFICATION_CATEGORY.SYSTEM;
}

function toUserNotification(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    category: notificationCategory(row.type),
    title: row.title,
    content: row.content,
    referenceId: row.referenceId,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Reads and updates notifications strictly within the authenticated recipient boundary. */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the recipient's newest supported notifications with an optional category filter. */
  async findMine(userId: string, query: NotificationListQuery): Promise<NotificationListResponse> {
    const where = {
      userId,
      type: {
        in: query.category ? typesByCategory[query.category] : Object.values(NOTIFICATION_TYPE),
      },
    };
    const [list, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: notificationSelect,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      list: list.map(toUserNotification),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Idempotently marks one notification owned by the recipient as read. */
  async markRead(userId: string, id: string): Promise<UserNotification> {
    await this.prisma.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true },
    });
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: notificationSelect,
    });

    if (!notification) {
      throw new ApiException("NOTIFICATION_NOT_FOUND", "通知不存在", HttpStatus.NOT_FOUND);
    }

    return toUserNotification(notification);
  }

  /** Idempotently marks every unread notification owned by the recipient as read. */
  async markAllRead(userId: string): Promise<NotificationReadAllResult> {
    const updated = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { updatedCount: updated.count };
  }
}
