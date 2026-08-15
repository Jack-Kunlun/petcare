import { Injectable } from "@nestjs/common";
import {
  WEBSITE_SECTION_TYPE,
  type WebsiteContentSection,
  type WebsiteImageReference,
  type WebsiteSectionType,
  type WebsiteSiteFooterSection,
  type WebsiteSiteHeaderSection,
  type WebsiteHeroSection,
  type WebsiteTrustGridSection,
  type WebsiteFeatureSplitSection,
  type WebsiteCtaSection,
  type WebsiteRichTextSection,
  type WebsiteContactPanelSection,
} from "@petcare/shared-types";

const SAFE_HTML_PATTERN = /<\/?[a-z][^>]*>/iu;
const SAFE_INTERNAL_PATH_PATTERN = /^\/(?!\/)[^\s\\]*$/u;
const SAFE_MAILTO_PATTERN = /^mailto:[^\s<>]+$/u;
const SAFE_TEL_PATTERN = /^tel:(?=.*\d)[0-9+(). -]+$/u;

/** Field-level Website Content validation detail used before a stable API exception is created. */
export interface ValidationIssue {
  /** Dot-separated field path relative to one section snapshot. */
  path: string;
  /** Safe, operator-facing explanation of the invalid field. */
  message: string;
}

type UnknownObject = Record<string, unknown>;

type SectionDefinition<TSection extends WebsiteContentSection> = {
  schemaVersion: 1;
  validate: (section: TSection) => ValidationIssue[];
  resolveAssetIds: (section: TSection) => string[];
};

type SectionDefinitionMap = {
  [TType in WebsiteSectionType]: SectionDefinition<
    Extract<WebsiteContentSection, { sectionType: TType }>
  >;
};

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function isObject(value: unknown): value is UnknownObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWebsiteSectionType(value: unknown): value is WebsiteSectionType {
  return (
    typeof value === "string" &&
    Object.values(WEBSITE_SECTION_TYPE).includes(value as WebsiteSectionType)
  );
}

function hasOnlyKeys(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
  issues: ValidationIssue[],
): value is UnknownObject {
  if (!isObject(value)) {
    issues.push(issue(path, "必须是对象"));

    return false;
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(issue(`${path}.${key}`, "不支持该字段"));
    }
  }

  return true;
}

function validateText(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  required = true,
): boolean {
  if (typeof value !== "string") {
    issues.push(issue(path, "必须是文本"));

    return false;
  }

  if (required && value.trim().length === 0) {
    issues.push(issue(path, "不能为空"));
  }

  if (SAFE_HTML_PATTERN.test(value)) {
    issues.push(issue(path, "不能包含 HTML"));
  }

  return true;
}

function validateIdentifier(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  return validateText(value, path, issues);
}

function validateOptionalText(value: unknown, path: string, issues: ValidationIssue[]): void {
  validateText(value, path, issues, false);
}

function isSafeLinkDestination(value: string): boolean {
  if (SAFE_INTERNAL_PATH_PATTERN.test(value)) {
    return true;
  }

  if (SAFE_MAILTO_PATTERN.test(value) || SAFE_TEL_PATTERN.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function validateActionLink(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!hasOnlyKeys(value, path, ["label", "href"], issues)) {
    return;
  }

  validateText(value.label, `${path}.label`, issues);

  if (!validateText(value.href, `${path}.href`, issues)) {
    return;
  }

  if (!isSafeLinkDestination(value.href as string)) {
    issues.push(issue(`${path}.href`, "链接协议不安全或格式无效"));
  }
}

function validateActionLinkFields(
  value: UnknownObject,
  path: string,
  issues: ValidationIssue[],
): void {
  validateText(value.label, `${path}.label`, issues);

  if (!validateText(value.href, `${path}.href`, issues)) {
    return;
  }

  if (!isSafeLinkDestination(value.href as string)) {
    issues.push(issue(`${path}.href`, "链接协议不安全或格式无效"));
  }
}

function validateOptionalActionLink(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value !== null) {
    validateActionLink(value, path, issues);
  }
}

