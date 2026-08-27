import { describe, expect, it } from "vitest";
import {
  CURRENT_WEBSITE_CONTENT_KEYS,
  WEBSITE_CONTENT_ERROR_CODE,
  WEBSITE_CONTENT_KEY,
  WEBSITE_CONTENT_STATUS,
  WEBSITE_MEDIA_STATUS,
  WEBSITE_SECTION_TYPE,
  isCurrentWebsiteContentKey,
  type WebsiteContactChannel,
  type WebsiteContentSection,
  type WebsiteSectionType,
} from "./website-content";

function renderSectionName(section: WebsiteContentSection): WebsiteSectionType {
  switch (section.sectionType) {
    case WEBSITE_SECTION_TYPE.SITE_HEADER:
    case WEBSITE_SECTION_TYPE.SITE_FOOTER:
    case WEBSITE_SECTION_TYPE.HERO:
    case WEBSITE_SECTION_TYPE.TRUST_GRID:
    case WEBSITE_SECTION_TYPE.FEATURE_SPLIT:
    case WEBSITE_SECTION_TYPE.CTA:
    case WEBSITE_SECTION_TYPE.RICH_TEXT:
    case WEBSITE_SECTION_TYPE.CONTACT_PANEL:
    case WEBSITE_SECTION_TYPE.HOME_EXPERIENCE:
      return section.sectionType;

    default: {
      const exhaustive: never = section;

      return exhaustive;
    }
  }
}

describe("website content contract", () => {
  it("keeps content keys and lifecycle values stable", () => {
    expect(WEBSITE_CONTENT_KEY).toEqual({
      SITE_SHELL: "site_shell",
      HOME: "home",
      SERVICES: "services",
      TRUST: "trust",
      COMPANIONS: "companions",
      ABOUT: "about",
      CONTACT: "contact",
      HELP: "help",
      PRIVACY: "privacy",
      TERMS: "terms",
    });
    expect(WEBSITE_CONTENT_STATUS).toEqual({
      DRAFT: "draft",
      PUBLISHED: "published",
      SUPERSEDED: "superseded",
    });
    expect(WEBSITE_MEDIA_STATUS).toEqual({
      ACTIVE: "active",
      ARCHIVED: "archived",
    });
    expect(CURRENT_WEBSITE_CONTENT_KEYS).toEqual([
      "site_shell",
      "home",
      "about",
      "contact",
      "help",
      "privacy",
      "terms",
    ]);
    expect(isCurrentWebsiteContentKey("home")).toBe(true);
    expect(isCurrentWebsiteContentKey("services")).toBe(false);
  });

  it("keeps every section discriminator stable and exhaustively consumable", () => {
    expect(WEBSITE_SECTION_TYPE).toEqual({
      SITE_HEADER: "site_header",
      SITE_FOOTER: "site_footer",
      HERO: "hero",
      TRUST_GRID: "trust_grid",
      FEATURE_SPLIT: "feature_split",
      CTA: "cta",
      RICH_TEXT: "rich_text",
      CONTACT_PANEL: "contact_panel",
      HOME_EXPERIENCE: "home_experience",
    });

    const section = {
      sectionKey: "hero",
      sectionType: WEBSITE_SECTION_TYPE.HERO,
      sortOrder: 10,
      isEnabled: true,
      schemaVersion: 1,
      content: {
        eyebrow: "PetCare",
        title: "记录每一次陪伴",
        description: "管理宠物档案并阅读养宠内容",
        primaryAction: { label: "阅读萌宠课堂", href: "/articles" },
        secondaryAction: null,
        image: { assetId: null, altText: "宠物陪伴" },
      },
      settings: { alignment: "left", imagePosition: "right" },
    } satisfies WebsiteContentSection;

    expect(renderSectionName(section)).toBe("hero");
  });

  it("supports explicitly disabling one fixed contact channel", () => {
    const channel = {
      channelKey: "customer_service",
      label: "项目邮箱",
      value: "未启用",
      href: "/contact",
      availability: "未启用",
      isEnabled: false,
    } satisfies WebsiteContactChannel;

    expect(channel.isEnabled).toBe(false);
  });

  it("publishes stable machine-readable error codes", () => {
    expect(WEBSITE_CONTENT_ERROR_CODE).toEqual({
      REVISION_CONFLICT: "WEBSITE_CONTENT_REVISION_CONFLICT",
      INVALID_CONTENT: "WEBSITE_CONTENT_INVALID_CONTENT",
      CONTENT_NOT_FOUND: "WEBSITE_CONTENT_NOT_FOUND",
      VERSION_NOT_FOUND: "WEBSITE_CONTENT_VERSION_NOT_FOUND",
      INVALID_MEDIA: "WEBSITE_CONTENT_INVALID_MEDIA",
      PREVIEW_TOKEN_INVALID: "WEBSITE_CONTENT_PREVIEW_TOKEN_INVALID",
      PREVIEW_TOKEN_EXPIRED: "WEBSITE_CONTENT_PREVIEW_TOKEN_EXPIRED",
      PERSISTENCE_FAILED: "WEBSITE_CONTENT_PERSISTENCE_FAILED",
      STORAGE_UNAVAILABLE: "WEBSITE_CONTENT_STORAGE_UNAVAILABLE",
      PERMISSION_DENIED: "WEBSITE_CONTENT_PERMISSION_DENIED",
    });
  });
});
