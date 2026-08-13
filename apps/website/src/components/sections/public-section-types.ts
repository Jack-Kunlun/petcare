import {
  WEBSITE_SECTION_TYPE,
  type WebsitePublicContentSection,
  type WebsiteSectionType,
} from "@petcare/shared-types";

/** Narrows a public resolved section to one renderer discriminator. */
export type WebsitePublicSectionOf<TType extends WebsiteSectionType> = Extract<
  WebsitePublicContentSection,
  { sectionType: TType }
>;

/** Resolved public header section. */
export type WebsitePublicSiteHeaderSection = WebsitePublicSectionOf<
  typeof WEBSITE_SECTION_TYPE.SITE_HEADER
>;
/** Resolved public footer section. */
export type WebsitePublicSiteFooterSection = WebsitePublicSectionOf<
  typeof WEBSITE_SECTION_TYPE.SITE_FOOTER
>;
/** Resolved public hero section. */
export type WebsitePublicHeroSection = WebsitePublicSectionOf<typeof WEBSITE_SECTION_TYPE.HERO>;
/** Resolved public trust-grid section. */
export type WebsitePublicTrustGridSection = WebsitePublicSectionOf<
  typeof WEBSITE_SECTION_TYPE.TRUST_GRID
>;
/** Resolved public feature-split section. */
export type WebsitePublicFeatureSplitSection = WebsitePublicSectionOf<
  typeof WEBSITE_SECTION_TYPE.FEATURE_SPLIT
>;
/** Resolved public CTA section. */
export type WebsitePublicCtaSection = WebsitePublicSectionOf<typeof WEBSITE_SECTION_TYPE.CTA>;
/** Resolved public rich-text section. */
export type WebsitePublicRichTextSection = WebsitePublicSectionOf<
  typeof WEBSITE_SECTION_TYPE.RICH_TEXT
>;
/** Resolved public contact-panel section. */
export type WebsitePublicContactPanelSection = WebsitePublicSectionOf<
  typeof WEBSITE_SECTION_TYPE.CONTACT_PANEL
>;
