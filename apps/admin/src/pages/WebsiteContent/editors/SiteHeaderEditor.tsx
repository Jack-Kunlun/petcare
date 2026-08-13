import type { WebsiteSiteHeaderSection } from "@petcare/shared-types";
import type { SectionEditorProps } from "./editor-types";
import { ActionLinkFields, CheckboxField, TextField } from "./fields";

/** Edits the fixed shared navigation header while retaining its template-owned item keys. */
export function SiteHeaderEditor({
  section,
  onChange,
  disabled = false,
}: SectionEditorProps<WebsiteSiteHeaderSection>) {
  const updateContent = (content: WebsiteSiteHeaderSection["content"]) =>
    onChange({ ...section, content });

  return (
    <div className="space-y-4">
      <TextField
        label="品牌名称"
        value={section.content.brandLabel}
        disabled={disabled}
        required
        onChange={(brandLabel) => updateContent({ ...section.content, brandLabel })}
      />
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">固定导航项</legend>
        <div className="mt-3 space-y-3">
          {section.content.navigation.map((item, index) => (
            <div key={item.itemKey} className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={`导航项 ${item.label} 文案`}
                value={item.label}
                disabled={disabled}
                required
                onChange={(label) => {
                  const navigation = section.content.navigation.map((candidate, candidateIndex) =>
                    candidateIndex === index ? { ...candidate, label } : candidate,
                  );

                  updateContent({ ...section.content, navigation });
                }}
              />
              <TextField
                label={`导航项 ${item.label} 链接`}
                value={item.href}
                disabled={disabled}
                required
                onChange={(href) => {
                  const navigation = section.content.navigation.map((candidate, candidateIndex) =>
                    candidateIndex === index
                      ? { ...candidate, href: href as typeof candidate.href }
                      : candidate,
                  );

                  updateContent({ ...section.content, navigation });
                }}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <ActionLinkFields
        label="页头行动按钮"
        value={section.content.action}
        disabled={disabled}
        onChange={(action) => updateContent({ ...section.content, action })}
      />
      <CheckboxField
        label="滚动时固定页头"
        checked={section.settings.sticky}
        disabled={disabled}
        onChange={(sticky) => onChange({ ...section, settings: { ...section.settings, sticky } })}
      />
    </div>
  );
}
