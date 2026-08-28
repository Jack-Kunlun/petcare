import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

describe("messages page", () => {
  it("uses real paginated notifications with loading, empty, error, and filter states", () => {
    expect(source).toContain("getNotifications({");
    expect(source).toContain("page.value + 1");
    expect(source).toContain("status === 'loading'");
    expect(source).toContain("status === 'error'");
    expect(source).toContain("notifications.length === 0");
    expect(source).toContain("selectCategory(tab.value)");
    expect(source).toContain("loadNotifications(false)");
    expect(source).not.toContain('id: "notice-1"');
    expect(source).not.toContain("仅展示最近 30 天的消息");
    expect(source).not.toContain("订单消息");
    expect(source).toContain("category: activeCategory.value");
  });

  it("keeps read state and navigation behavior aligned", () => {
    expect(source).toContain("markNotificationRead(item.id)");
    expect(source).toContain("markAllNotificationsRead()");
    expect(source).toContain("uni.navigateTo({ url: target })");
    expect(source.indexOf("markNotificationRead(item.id)")).toBeLessThan(
      source.indexOf("uni.navigateTo({ url: target })"),
    );
    expect(source).toContain('v-if="!item.isRead"');
    expect(source).toContain(':disabled="markAllDisabled"');
    expect(source).toContain(':loading="markingAll"');
    expect(source).toContain("PcButton");
  });
});
