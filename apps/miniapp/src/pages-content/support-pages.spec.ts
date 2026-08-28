import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const help = readFileSync(resolve(import.meta.dirname, "help/index.vue"), "utf8");
const contact = readFileSync(resolve(import.meta.dirname, "contact/index.vue"), "utf8");
const legal = readFileSync(resolve(import.meta.dirname, "legal/index.vue"), "utf8");
const profile = readFileSync(resolve(import.meta.dirname, "../pages/profile/index.vue"), "utf8");
const auth = readFileSync(resolve(import.meta.dirname, "../pages/auth/index.vue"), "utf8");

describe("published support pages", () => {
  it("records the Help source-wiring contract for published search and mutually exclusive states", () => {
    expect(help).toContain("getPublishedContent(WEBSITE_CONTENT_KEY.HELP)");
    expect(help).toContain('v-model="query"');
    expect(help).toContain('aria-label="搜索常见问题"');
    expect(help).toContain('aria-hidden="true"');
    expect(help).toContain("v-if=\"status === 'loading'\"");
    expect(help).toContain("v-else-if=\"status === 'error'\"");
    expect(help).toContain('v-if="categories.length === 0"');
    expect(help).toContain('v-else-if="filtered.length === 0"');
    expect(help).toContain('title="帮助内容加载失败"');
    expect(help).toContain('primary-label="清除搜索"');
    expect(help).toContain("PcStatePanel");
  });

  it("records the Contact source-wiring contract for validated native action buttons", () => {
    const actionButton = contact.match(
      /<PcButton\s+v-if="getContactAction\(channel\.href\)\.kind !== 'none'"[\s\S]*?<\/PcButton>/u,
    )?.[0];

    expect(contact).toContain("getPublishedContent(WEBSITE_CONTENT_KEY.CONTACT)");
    expect(contact).toContain("getContactAction(channel.href)");
    expect(contact).toContain("uni.makePhoneCall");
    expect(contact).toContain("uni.setClipboardData");
    expect(contact).toContain("v-if=\"getContactAction(channel.href).kind !== 'none'\"");
    expect(contact).toContain(':disabled="actionPending !== null"');
    expect(actionButton).toContain('@click="activateChannel(channel)"');
    expect(contact.match(/@click="activateChannel\(channel\)"/gu)).toHaveLength(1);
    expect(contact).toContain("text-section text-ink font-semibold");
    expect(contact).toContain('title="客服信息加载失败"');
    expect(contact).toContain('title="暂无联系方式"');
    expect(contact).toContain("PcStatePanel");
    expect(contact).not.toContain("400-888-6288");
    expect(contact).not.toContain("support@petcare.example");
    expect(contact).not.toContain("在线客服");
  });

  it("records the legal page contract for allow-listed published plain text", () => {
    expect(legal).toContain("getLegalContentKey(query.key)");
    expect(legal).toContain("getPublishedContent(contentKey.value)");
    expect(legal).toContain("toRichTextContent");
    expect(legal).toContain("v-if=\"status === 'loading'\"");
    expect(legal).toContain("v-else-if=\"status === 'error'\"");
    expect(legal).toContain('v-else-if="sections.length === 0"');
    expect(legal).toContain("section.effectiveDate");
    expect(legal).toContain("part.heading");
    expect(legal).toContain("paragraph");
    expect(legal).toContain('title="协议内容加载失败"');
    expect(legal).toContain('title="暂无已发布的协议内容"');
    expect(legal).toContain("PcStatePanel");
    expect(legal).not.toContain("v-html");
    expect(legal).not.toContain("openPrivacyContract");
  });

  it("records native login agreement navigation and a scrollable root source contract", () => {
    const navigators = auth.match(/<navigator\b[\s\S]*?<\/navigator>/gu) ?? [];
    const terms = navigators.find((navigator) =>
      navigator.includes('url="/pages-content/legal/index?key=terms"'),
    );
    const privacy = navigators.find((navigator) =>
      navigator.includes('url="/pages-content/legal/index?key=privacy"'),
    );

    expect(profile).toContain('label: "隐私协议"');
    expect(profile).toContain('detail: "查看已发布隐私内容"');
    expect(profile).toContain('route: "/pages-content/legal/index?key=privacy"');
    expect(profile).toContain('detail: "查看已发布联系方式"');
    expect(profile).not.toContain("工作日 09:00–20:00");
    expect(navigators).toHaveLength(2);
    expect(terms).toContain('aria-label="查看服务协议"');
    expect(terms).toContain('hover-class="opacity-80"');
    expect(privacy).toContain('aria-label="查看隐私政策"');
    expect(privacy).toContain('hover-class="opacity-80"');
    expect(auth).not.toContain("function openLegal");
    expect(navigators.join("\n")).not.toContain("@click");
    expect(auth).toMatch(
      /<scroll-view\s+class="pc-platform-viewport flex flex-col bg-canvas text-ink"[\s\S]*?scroll-y[\s\S]*?enable-flex/u,
    );
    expect(auth).not.toMatch(/<view\s+class="pc-platform-viewport[^"]*overflow-hidden/u);
  });

  it("uses native navigator rows for My support destinations", () => {
    const supportNavigator = profile.match(
      /<navigator\s+v-for="\(item, index\) in supportItems"[\s\S]*?<\/navigator>/u,
    )?.[0];

    expect(supportNavigator).toContain(':url="item.route"');
    expect(supportNavigator).not.toContain("@click");
    expect(profile).not.toMatch(
      /<view\s+v-for="\(item, index\) in supportItems"[\s\S]*?@click="openPage\(item\.route\)"/u,
    );
  });
});
