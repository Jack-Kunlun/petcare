import { Injectable } from "@nestjs/common";
import {
  WEBSITE_CONTENT_KEY,
  type WebsiteContentKey,
  type WebsiteContentSection,
  type WebsiteSectionType,
} from "@petcare/shared-types";
import { WEBSITE_CONTENT_SEED_TEMPLATES } from "../../seed/seed-website-content";
import { websiteContentNotFound, websiteContentValidationFailed } from "./website-content.errors";
import {
  type ValidationIssue,
  WebsiteSectionTypeRegistry,
} from "./website-section-type.registry";

interface TemplateSectionDefinition {
  /** Stable key owned by the fixed page template. */
  sectionKey: string;
  /** Immutable renderer discriminator for the preset section. */
  sectionType: WebsiteSectionType;
  /** Immutable first-release display order. */
  sortOrder: number;
  /** Whether this section must remain visible in the first release. */
  isRequired: boolean;
}

const REQUIRED_SECTION_KEYS = {
  [WEBSITE_CONTENT_KEY.SITE_SHELL]: ["site_header", "site_footer"],
  [WEBSITE_CONTENT_KEY.HOME]: ["hero"],
  [WEBSITE_CONTENT_KEY.SERVICES]: ["hero"],
  [WEBSITE_CONTENT_KEY.TRUST]: ["hero"],
  [WEBSITE_CONTENT_KEY.COMPANIONS]: ["hero"],
  [WEBSITE_CONTENT_KEY.ABOUT]: ["hero"],
  [WEBSITE_CONTENT_KEY.CONTACT]: ["hero", "contact_channels"],
  [WEBSITE_CONTENT_KEY.PRIVACY]: ["legal_content"],
  [WEBSITE_CONTENT_KEY.TERMS]: ["legal_content"],
} satisfies Record<WebsiteContentKey, readonly string[]>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function templateFor(contentKey: WebsiteContentKey) {
  const template = WEBSITE_CONTENT_SEED_TEMPLATES.find(
    (candidate) => candidate.contentKey === contentKey,
  );

  if (!template) {
    throw websiteContentNotFound(contentKey);
  }

  return template;
}

function createTemplateDefinition(contentKey: WebsiteContentKey): TemplateSectionDefinition[] {
  const requiredKeys = REQUIRED_SECTION_KEYS[contentKey];

  return templateFor(contentKey).sections.map((section) => ({
    sectionKey: section.sectionKey,
    sectionType: section.sectionType,
    sortOrder: section.sortOrder,
    isRequired: requiredKeys.includes(section.sectionKey),
  }));
}

function formatIssues(issues: readonly ValidationIssue[]): string {
  const firstIssue = issues[0];

  return firstIssue ? `官网内容校验失败：${firstIssue.path} ${firstIssue.message}` : "官网内容未通过校验";
}

/** Protects first-release pages from section composition mutations while preserving future seams. */
@Injectable()
export class WebsitePageTemplateRegistry {
  /** Creates a template registry backed by the exhaustive section-schema validator. */
  constructor(private readonly sectionTypeRegistry: WebsiteSectionTypeRegistry) {}

  /** Validates one complete page snapshot against its fixed preset section template. */
  validateSnapshot(contentKey: WebsiteContentKey, sections: WebsiteContentSection[]): void {
    const templateSections = createTemplateDefinition(contentKey);
    const issues: ValidationIssue[] = [];
    const snapshot = sections as unknown;

    if (!Array.isArray(snapshot)) {
      throw websiteContentValidationFailed("官网内容校验失败：sections 必须是数组");
    }

    const expectedByKey = new Map(
      templateSections.map((section) => [section.sectionKey, section]),
    );
    const sectionKeys = new Set<string>();
    const sortOrders = new Set<number>();

    snapshot.forEach((section, index) => {
      const sectionPath = `sections[${index}]`;

      if (!isObject(section)) {
        issues.push({ path: sectionPath, message: "必须是区块对象" });

        return;
      }

      if (typeof section.sectionKey !== "string" || section.sectionKey.trim().length === 0) {
        issues.push({ path: `${sectionPath}.sectionKey`, message: "不能为空" });
      } else {
        if (sectionKeys.has(section.sectionKey)) {
          issues.push({ path: `${sectionPath}.sectionKey`, message: "不能重复" });
        }

        sectionKeys.add(section.sectionKey);
      }

      if (
        typeof section.sortOrder !== "number" ||
        !Number.isInteger(section.sortOrder) ||
        section.sortOrder < 1
      ) {
        issues.push({ path: `${sectionPath}.sortOrder`, message: "必须是正整数" });
      } else {
        if (sortOrders.has(section.sortOrder)) {
          issues.push({ path: `${sectionPath}.sortOrder`, message: "不能重复" });
        }

        sortOrders.add(section.sortOrder);
      }

      const expected =
        typeof section.sectionKey === "string"
          ? expectedByKey.get(section.sectionKey)
          : undefined;

      if (!expected) {
        issues.push({ path: `${sectionPath}.sectionKey`, message: "不属于当前页面模板" });
      } else {
        if (section.sectionType !== expected.sectionType) {
          issues.push({ path: `${sectionPath}.sectionType`, message: "不能修改预设区块类型" });
        }

        if (section.sortOrder !== expected.sortOrder) {
          issues.push({ path: `${sectionPath}.sortOrder`, message: "不能修改预设区块顺序" });
        }

        if (expected.isRequired && section.isEnabled !== true) {
          issues.push({ path: `${sectionPath}.isEnabled`, message: "必填区块不能停用" });
        }
      }

      if (isObject(section)) {
        issues.push(
          ...this.sectionTypeRegistry
            .validate(section as unknown as WebsiteContentSection)
            .map((issue) => ({ path: `${sectionPath}.${issue.path}`, message: issue.message })),
        );
      }
    });

    for (const templateSection of templateSections) {
      if (!sectionKeys.has(templateSection.sectionKey)) {
        issues.push({
          path: "sections",
          message: `缺少预设区块：${templateSection.sectionKey}`,
        });
      }
    }

    if (issues.length > 0) {
      throw websiteContentValidationFailed(formatIssues(issues));
    }
  }

  /** Returns a deep-cloned editable default snapshot without mutating Task 2 seed data. */
  createDefaultSections(contentKey: WebsiteContentKey): WebsiteContentSection[] {
    return structuredClone(templateFor(contentKey).sections);
  }
}
