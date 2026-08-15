import {
  WEBSITE_CONTENT_KEY,
  WEBSITE_SECTION_TYPE,
  type WebsiteContentKey,
  type WebsiteContentSection,
  type WebsiteLinkDestination,
  type WebsiteSectionType,
} from "@petcare/shared-types";
import { WEBSITE_CONTENT_SEED_TEMPLATES } from "../../seed/seed-website-content";
import { WebsiteSectionTypeRegistry } from "./website-section-type.registry";

function defaultSections(contentKey: WebsiteContentKey): WebsiteContentSection[] {
  const template = WEBSITE_CONTENT_SEED_TEMPLATES.find(
    (candidate) => candidate.contentKey === contentKey,
  );

  if (!template) {
    throw new Error(`Missing seed template: ${contentKey}`);
  }

  return structuredClone(template.sections);
}

function sectionOfType<TType extends WebsiteSectionType>(
  sections: WebsiteContentSection[],
  sectionType: TType,
): Extract<WebsiteContentSection, { sectionType: TType }> {
  const section = sections.find((candidate) => candidate.sectionType === sectionType);

  if (!section) {
    throw new Error(`Missing ${sectionType} section`);
  }

  return section as Extract<WebsiteContentSection, { sectionType: TType }>;
}

function seededSectionOfType<TType extends WebsiteSectionType>(
  sectionType: TType,
): Extract<WebsiteContentSection, { sectionType: TType }> {
  const section = WEBSITE_CONTENT_SEED_TEMPLATES.flatMap((template) => template.sections).find(
    (candidate) => candidate.sectionType === sectionType,
  );

  if (!section) {
    throw new Error(`Missing seeded ${sectionType} section`);
  }

  return structuredClone(section) as Extract<WebsiteContentSection, { sectionType: TType }>;
}

describe("WebsiteSectionTypeRegistry", () => {
  const registry = new WebsiteSectionTypeRegistry();

  it.each(Object.values(WEBSITE_SECTION_TYPE))(
    "accepts the seeded %s section schema",
    (sectionType) => {
      const section = seededSectionOfType(sectionType);

      expect(registry.validate(section)).toEqual([]);
    },
  );

  it("resolves only the managed image asset identifiers referenced by a section", () => {
    const hero = sectionOfType(
      defaultSections(WEBSITE_CONTENT_KEY.HOME),
      WEBSITE_SECTION_TYPE.HERO,
    );
    const feature = sectionOfType(
      defaultSections(WEBSITE_CONTENT_KEY.HOME),
      WEBSITE_SECTION_TYPE.FEATURE_SPLIT,
    );

    hero.content.image.assetId = "hero-asset";
    feature.content.image.assetId = "feature-asset";

    expect(registry.resolveAssetIds(hero)).toEqual(["hero-asset"]);
    expect(registry.resolveAssetIds(feature)).toEqual(["feature-asset"]);
    expect(
      registry.resolveAssetIds(
        sectionOfType(defaultSections(WEBSITE_CONTENT_KEY.HOME), WEBSITE_SECTION_TYPE.CTA),
      ),
    ).toEqual([]);
  });

  it("reports an unknown section discriminator without attempting dynamic execution", () => {
    const section = sectionOfType(
      defaultSections(WEBSITE_CONTENT_KEY.HOME),
      WEBSITE_SECTION_TYPE.HERO,
    );
    const unknownSection = {
      ...section,
      sectionType: "template_from_database",
    } as unknown as WebsiteContentSection;

    expect(registry.validate(unknownSection)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "sectionType" })]),
    );
    expect(registry.resolveAssetIds(unknownSection)).toEqual([]);
  });

  it("reports an unsupported schema version", () => {
    const section = sectionOfType(
      defaultSections(WEBSITE_CONTENT_KEY.HOME),
      WEBSITE_SECTION_TYPE.HERO,
    );

    section.schemaVersion = 2 as 1;

    expect(registry.validate(section)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "schemaVersion" })]),
    );
  });

  it("rejects unsafe action destinations while retaining the allow-listed protocols", () => {
    const unsafeCta = sectionOfType(
      defaultSections(WEBSITE_CONTENT_KEY.HOME),
      WEBSITE_SECTION_TYPE.CTA,
    );

    unsafeCta.content.primaryAction.href = "javascript:alert(1)" as never;

    expect(registry.validate(unsafeCta)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "content.primaryAction.href" })]),
    );

    const destinations: WebsiteLinkDestination[] = [
      "/contact",
      "https://example.com/contact",
      "mailto:service@example.com",
      "tel:+8613800138000",
    ];

    for (const href of destinations) {
      const cta = sectionOfType(
        defaultSections(WEBSITE_CONTENT_KEY.HOME),
        WEBSITE_SECTION_TYPE.CTA,
      );

      cta.content.primaryAction.href = href;

      expect(registry.validate(cta)).toEqual([]);
    }
  });

  it("reports missing required text and disallows stored HTML", () => {
    const cta = sectionOfType(defaultSections(WEBSITE_CONTENT_KEY.HOME), WEBSITE_SECTION_TYPE.CTA);

    cta.content.title = "  ";

    const richText = sectionOfType(
      defaultSections(WEBSITE_CONTENT_KEY.ABOUT),
      WEBSITE_SECTION_TYPE.RICH_TEXT,
    );

    richText.content.title = "<strong>Unsafe</strong>";

    expect(registry.validate(cta)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "content.title" })]),
    );
    expect(registry.validate(richText)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "content.title" })]),
    );
  });

  it("reports missing image alt text and settings outside their bounded values", () => {
    const hero = sectionOfType(
      defaultSections(WEBSITE_CONTENT_KEY.HOME),
      WEBSITE_SECTION_TYPE.HERO,
    );

    hero.content.image.altText = "";
    hero.settings.alignment = "bottom" as never;

    const contactPanel = sectionOfType(
      defaultSections(WEBSITE_CONTENT_KEY.CONTACT),
      WEBSITE_SECTION_TYPE.CONTACT_PANEL,
    );

    contactPanel.settings.columns = 4 as never;

    expect(registry.validate(hero)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "content.image.altText" }),
        expect.objectContaining({ path: "settings.alignment" }),
      ]),
    );
    expect(registry.validate(contactPanel)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "settings.columns" })]),
    );
  });
});
