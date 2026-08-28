import type {
  WebsiteContactPanelSection,
  WebsitePublicContent,
  WebsiteRichTextSection,
} from "@petcare/shared-types";
import { WEBSITE_CONTENT_KEY, WEBSITE_SECTION_TYPE } from "@petcare/shared-types";
import { describe, expect, it } from "vitest";
import {
  filterHelpCategories,
  getContactAction,
  getLegalContentKey,
  toContactPanel,
  toHelpCategories,
  toRichTextContent,
} from "./content-mappers";

function richText(
  sectionKey: string,
  title: string,
  parts: WebsiteRichTextSection["content"]["parts"],
  isEnabled = true,
): WebsiteRichTextSection {
  return {
    sectionKey,
    sectionType: WEBSITE_SECTION_TYPE.RICH_TEXT,
    sortOrder: 1,
    isEnabled,
    schemaVersion: 1,
    content: { title, effectiveDate: null, parts },
    settings: { width: "normal" },
  };
}

function contactPanel(
  sectionKey: string,
  title: string,
  isEnabled: boolean,
): WebsiteContactPanelSection {
  return {
    sectionKey,
    sectionType: WEBSITE_SECTION_TYPE.CONTACT_PANEL,
    sortOrder: 1,
    isEnabled,
    schemaVersion: 1,
    content: {
      title,
      description: "联系我们",
      channels: [
        {
          channelKey: "customer_service",
          label: "客服电话",
          value: "400-888-6288",
          href: "tel:400-888-6288",
          availability: "每日 09:00-18:00",
        },
      ],
    },
    settings: { columns: 1 },
  };
}

function publicContent(
  sections: WebsitePublicContent["sections"],
  contentKey: WebsitePublicContent["contentKey"] = WEBSITE_CONTENT_KEY.HELP,
): WebsitePublicContent {
  return {
    contentKey,
    businessVersion: 1,
    publishedAt: "2026-08-24T00:00:00.000Z",
    seo: {
      title: "支持内容",
      description: "支持内容",
      canonicalPath: "/help",
      image: null,
    },
    sections,
  };
}

describe("support content mappers", () => {
  it("accepts only the two legal content keys", () => {
    expect(getLegalContentKey("privacy")).toBe(WEBSITE_CONTENT_KEY.PRIVACY);
    expect(getLegalContentKey("terms")).toBe(WEBSITE_CONTENT_KEY.TERMS);
    expect(getLegalContentKey("help")).toBe(WEBSITE_CONTENT_KEY.PRIVACY);
    expect(getLegalContentKey(undefined)).toBe(WEBSITE_CONTENT_KEY.PRIVACY);
  });

  it("maps enabled Help categories and filters category, question, and answer text", () => {
    const content = publicContent([
      richText("account_and_identity", "账号与认证", [
        {
          partKey: "complete_profile",
          heading: "如何完善个人信息？",
          paragraphs: ["验证手机号后即可完善资料。"],
        },
        {
          partKey: "wechat_profile",
          heading: "如何修改微信资料？",
          paragraphs: ["可以在 PetCare 更新头像和昵称。"],
        },
      ]),
      richText("fees_and_benefits", "费用与优惠", [
        {
          partKey: "fee_reference",
          heading: "服务费用以哪里为准？",
          paragraphs: ["以订单确认页为准。"],
        },
      ]),
      richText("disabled", "已停用", [], false),
    ]);

    const categories = toHelpCategories(content);

    expect(categories).toHaveLength(2);
    expect(categories[0]).toMatchObject({
      key: "account_and_identity",
      title: "账号与认证",
    });
    expect(categories[0].questions[0]).toMatchObject({ question: "如何完善个人信息？" });
    expect(filterHelpCategories(categories, " 手机号 ")).toEqual([
      {
        ...categories[0],
        questions: [categories[0].questions[0]],
      },
    ]);
    expect(filterHelpCategories(categories, "账号与认证")).toEqual([categories[0]]);
    expect(filterHelpCategories(categories, "PETCARE")).toEqual([
      {
        ...categories[0],
        questions: [categories[0].questions[1]],
      },
    ]);
    expect(filterHelpCategories(categories, "没有结果")).toEqual([]);
    expect(filterHelpCategories(categories, "  ")).toEqual(categories);
  });

  it("keeps enabled legal sections and their paragraph order", () => {
    const enabled = richText("privacy", "隐私协议", [
      {
        partKey: "collection",
        heading: "信息收集",
        paragraphs: ["第一段", "第二段", "第三段"],
      },
    ]);
    const content = publicContent(
      [richText("disabled", "停用内容", [], false), enabled],
      WEBSITE_CONTENT_KEY.PRIVACY,
    );

    expect(toRichTextContent(content)).toEqual([enabled.content]);
    expect(toRichTextContent(content)[0].parts[0].paragraphs).toEqual([
      "第一段",
      "第二段",
      "第三段",
    ]);
  });

  it("selects the first enabled contact panel", () => {
    const firstEnabled = contactPanel("primary", "主要渠道", true);
    const content = publicContent(
      [
        contactPanel("disabled", "停用渠道", false),
        firstEnabled,
        contactPanel("later", "备用渠道", true),
      ],
      WEBSITE_CONTENT_KEY.CONTACT,
    );

    expect(toContactPanel(content)).toEqual(firstEnabled.content);
    expect(
      toContactPanel(
        publicContent([contactPanel("disabled", "停用渠道", false)], WEBSITE_CONTENT_KEY.CONTACT),
      ),
    ).toBeNull();
  });

  it("removes disabled channels while retaining enabled informational channels", () => {
    const panel = contactPanel("primary", "主要渠道", true);

    panel.content.channels = [
      {
        channelKey: "disabled",
        label: "未配置客服",
        value: "待运营配置",
        href: "/contact",
        availability: "待运营配置",
        isEnabled: false,
      },
      {
        channelKey: "information",
        label: "线下地址",
        value: "上海市",
        href: "https://example.com/address",
        availability: "预约后到访",
        isEnabled: true,
      },
    ];

    const result = toContactPanel(publicContent([panel], WEBSITE_CONTENT_KEY.CONTACT));

    expect(result?.channels).toEqual([panel.content.channels[1]]);
    expect(getContactAction(result!.channels[0].href)).toEqual({ kind: "none" });
  });

  it("accepts only locally valid phone and email actions", () => {
    expect(getContactAction("tel:400-888-6288")).toEqual({
      kind: "phone",
      value: "4008886288",
    });
    expect(getContactAction("tel:13800138000")).toEqual({
      kind: "phone",
      value: "+8613800138000",
    });
    expect(getContactAction("mailto:support@petcare.example?subject=help")).toEqual({
      kind: "email",
      value: "support@petcare.example",
    });
    expect(getContactAction("https://example.com/support")).toEqual({ kind: "none" });
    expect(getContactAction("tel:not-a-number")).toEqual({ kind: "none" });
    expect(getContactAction("mailto:missing-at.example")).toEqual({ kind: "none" });
  });
});
