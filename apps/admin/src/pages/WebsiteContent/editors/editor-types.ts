import type { WebsiteContentSection } from "@petcare/shared-types";
import type { ReactNode } from "react";

/** Props shared by strongly typed preset section editors. */
export interface SectionEditorProps<TSection extends WebsiteContentSection> {
  /** Immutable template section being edited. */
  section: TSection;
  /** Replaces one complete section while preserving its template identity. */
  onChange(section: TSection): void;
  /** Disables field interaction when the operator cannot edit the draft. */
  disabled?: boolean;
}

/** A typed editor for one Website Content section discriminator. */
export type WebsiteSectionEditorComponent<TSection extends WebsiteContentSection> = (
  props: SectionEditorProps<TSection>,
) => ReactNode;
