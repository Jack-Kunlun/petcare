import {
  WEBSITE_SECTION_TYPE,
  type WebsitePublicContentSection,
  type WebsiteSectionType,
} from "@petcare/shared-types";

/** Astro component names for the exhaustive, code-owned section renderer registry. */
export const SECTION_RENDERER_NAMES = {
  [WEBSITE_SECTION_TYPE.SITE_HEADER]: "SiteHeader",
  [WEBSITE_SECTION_TYPE.SITE_FOOTER]: "SiteFooter",
  [WEBSITE_SECTION_TYPE.HERO]: "HeroSection",
  [WEBSITE_SECTION_TYPE.TRUST_GRID]: "TrustGridSection",
  [WEBSITE_SECTION_TYPE.FEATURE_SPLIT]: "FeatureSplitSection",
  [WEBSITE_SECTION_TYPE.CTA]: "CtaSection",
  [WEBSITE_SECTION_TYPE.RICH_TEXT]: "RichTextSection",
  [WEBSITE_SECTION_TYPE.CONTACT_PANEL]: "ContactPanelSection",
  [WEBSITE_SECTION_TYPE.HOME_EXPERIENCE]: "HomeExperience",
} as const satisfies Record<WebsiteSectionType, string>;

/** Rejects unknown discriminators and future schemas before they reach an Astro template. */
export function assertRenderableSection(
  section:
    | Pick<WebsitePublicContentSection, "sectionType" | "schemaVersion">
    | {
        sectionType: unknown;
        schemaVersion: unknown;
      },
): asserts section is Pick<WebsitePublicContentSection, "sectionType" | "schemaVersion"> {
  if (
    typeof section.sectionType !== "string" ||
    !Object.hasOwn(SECTION_RENDERER_NAMES, section.sectionType)
  ) {
    throw new Error("Unsupported website section type");
  }

  if (section.schemaVersion !== 1) {
    throw new Error("Unsupported website section schema version");
  }
}

/** Resolves the only renderer name allowed to receive a persisted public section. */
export function resolveSectionRendererName(
  section:
    | Pick<WebsitePublicContentSection, "sectionType" | "schemaVersion">
    | {
        sectionType: unknown;
        schemaVersion: unknown;
      },
): string {
  assertRenderableSection(section);

  return SECTION_RENDERER_NAMES[section.sectionType];
}
