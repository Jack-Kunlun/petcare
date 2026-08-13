import type { WebsitePublicContentSection } from "@petcare/shared-types";

/** Narrows unknown shell fallback values to the public section union before rendering. */
export function isRenderablePublicSection(value: unknown): value is WebsitePublicContentSection {
  return (
    typeof value === "object" &&
    value !== null &&
    "sectionType" in value &&
    "schemaVersion" in value &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1
  );
}
