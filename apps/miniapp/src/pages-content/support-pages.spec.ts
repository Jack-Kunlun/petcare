import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const help = readFileSync(resolve(import.meta.dirname, "help/index.vue"), "utf8");
const contact = readFileSync(resolve(import.meta.dirname, "contact/index.vue"), "utf8");

describe("published support pages", () => {
  it("loads and searches published Help with distinct recoverable states", () => {
    expect(help).toContain("getPublishedContent(WEBSITE_CONTENT_KEY.HELP)");
    expect(help).toContain('v-model="query"');
    expect(help).toContain('aria-label="搜索常见问题"');
    expect(help).toContain("帮助内容暂未配置");
    expect(help).toContain("未找到相关问题");
    expect(help).toContain("重新加载");
  });

  it("executes only validated contact actions with native disabled buttons", () => {
    expect(contact).toContain("getPublishedContent(WEBSITE_CONTENT_KEY.CONTACT)");
    expect(contact).toContain("getContactAction(channel.href)");
    expect(contact).toContain("uni.makePhoneCall");
    expect(contact).toContain("uni.setClipboardData");
    expect(contact).toContain(':disabled="actionPending !== null"');
    expect(contact).not.toContain("400-888-6288");
    expect(contact).not.toContain("support@petcare.example");
    expect(contact).not.toContain("在线客服");
  });
});