function validateImageReference(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!hasOnlyKeys(value, path, ["assetId", "altText"], issues)) {
    return;
  }

  if (value.assetId !== null) {
    validateIdentifier(value.assetId, `${path}.assetId`, issues);
  }

  validateText(value.altText, `${path}.altText`, issues);
}

function validateUniqueKeys(
  values: unknown[],
  keyName: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const keys = new Set<string>();

  values.forEach((value, index) => {
    if (!isObject(value) || typeof value[keyName] !== "string") {
      return;
    }

    const key = value[keyName];

    if (keys.has(key)) {
      issues.push(issue(`${path}[${index}].${keyName}`, "不能重复"));
    }

    keys.add(key);
  });
}

function validateNavigationItem(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!hasOnlyKeys(value, path, ["itemKey", "label", "href"], issues)) {
    return;
  }

  validateIdentifier(value.itemKey, `${path}.itemKey`, issues);
  validateActionLinkFields(value, path, issues);
}

function validateFooterGroup(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!hasOnlyKeys(value, path, ["groupKey", "title", "links"], issues)) {
    return;
  }

  validateIdentifier(value.groupKey, `${path}.groupKey`, issues);
  validateText(value.title, `${path}.title`, issues);

  if (!Array.isArray(value.links) || value.links.length === 0) {
    issues.push(issue(`${path}.links`, "必须至少包含一个链接"));

    return;
  }

  value.links.forEach((link, index) =>
    validateNavigationItem(link, `${path}.links[${index}]`, issues),
  );
  validateUniqueKeys(value.links, "itemKey", `${path}.links`, issues);
}

function validateTrustItem(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!hasOnlyKeys(value, path, ["itemKey", "title", "description", "icon"], issues)) {
    return;
  }

  validateIdentifier(value.itemKey, `${path}.itemKey`, issues);
  validateText(value.title, `${path}.title`, issues);
  validateText(value.description, `${path}.description`, issues);

  if (!["shield", "certificate", "clipboard", "star", "support"].includes(value.icon as string)) {
    issues.push(issue(`${path}.icon`, "必须是已批准的图标"));
  }
}

function validateRichTextPart(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!hasOnlyKeys(value, path, ["partKey", "heading", "paragraphs"], issues)) {
    return;
  }

  validateIdentifier(value.partKey, `${path}.partKey`, issues);
  validateText(value.heading, `${path}.heading`, issues);

  if (!Array.isArray(value.paragraphs) || value.paragraphs.length === 0) {
    issues.push(issue(`${path}.paragraphs`, "必须至少包含一个段落"));

    return;
  }

  value.paragraphs.forEach((paragraph, index) =>
    validateText(paragraph, `${path}.paragraphs[${index}]`, issues),
  );
}

function validateContactChannel(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!hasOnlyKeys(value, path, ["channelKey", "label", "value", "href", "availability"], issues)) {
    return;
  }

  validateIdentifier(value.channelKey, `${path}.channelKey`, issues);
  validateText(value.label, `${path}.label`, issues);
  validateText(value.value, `${path}.value`, issues);
  validateOptionalText(value.availability, `${path}.availability`, issues);

  validateActionLinkFields(value, path, issues);
}

function validateSettingsObject(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
  issues: ValidationIssue[],
): value is UnknownObject {
  return hasOnlyKeys(value, path, allowedKeys, issues);
}

function validateSiteHeader(section: WebsiteSiteHeaderSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!hasOnlyKeys(section.content, "content", ["brandLabel", "navigation", "action"], issues)) {
    return issues;
  }

  validateText(section.content.brandLabel, "content.brandLabel", issues);

  if (!Array.isArray(section.content.navigation) || section.content.navigation.length === 0) {
    issues.push(issue("content.navigation", "必须至少包含一个导航项"));
  } else {
    section.content.navigation.forEach((item, index) =>
      validateNavigationItem(item, `content.navigation[${index}]`, issues),
    );
    validateUniqueKeys(section.content.navigation, "itemKey", "content.navigation", issues);
  }

  validateOptionalActionLink(section.content.action, "content.action", issues);

  if (validateSettingsObject(section.settings, "settings", ["sticky"], issues)) {
    if (typeof section.settings.sticky !== "boolean") {
      issues.push(issue("settings.sticky", "必须是布尔值"));
    }
  }

  return issues;
}

