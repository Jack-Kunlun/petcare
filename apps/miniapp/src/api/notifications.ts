import type {
  NotificationListQuery,
  NotificationListResponse,
  NotificationReadAllResult,
  UserNotification,
} from "@petcare/shared-types";
import { authorizedRequest } from "../state/session";

/** Reads the authenticated user's notifications with an optional category filter. */
export function getNotifications(query: NotificationListQuery): Promise<NotificationListResponse> {
  return authorizedRequest("/notifications", {
    data: {
      page: query.page,
      pageSize: query.pageSize,
      ...(query.category ? { category: query.category } : {}),
    },
  });
}

/** Idempotently marks one owned notification as read. */
export function markNotificationRead(id: string): Promise<UserNotification> {
  return authorizedRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" });
}

/** Idempotently marks every notification owned by the current user as read. */
export function markAllNotificationsRead(): Promise<NotificationReadAllResult> {
  return authorizedRequest("/notifications/read-all", { method: "PUT" });
}
