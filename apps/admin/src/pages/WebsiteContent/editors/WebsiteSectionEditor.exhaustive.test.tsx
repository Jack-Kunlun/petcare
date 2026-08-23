import type { WebsiteContentSection } from "@petcare/shared-types";
import { WEBSITE_SECTION_TYPE } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebsiteSectionEditor, editorByType } from "./WebsiteSectionEditor";

function sectionFor(sectionType: WebsiteContentSection["sectionType"]): WebsiteContentSection {
  const base = {
    sectionKey: sectionType,
    sectionType,
    sortOrder: 1,
    isEnabled: true,
    schemaVersion: 1 as const,
  };

  switch (sectionType) {
    case "site_header":
      return {
        ...base,
        sectionType: "site_header",
        content: { brandLabel: "PetCare", navigation: [], action: null },
        settings: { sticky: true },
      };
    case "site_footer":
      return {
        ...base,
        sectionType: "site_footer",
        content: { description: "说明", groups: [], copyright: "© PetCare" },
        settings: { showLogo: true },
      };
    case "hero":
      return {
        ...base,
        sectionType: "hero",
        content: {
          eyebrow: "眉题",
          title: "标题",
          description: "说明",
          primaryAction: null,
          secondaryAction: null,
          image: { assetId: null, altText: "宠物" },
        },
        settings: { alignment: "left", imagePosition: "right" },
      };
    case "trust_grid":
      return {
        ...base,
        sectionType: "trust_grid",
        content: { title: "信任", description: "说明", items: [] },
        settings: { columns: 3 },
      };
    case "feature_split":
      return {
        ...base,
        sectionType: "feature_split",
        content: {
          eyebrow: "眉题",
          title: "标题",
          description: "说明",
          action: null,
          image: { assetId: null, altText: "宠物" },
        },
        settings: { imagePosition: "left", tone: "plain" },
      };
    case "cta":
      return {
        ...base,
        sectionType: "cta",
        content: {
          title: "标题",
          description: "说明",
          primaryAction: { label: "联系", href: "/contact" },
          secondaryAction: null,
        },
        settings: { tone: "brand", alignment: "left" },
      };
    case "rich_text":
      return {
        ...base,
        sectionType: "rich_text",
        content: { title: "正文", effectiveDate: null, parts: [] },
        settings: { width: "normal" },
      };
    case "contact_panel":
      return {
        ...base,
        sectionType: "contact_panel",
        content: { title: "联系", description: "说明", channels: [] },
        settings: { columns: 2 },
      };
    case "home_experience":
      return {
        ...base,
        sectionType: "home_experience",
        content: {
          services: {
            eyebrow: "服务眉题",
            title: "服务标题",
            description: "服务说明",
            action: null,
            items: [
              {
                itemKey: "feeding",
                label: "01",
                title: "上门喂养",
                description: "服务卡片说明",
                image: { assetId: null, altText: "喂养场景" },
              },
            ],
          },
          community: {
            eyebrow: "社区眉题",
            title: "社区标题",
            description: "社区说明",
            action: null,
            items: [
              {
                itemKey: "story",
                label: "宠物日常",
                title: "社区故事",
                description: "社区卡片说明",
                image: { assetId: null, altText: "社区故事" },
              },
            ],
          },
          journey: {
            eyebrow: "流程眉题",
            title: "流程标题",
            description: "流程说明",
            action: null,
            items: [{ itemKey: "publish", title: "发布需求", description: "流程说明" }],
          },
          trust: {
            eyebrow: "信任眉题",
            title: "信任标题",
            description: "信任说明",
            action: null,
            items: [{ itemKey: "identity", title: "身份与资料", description: "信任细节" }],
          },
          record: {
            eyebrow: "记录眉题",
            title: "记录标题",
            description: "记录说明",
            action: null,
            demoTitle: "照护记录",
            statusLabel: "进行中",
            steps: [{ itemKey: "check-in", time: "14:02", label: "进门消毒", state: "complete" }],
            images: [{ assetId: null, altText: "照护记录" }],
            extraImageCount: 0,
            evidence: [{ itemKey: "photo", title: "服务照片", description: "记录证据" }],
          },
          brand: {
            eyebrow: "品牌眉题",
            title: "品牌标题",
            description: "品牌说明",
            image: { assetId: null, altText: "品牌故事" },
          },
        },
        settings: {},
      };
  }
}

const fieldLabelByType: Record<WebsiteContentSection["sectionType"], string> = {
  site_header: "品牌名称",
  site_footer: "页脚品牌说明",
  hero: "主标题",
  trust_grid: "区块标题",
  feature_split: "特性标题",
  cta: "行动标题",
  rich_text: "正文标题",
  contact_panel: "联系区标题",
  home_experience: "服务眉题",
};

describe("WebsiteSectionEditor exhaustive section support", () => {
  it("maps every shared section discriminator to a dedicated editor", () => {
    expect(Object.keys(editorByType).sort()).toEqual(Object.values(WEBSITE_SECTION_TYPE).sort());
  });

  it("renders the fixed homepage experience editor with its first group field", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <WebsiteSectionEditor
          section={sectionFor("home_experience" as WebsiteContentSection["sectionType"])}
          onChange={vi.fn()}
          disabled
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("textbox", { name: "服务眉题" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /新增区块|删除区块|更换区块类型|拖拽排序/ }),
    ).toBeNull();
  });

  it.each(Object.values(WEBSITE_SECTION_TYPE))(
    "renders %s through its typed editor",
    (sectionType) => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        <QueryClientProvider client={queryClient}>
          <WebsiteSectionEditor section={sectionFor(sectionType)} onChange={vi.fn()} disabled />
        </QueryClientProvider>,
      );

      expect(
        screen.getByRole("textbox", { name: fieldLabelByType[sectionType] }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /新增区块|删除区块|更换区块类型|拖拽排序/ }),
      ).toBeNull();
    },
  );
});
