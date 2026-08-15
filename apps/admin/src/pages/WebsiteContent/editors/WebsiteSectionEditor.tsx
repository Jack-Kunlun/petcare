import type {
  WebsiteContentSection,
  WebsiteContactPanelSection,
  WebsiteCtaSection,
  WebsiteFeatureSplitSection,
  WebsiteHeroSection,
  WebsiteRichTextSection,
  WebsiteSectionType,
  WebsiteSiteFooterSection,
  WebsiteSiteHeaderSection,
  WebsiteTrustGridSection,
} from "@petcare/shared-types";
import type { ReactNode } from "react";
import { ContactPanelEditor } from "./ContactPanelEditor";
import { CtaEditor } from "./CtaEditor";
import { FeatureSplitEditor } from "./FeatureSplitEditor";
import { HeroEditor } from "./HeroEditor";
import { RichTextEditor } from "./RichTextEditor";
import { SiteFooterEditor } from "./SiteFooterEditor";
import { SiteHeaderEditor } from "./SiteHeaderEditor";
import { TrustGridEditor } from "./TrustGridEditor";

export interface WebsiteSectionEditorProps {
  /** One fixed template section. */
  section: WebsiteContentSection;
  /** Replaces one typed section in the complete draft snapshot. */
  onChange(section: WebsiteContentSection): void;
  /** Whether the template allows this section to be hidden. */
  canDisable?: boolean;
  /** Disables all controls for read-only operators. */
  disabled?: boolean;
}

/** Component boundary used by the exhaustive section editor map. */
export type WebsiteSectionEditorComponent = (props: WebsiteSectionEditorProps) => ReactNode;

const sectionTitle: Record<WebsiteSectionType, string> = {
  site_header: "站点页头",
  site_footer: "站点页脚",
  hero: "首屏介绍",
  trust_grid: "信任说明网格",
  feature_split: "图文特性介绍",
  cta: "行动号召",
  rich_text: "结构化正文",
  contact_panel: "联系渠道",
};

/** Exhaustive dispatch map for the shared Website Content section discriminator. */
// eslint-disable-next-line react-refresh/only-export-components -- exported for the discriminator contract test.
export const editorByType = {
  site_header: (props) => (
    <SiteHeaderEditor
      {...props}
      section={props.section as WebsiteSiteHeaderSection}
      onChange={props.onChange as (section: WebsiteSiteHeaderSection) => void}
    />
  ),
  site_footer: (props) => (
    <SiteFooterEditor
      {...props}
      section={props.section as WebsiteSiteFooterSection}
      onChange={props.onChange as (section: WebsiteSiteFooterSection) => void}
    />
  ),
  hero: (props) => (
    <HeroEditor
      {...props}
      section={props.section as WebsiteHeroSection}
      onChange={props.onChange as (section: WebsiteHeroSection) => void}
    />
  ),
  trust_grid: (props) => (
    <TrustGridEditor
      {...props}
      section={props.section as WebsiteTrustGridSection}
      onChange={props.onChange as (section: WebsiteTrustGridSection) => void}
    />
  ),
  feature_split: (props) => (
    <FeatureSplitEditor
      {...props}
      section={props.section as WebsiteFeatureSplitSection}
      onChange={props.onChange as (section: WebsiteFeatureSplitSection) => void}
    />
  ),
  cta: (props) => (
    <CtaEditor
      {...props}
      section={props.section as WebsiteCtaSection}
      onChange={props.onChange as (section: WebsiteCtaSection) => void}
    />
  ),
  rich_text: (props) => (
    <RichTextEditor
      {...props}
      section={props.section as WebsiteRichTextSection}
      onChange={props.onChange as (section: WebsiteRichTextSection) => void}
    />
  ),
  contact_panel: (props) => (
    <ContactPanelEditor
      {...props}
      section={props.section as WebsiteContactPanelSection}
      onChange={props.onChange as (section: WebsiteContactPanelSection) => void}
    />
  ),
} satisfies Record<WebsiteSectionType, WebsiteSectionEditorComponent>;

/** Renders one fixed-order section card without exposing composition controls. */
export function WebsiteSectionEditor({
  section,
  onChange,
  canDisable = true,
  disabled = false,
}: WebsiteSectionEditorProps) {
  const Editor = editorByType[section.sectionType];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-blue-800">区块 {section.sortOrder}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {sectionTitle[section.sectionType]}
          </h2>
          <p className="mt-1 text-sm text-slate-500">预设键：{section.sectionKey}</p>
        </div>
        {canDisable ? (
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 has-[:disabled]:opacity-60">
            <input
              type="checkbox"
              aria-label={`显示 ${sectionTitle[section.sectionType]}`}
              checked={section.isEnabled}
              disabled={disabled}
              onChange={(event) => onChange({ ...section, isEnabled: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
            />
            <span className="text-sm font-medium text-slate-800">显示区块</span>
          </label>
        ) : (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            此区块为页面必需区块
          </p>
        )}
      </div>
      {section.isEnabled ? (
        <div className="mt-5">
          <Editor
            section={section}
            onChange={onChange}
            disabled={disabled}
            canDisable={canDisable}
          />
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
          区块已隐藏，保存草稿后不会在官网中渲染；其预设顺序和类型仍保持不变。
        </p>
      )}
    </section>
  );
}