function validateSiteFooter(section: WebsiteSiteFooterSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!hasOnlyKeys(section.content, "content", ["description", "groups", "copyright"], issues)) {
    return issues;
  }

  validateText(section.content.description, "content.description", issues);
  validateText(section.content.copyright, "content.copyright", issues);

  if (!Array.isArray(section.content.groups) || section.content.groups.length === 0) {
    issues.push(issue("content.groups", "必须至少包含一个页脚分组"));
  } else {
    section.content.groups.forEach((group, index) =>
      validateFooterGroup(group, `content.groups[${index}]`, issues),
    );
    validateUniqueKeys(section.content.groups, "groupKey", "content.groups", issues);
  }

  if (validateSettingsObject(section.settings, "settings", ["showLogo"], issues)) {
    if (typeof section.settings.showLogo !== "boolean") {
      issues.push(issue("settings.showLogo", "必须是布尔值"));
    }
  }

  return issues;
}

function validateHero(section: WebsiteHeroSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (
    !hasOnlyKeys(
      section.content,
      "content",
      ["eyebrow", "title", "description", "primaryAction", "secondaryAction", "image"],
      issues,
    )
  ) {
    return issues;
  }

  validateOptionalText(section.content.eyebrow, "content.eyebrow", issues);
  validateText(section.content.title, "content.title", issues);
  validateText(section.content.description, "content.description", issues);
  validateOptionalActionLink(section.content.primaryAction, "content.primaryAction", issues);
  validateOptionalActionLink(section.content.secondaryAction, "content.secondaryAction", issues);
  validateImageReference(section.content.image, "content.image", issues);

  if (
    validateSettingsObject(section.settings, "settings", ["alignment", "imagePosition"], issues)
  ) {
    if (!["left", "center"].includes(section.settings.alignment)) {
      issues.push(issue("settings.alignment", "必须是已批准的对齐方式"));
    }

    if (!["left", "right", "background"].includes(section.settings.imagePosition)) {
      issues.push(issue("settings.imagePosition", "必须是已批准的图片位置"));
    }
  }

  return issues;
}

function validateTrustGrid(section: WebsiteTrustGridSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!hasOnlyKeys(section.content, "content", ["title", "description", "items"], issues)) {
    return issues;
  }

  validateText(section.content.title, "content.title", issues);
  validateOptionalText(section.content.description, "content.description", issues);

  if (!Array.isArray(section.content.items) || section.content.items.length === 0) {
    issues.push(issue("content.items", "必须至少包含一项信任说明"));
  } else {
    section.content.items.forEach((item, index) =>
      validateTrustItem(item, `content.items[${index}]`, issues),
    );
    validateUniqueKeys(section.content.items, "itemKey", "content.items", issues);
  }

  if (validateSettingsObject(section.settings, "settings", ["columns"], issues)) {
    if (![2, 3, 4].includes(section.settings.columns)) {
      issues.push(issue("settings.columns", "必须是 2、3 或 4"));
    }
  }

  return issues;
}

function validateFeatureSplit(section: WebsiteFeatureSplitSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (
    !hasOnlyKeys(
      section.content,
      "content",
      ["eyebrow", "title", "description", "action", "image"],
      issues,
    )
  ) {
    return issues;
  }

  validateOptionalText(section.content.eyebrow, "content.eyebrow", issues);
  validateText(section.content.title, "content.title", issues);
  validateText(section.content.description, "content.description", issues);
  validateOptionalActionLink(section.content.action, "content.action", issues);
  validateImageReference(section.content.image, "content.image", issues);

  if (validateSettingsObject(section.settings, "settings", ["imagePosition", "tone"], issues)) {
    if (!["left", "right"].includes(section.settings.imagePosition)) {
      issues.push(issue("settings.imagePosition", "必须是已批准的图片位置"));
    }

    if (!["plain", "soft", "accent"].includes(section.settings.tone)) {
      issues.push(issue("settings.tone", "必须是已批准的视觉风格"));
    }
  }

  return issues;
}

