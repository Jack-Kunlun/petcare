import {
  WEBSITE_SECTION_TYPE,
  type WebsitePublicContentSection,
  type WebsiteSectionType,
} from "@petcare/shared-types";
import { describe, expect, it } from "vitest";
import { resolveSectionRendererName } from "./rendering-contract";

function section(sectionType: WebsiteSectionType): WebsitePublicContentSection {
  return {
    sectionKey: "test",
    sectionType,
    sortOrder: 1,
    isEnabled: true,
    schemaVersion: 1,
    content: {},
    settings: {},
  } as WebsitePublicContentSection;
}

describe("Website section renderer resolution", () => {
  it("resolves every persisted section discriminator to a code-owned renderer", () => {
    expect(
      Object.values(WEBSITE_SECTION_TYPE).map((sectionType) =>
        resolveSectionRendererName(section(sectionType)),
      ),
    ).toEqual([
      "SiteHeader",
      "SiteFooter",
      "HeroSection",
      "TrustGridSection",
      "FeatureSplitSection",
      "CtaSection",
      "RichTextSection",
      "ContactPanelSection",
    ]);
  });

  it("fails closed before an unknown section can reach a template", () => {
    expect(() => resolveSectionRendererName({ sectionType: "script", schemaVersion: 1 })).toThrow(
      "Unsupported website section type",
    );
  });
});
