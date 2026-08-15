import { Injectable, Optional } from "@nestjs/common";
import {
  WEBSITE_CONTENT_DIFF_CHANGE_TYPE,
  type WebsiteContentDiffItem,
  type WebsiteContentDiffChangeType,
  type WebsiteContentDiffResponse,
  type WebsiteContentDiffValue,
  type WebsiteContentKey,
} from "@petcare/shared-types";
import { WebsiteContentRepository } from "./website-content.repository";

type Snapshot = { seo: unknown; sections: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }

  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function indexSections(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const keyed = new Map<string, unknown>();

  for (const section of value) {
    if (
      !isObject(section) ||
      typeof section.sectionKey !== "string" ||
      keyed.has(section.sectionKey)
    ) {
      return value;
    }

    keyed.set(section.sectionKey, section);
  }

  return Object.fromEntries(
    [...keyed.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

/** Produces stable field-level Website Content snapshot differences. */
@Injectable()
export class WebsiteContentDiffService {
  constructor(@Optional() private readonly repository?: WebsiteContentRepository) {}

  /** Compares the current draft against its independently published snapshot. */
  async diffDraftFromPublished(contentKey: WebsiteContentKey): Promise<WebsiteContentDiffResponse> {
    if (!this.repository) {
      return [];
    }

    const { draft, published } = await this.repository.getDraftAndPublished(contentKey);

    return this.diff(
      published ? { seo: published.seo, sections: published.sections } : { seo: {}, sections: [] },
      { seo: draft.seo, sections: draft.sections },
    );
  }

  /** Compares two snapshots using section keys instead of array positions. */
  diff(before: Snapshot, after: Snapshot): WebsiteContentDiffResponse {
    const output: WebsiteContentDiffItem[] = [];

    this.walk(
      { seo: before.seo, sections: indexSections(before.sections) },
      { seo: after.seo, sections: indexSections(after.sections) },
      "",
      output,
    );

    return output.sort((left, right) => left.path.localeCompare(right.path));
  }

  private walk(
    before: unknown,
    after: unknown,
    path: string,
    output: WebsiteContentDiffItem[],
  ): void {
    if (canonical(before) === canonical(after)) {
      return;
    }

    if (isObject(before) && isObject(after)) {
      const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

      keys.forEach((key) =>
        this.walk(before[key], after[key], path ? `${path}.${key}` : key, output),
      );

      return;
    }

    let changeType: WebsiteContentDiffChangeType = WEBSITE_CONTENT_DIFF_CHANGE_TYPE.MODIFIED;

    if (before === undefined) {
      changeType = WEBSITE_CONTENT_DIFF_CHANGE_TYPE.ADDED;
    }

    if (after === undefined) {
      changeType = WEBSITE_CONTENT_DIFF_CHANGE_TYPE.REMOVED;
    }

    output.push({
      path,
      before: before as WebsiteContentDiffValue | undefined,
      after: after as WebsiteContentDiffValue | undefined,
      changeType,
    });
  }
}