function validateCta(section: WebsiteCtaSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (
    !hasOnlyKeys(
      section.content,
      "content",
      ["title", "description", "primaryAction", "secondaryAction"],
      issues,
    )
  ) {
    return issues;
  }

  validateText(section.content.title, "content.title", issues);
  validateText(section.content.description, "content.description", issues);
  validateActionLink(section.content.primaryAction, "content.primaryAction", issues);
  validateOptionalActionLink(section.content.secondaryAction, "content.secondaryAction", issues);

  if (validateSettingsObject(section.settings, "settings", ["tone", "alignment"], issues)) {
    if (!["brand", "soft"].includes(section.settings.tone)) {
      issues.push(issue("settings.tone", "必须是已批准的视觉风格"));
    }

    if (!["left", "center"].includes(section.settings.alignment)) {
      issues.push(issue("settings.alignment", "必须是已批准的对齐方式"));
    }
  }

  return issues;
}

function validateRichText(section: WebsiteRichTextSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!hasOnlyKeys(section.content, "content", ["title", "effectiveDate", "parts"], issues)) {
    return issues;
  }

  validateText(section.content.title, "content.title", issues);

  if (section.content.effectiveDate !== null) {
    validateText(section.content.effectiveDate, "content.effectiveDate", issues);
  }

  if (!Array.isArray(section.content.parts) || section.content.parts.length === 0) {
    issues.push(issue("content.parts", "必须至少包含一个文本小节"));
  } else {
    section.content.parts.forEach((part, index) =>
      validateRichTextPart(part, `content.parts[${index}]`, issues),
    );
    validateUniqueKeys(section.content.parts, "partKey", "content.parts", issues);
  }

  if (validateSettingsObject(section.settings, "settings", ["width"], issues)) {
    if (!["normal", "wide"].includes(section.settings.width)) {
      issues.push(issue("settings.width", "必须是已批准的内容宽度"));
    }
  }

  return issues;
}

function validateContactPanel(section: WebsiteContactPanelSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!hasOnlyKeys(section.content, "content", ["title", "description", "channels"], issues)) {
    return issues;
  }

  validateText(section.content.title, "content.title", issues);
  validateText(section.content.description, "content.description", issues);

  if (!Array.isArray(section.content.channels) || section.content.channels.length === 0) {
    issues.push(issue("content.channels", "必须至少包含一个联系渠道"));
  } else {
    section.content.channels.forEach((channel, index) =>
      validateContactChannel(channel, `content.channels[${index}]`, issues),
    );
    validateUniqueKeys(section.content.channels, "channelKey", "content.channels", issues);
  }

  if (validateSettingsObject(section.settings, "settings", ["columns"], issues)) {
    if (![1, 2, 3].includes(section.settings.columns)) {
      issues.push(issue("settings.columns", "必须是 1、2 或 3"));
    }
  }

  return issues;
}

function resolveImageAssetIds(images: readonly WebsiteImageReference[]): string[] {
  return images.flatMap((image) => (typeof image.assetId === "string" ? [image.assetId] : []));
}

const siteHeaderDefinition: SectionDefinition<WebsiteSiteHeaderSection> = {
  schemaVersion: 1,
  validate: validateSiteHeader,
  resolveAssetIds: () => [],
};

const siteFooterDefinition: SectionDefinition<WebsiteSiteFooterSection> = {
  schemaVersion: 1,
  validate: validateSiteFooter,
  resolveAssetIds: () => [],
};

