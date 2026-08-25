import {
  WEBSITE_CONTENT_ERROR_CODE,
  WEBSITE_CONTENT_KEY,
  WEBSITE_SECTION_TYPE,
  type WebsiteContentKey,
  type WebsiteContentSection,
} from "@petcare/shared-types";
import { WEBSITE_CONTENT_SEED_TEMPLATES } from "../../seed/seed-website-content";
import { WebsitePageTemplateRegistry } from "./website-page-template.registry";
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

function invalidContentError(callback: () => void): unknown {
  try {
    callback();
  } catch (error) {
    return error;
  }

  throw new Error("Expected Website Content validation to reject the snapshot");
}

describe("WebsitePageTemplateRegistry", () => {
  const registry = new WebsitePageTemplateRegistry(new WebsiteSectionTypeRegistry());

  it("creates a deep-cloned default section snapshot from the Task 2 seed templates", () => {
    const first = registry.createDefaultSections(WEBSITE_CONTENT_KEY.HOME);
    const second = registry.createDefaultSections(WEBSITE_CONTENT_KEY.HOME);

    expect(first).toEqual(defaultSections(WEBSITE_CONTENT_KEY.HOME));

    first[0].sectionKey = "changed_only_in_callers_copy";

    expect(second).toEqual(defaultSections(WEBSITE_CONTENT_KEY.HOME));
  });

  it.each(WEBSITE_CONTENT_SEED_TEMPLATES)(
    "accepts the fixed seeded $contentKey snapshot",
    ({ contentKey }) => {
      expect(() =>
        registry.validateSnapshot(contentKey, defaultSections(contentKey)),
      ).not.toThrow();
    },
  );

  it("rejects duplicate section keys and duplicate sort orders", () => {
    const duplicateKeySections = defaultSections(WEBSITE_CONTENT_KEY.HOME);

    duplicateKeySections[1].sectionKey = duplicateKeySections[0].sectionKey;

    const duplicateOrderSections = defaultSections(WEBSITE_CONTENT_KEY.HOME);

    duplicateOrderSections[1].sortOrder = duplicateOrderSections[0].sortOrder;

    expect(
      invalidContentError(() =>
        registry.validateSnapshot(WEBSITE_CONTENT_KEY.HOME, duplicateKeySections),
      ),
    ).toMatchObject({
      code: WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT,
    });
    expect(
      invalidContentError(() =>
        registry.validateSnapshot(WEBSITE_CONTENT_KEY.HOME, duplicateOrderSections),
      ),
    ).toMatchObject({
      code: WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT,
    });
  });

  it("rejects missing and newly inserted preset sections", () => {
    const missingSection = defaultSections(WEBSITE_CONTENT_KEY.HOME);

    missingSection.pop();

    const addedSection = defaultSections(WEBSITE_CONTENT_KEY.HOME);

    addedSection.push({
      ...structuredClone(addedSection[0]),
      sectionKey: "new_section",
      sortOrder: 99,
    });

    expect(
      invalidContentError(() =>
        registry.validateSnapshot(WEBSITE_CONTENT_KEY.HOME, missingSection),
      ),
    ).toMatchObject({
      code: WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT,
    });
    expect(
      invalidContentError(() => registry.validateSnapshot(WEBSITE_CONTENT_KEY.HOME, addedSection)),
    ).toMatchObject({
      code: WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT,
    });
  });

  it("upgrades only the legacy home snapshot that predates home_experience", () => {
    const legacyHome = defaultSections(WEBSITE_CONTENT_KEY.HOME).filter(
      (section) => section.sectionKey !== "home_experience",
    );
    const legacyCta = legacyHome.find((section) => section.sectionKey === "home_cta");

    if (!legacyCta) {
      throw new Error("Home CTA seed section is required for this test");
    }

    legacyCta.sortOrder = 4;

    expect(() => registry.validateSnapshot(WEBSITE_CONTENT_KEY.HOME, legacyHome)).not.toThrow();

    const upgraded = registry.createEditableSections(WEBSITE_CONTENT_KEY.HOME, legacyHome);

    expect(upgraded.map(({ sectionKey, sortOrder }) => ({ sectionKey, sortOrder }))).toEqual([
      { sectionKey: "hero", sortOrder: 1 },
      { sectionKey: "trust_evidence", sortOrder: 2 },
      { sectionKey: "service_modes", sortOrder: 3 },
      { sectionKey: "home_experience", sortOrder: 4 },
      { sectionKey: "home_cta", sortOrder: 5 },
    ]);
  });

  it("rejects changing a preset type or its display order", () => {
    const changedType = defaultSections(WEBSITE_CONTENT_KEY.HOME);

    changedType[0].sectionType = WEBSITE_SECTION_TYPE.CTA as never;

    const reordered = defaultSections(WEBSITE_CONTENT_KEY.HOME);

    [reordered[0].sortOrder, reordered[1].sortOrder] = [
      reordered[1].sortOrder,
      reordered[0].sortOrder,
    ];

    expect(
      invalidContentError(() => registry.validateSnapshot(WEBSITE_CONTENT_KEY.HOME, changedType)),
    ).toMatchObject({
      code: WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT,
    });
    expect(
      invalidContentError(() => registry.validateSnapshot(WEBSITE_CONTENT_KEY.HOME, reordered)),
    ).toMatchObject({
      code: WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT,
    });
  });

  it("rejects disabling required sections but permits template-approved optional sections", () => {
    const requiredDisabled = defaultSections(WEBSITE_CONTENT_KEY.HOME);
    const homeExperience = requiredDisabled.find(
      (section) => section.sectionKey === "home_experience",
    );

    if (!homeExperience) {
      throw new Error("Home experience seed section is required for this test");
    }

    homeExperience.isEnabled = false;

    const optionalDisabled = defaultSections(WEBSITE_CONTENT_KEY.HOME);
    const homeCta = optionalDisabled.find((section) => section.sectionKey === "home_cta");

    if (!homeCta) {
      throw new Error("Home CTA seed section is required for this test");
    }

    homeCta.isEnabled = false;

    expect(
      invalidContentError(() =>
        registry.validateSnapshot(WEBSITE_CONTENT_KEY.HOME, requiredDisabled),
      ),
    ).toMatchObject({
      code: WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT,
    });
    expect(() =>
      registry.validateSnapshot(WEBSITE_CONTENT_KEY.HOME, optionalDisabled),
    ).not.toThrow();
  });

  it("rejects disabling the required contact channel panel", () => {
    const sections = defaultSections(WEBSITE_CONTENT_KEY.CONTACT);
    const contactChannels = sections.find((section) => section.sectionKey === "contact_channels");

    if (!contactChannels) {
      throw new Error("Contact channel seed section is required for this test");
    }

    contactChannels.isEnabled = false;

    expect(
      invalidContentError(() => registry.validateSnapshot(WEBSITE_CONTENT_KEY.CONTACT, sections)),
    ).toMatchObject({ code: WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT });
  });

  it("keeps all fixed help categories optional to display", () => {
    const sections = defaultSections(WEBSITE_CONTENT_KEY.HELP);

    sections.forEach((section) => {
      section.isEnabled = false;
    });

    expect(() => registry.validateSnapshot(WEBSITE_CONTENT_KEY.HELP, sections)).not.toThrow();
  });

  it("keeps the help category composition fixed", () => {
    const missing = defaultSections(WEBSITE_CONTENT_KEY.HELP);
    const added = defaultSections(WEBSITE_CONTENT_KEY.HELP);
    const reordered = defaultSections(WEBSITE_CONTENT_KEY.HELP);
    const changedType = defaultSections(WEBSITE_CONTENT_KEY.HELP);

    missing.pop();
    added.push({ ...structuredClone(added[0]), sectionKey: "new_category", sortOrder: 5 });
    [reordered[0].sortOrder, reordered[1].sortOrder] = [
      reordered[1].sortOrder,
      reordered[0].sortOrder,
    ];
    changedType[0].sectionType = WEBSITE_SECTION_TYPE.CTA as never;

    for (const sections of [missing, added, reordered, changedType]) {
      expect(
        invalidContentError(() => registry.validateSnapshot(WEBSITE_CONTENT_KEY.HELP, sections)),
      ).toMatchObject({ code: WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT });
    }
  });
});
