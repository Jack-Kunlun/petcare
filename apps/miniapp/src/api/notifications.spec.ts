import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedRequest } from "../state/session";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "./notifications";

vi.mock("../state/session", () => ({ authorizedRequest: vi.fn() }));

const authorizedRequestMock = vi.mocked(authorizedRequest);

describe("miniapp notifications API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedRequestMock.mockResolvedValue({});
  });

  it("uses recipient-scoped list and idempotent read endpoints", async () => {
    await getNotifications({ page: 1, pageSize: 20, category: "interaction" });
    await getNotifications({ page: 2, pageSize: 10 });
    await markNotificationRead("notification/1");
    await markAllNotificationsRead();

    expect(authorizedRequestMock.mock.calls).toEqual([
      ["/notifications", { data: { page: 1, pageSize: 20, category: "interaction" } }],
      ["/notifications", { data: { page: 2, pageSize: 10 } }],
      ["/notifications/notification%2F1/read", { method: "PUT" }],
      ["/notifications/read-all", { method: "PUT" }],
    ]);
  });
});