const heroDefinition: SectionDefinition<WebsiteHeroSection> = {
  schemaVersion: 1,
  validate: validateHero,
  resolveAssetIds: (section) => resolveImageAssetIds([section.content.image]),
};

const trustGridDefinition: SectionDefinition<WebsiteTrustGridSection> = {
  schemaVersion: 1,
  validate: validateTrustGrid,
  resolveAssetIds: () => [],
};

const featureSplitDefinition: SectionDefinition<WebsiteFeatureSplitSection> = {
  schemaVersion: 1,
  validate: validateFeatureSplit,
  resolveAssetIds: (section) => resolveImageAssetIds([section.content.image]),
};

const ctaDefinition: SectionDefinition<WebsiteCtaSection> = {
  schemaVersion: 1,
  validate: validateCta,
  resolveAssetIds: () => [],
};

const richTextDefinition: SectionDefinition<WebsiteRichTextSection> = {
  schemaVersion: 1,
  validate: validateRichText,
  resolveAssetIds: () => [],
};

const contactPanelDefinition: SectionDefinition<WebsiteContactPanelSection> = {
  schemaVersion: 1,
  validate: validateContactPanel,
  resolveAssetIds: () => [],
};

const definitions = {
  [WEBSITE_SECTION_TYPE.SITE_HEADER]: siteHeaderDefinition,
  [WEBSITE_SECTION_TYPE.SITE_FOOTER]: siteFooterDefinition,
  [WEBSITE_SECTION_TYPE.HERO]: heroDefinition,
  [WEBSITE_SECTION_TYPE.TRUST_GRID]: trustGridDefinition,
  [WEBSITE_SECTION_TYPE.FEATURE_SPLIT]: featureSplitDefinition,
  [WEBSITE_SECTION_TYPE.CTA]: ctaDefinition,
  [WEBSITE_SECTION_TYPE.RICH_TEXT]: richTextDefinition,
  [WEBSITE_SECTION_TYPE.CONTACT_PANEL]: contactPanelDefinition,
} satisfies SectionDefinitionMap;

/** Validates the code-registered schemas for Website Content section snapshots. */
@Injectable()
export class WebsiteSectionTypeRegistry {
  /** Returns every safe field issue without executing data-provided code or accepting HTML. */
  validate(section: WebsiteContentSection): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const untypedSection = section as unknown;

    if (
      !hasOnlyKeys(
        untypedSection,
        "section",
        [
          "sectionKey",
          "sectionType",
          "sortOrder",
          "isEnabled",
          "schemaVersion",
          "content",
          "settings",
        ],
        issues,
      )
    ) {
      return issues;
    }

    validateIdentifier(untypedSection.sectionKey, "sectionKey", issues);

    if (!isWebsiteSectionType(untypedSection.sectionType)) {
      issues.push(issue("sectionType", "不支持该区块类型"));

      return issues;
    }

    if (
      typeof untypedSection.sortOrder !== "number" ||
      !Number.isInteger(untypedSection.sortOrder) ||
      untypedSection.sortOrder < 1
    ) {
      issues.push(issue("sortOrder", "必须是正整数"));
    }

    if (typeof untypedSection.isEnabled !== "boolean") {
      issues.push(issue("isEnabled", "必须是布尔值"));
    }

    const definition = definitions[
      untypedSection.sectionType
    ] as SectionDefinition<WebsiteContentSection>;

    if (untypedSection.schemaVersion !== definition.schemaVersion) {
      issues.push(issue("schemaVersion", "不支持该区块结构版本"));

      return issues;
    }

    return [...issues, ...definition.validate(section)];
  }

  /** Returns referenced managed-media identifiers in stable appearance order. */
  resolveAssetIds(section: WebsiteContentSection): string[] {
    const untypedSection = section as unknown;

    if (!isObject(untypedSection) || !isWebsiteSectionType(untypedSection.sectionType)) {
      return [];
    }

    const definition = definitions[
      untypedSection.sectionType
    ] as SectionDefinition<WebsiteContentSection>;

    return definition.resolveAssetIds(section);
  }
}
