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
};

describe("WebsiteSectionEditor exhaustive section support", () => {
  it("maps every shared section discriminator to a dedicated editor", () => {
    expect(Object.keys(editorByType).sort()).toEqual(Object.values(WEBSITE_SECTION_TYPE).sort());
  });

  it.each(Object.values(WEBSITE_SECTION_TYPE))("renders %s through its typed editor", (sectionType) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <WebsiteSectionEditor section={sectionFor(sectionType)} onChange={vi.fn()} disabled />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("textbox", { name: fieldLabelByType[sectionType] })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新增区块|删除区块|更换区块类型|拖拽排序/ })).toBeNull();
  });
});
