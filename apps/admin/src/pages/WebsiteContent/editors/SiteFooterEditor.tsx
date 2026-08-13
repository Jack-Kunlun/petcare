import type { WebsiteSiteFooterSection } from "@petcare/shared-types";
import type { SectionEditorProps } from "./editor-types";
import { CheckboxField, TextField } from "./fields";

/** Edits the fixed footer groups and links without allowing group composition changes. */
export function SiteFooterEditor({
  section,
  onChange,
  disabled = false,
}: SectionEditorProps<WebsiteSiteFooterSection>) {
  const updateContent = (content: WebsiteSiteFooterSection["content"]) =>
    onChange({ ...section, content });

  return (
    <div className="space-y-4">
      <TextField
        label="页脚品牌说明"
        value={section.content.description}
        disabled={disabled}
        required
        multiline
        onChange={(description) => updateContent({ ...section.content, description })}
      />
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">固定页脚链接</legend>
        <div className="mt-3 space-y-5">
          {section.content.groups.map((group, groupIndex) => (
            <div key={group.groupKey} className="rounded-lg bg-slate-50 p-3">
              <TextField
                label={`页脚分组 ${group.title} 标题`}
                value={group.title}
                disabled={disabled}
                required
                onChange={(title) => {
                  const groups = section.content.groups.map((candidate, candidateIndex) =>
                    candidateIndex === groupIndex ? { ...candidate, title } : candidate,
                  );

                  updateContent({ ...section.content, groups });
                }}
              />
              <div className="mt-3 space-y-3">
                {group.links.map((link, linkIndex) => (
                  <div key={link.itemKey} className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label={`页脚链接 ${link.label} 文案`}
                      value={link.label}
                      disabled={disabled}
                      required
                      onChange={(label) => {
                        const groups = section.content.groups.map((candidate, candidateIndex) => {
                          if (candidateIndex !== groupIndex) {
                            return candidate;
                          }

                          return {
                            ...candidate,
                            links: candidate.links.map((candidateLink, candidateLinkIndex) =>
                              candidateLinkIndex === linkIndex
                                ? { ...candidateLink, label }
                                : candidateLink,
                            ),
                          };
                        });

                        updateContent({ ...section.content, groups });
                      }}
                    />
                    <TextField
                      label={`页脚链接 ${link.label} 链接`}
                      value={link.href}
                      disabled={disabled}
                      required
                      onChange={(href) => {
                        const groups = section.content.groups.map((candidate, candidateIndex) => {
                          if (candidateIndex !== groupIndex) {
                            return candidate;
                          }

                          return {
                            ...candidate,
                            links: candidate.links.map((candidateLink, candidateLinkIndex) =>
                              candidateLinkIndex === linkIndex
                                ? { ...candidateLink, href: href as typeof candidateLink.href }
                                : candidateLink,
                            ),
                          };
                        });

                        updateContent({ ...section.content, groups });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <TextField
        label="版权文案"
        value={section.content.copyright}
        disabled={disabled}
        required
        onChange={(copyright) => updateContent({ ...section.content, copyright })}
      />
      <CheckboxField
        label="显示已批准的品牌标识"
        checked={section.settings.showLogo}
        disabled={disabled}
        onChange={(showLogo) => onChange({ ...section, settings: { ...section.settings, showLogo } })}
      />
    </div>
  );
}
