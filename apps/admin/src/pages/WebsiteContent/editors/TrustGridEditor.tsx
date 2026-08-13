import type { WebsiteTrustGridSection } from "@petcare/shared-types";
import type { SectionEditorProps } from "./editor-types";
import { SelectField, TextField } from "./fields";

/** Edits a template-owned set of trust claims without adding or removing claims. */
export function TrustGridEditor({
  section,
  onChange,
  disabled = false,
}: SectionEditorProps<WebsiteTrustGridSection>) {
  const updateContent = (content: WebsiteTrustGridSection["content"]) =>
    onChange({ ...section, content });

  return (
    <div className="space-y-4">
      <TextField
        label="区块标题"
        value={section.content.title}
        disabled={disabled}
        required
        onChange={(title) => updateContent({ ...section.content, title })}
      />
      <TextField
        label="区块说明"
        value={section.content.description}
        disabled={disabled}
        multiline
        onChange={(description) => updateContent({ ...section.content, description })}
      />
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">固定信任说明</legend>
        <div className="mt-3 space-y-4">
          {section.content.items.map((item, index) => (
            <div key={item.itemKey} className="rounded-lg bg-slate-50 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label={`信任项 ${item.title} 标题`}
                  value={item.title}
                  disabled={disabled}
                  required
                  onChange={(title) => {
                    const items = section.content.items.map((candidate, candidateIndex) =>
                      candidateIndex === index ? { ...candidate, title } : candidate,
                    );

                    updateContent({ ...section.content, items });
                  }}
                />
                <SelectField
                  label={`信任项 ${item.title} 图标`}
                  value={item.icon}
                  disabled={disabled}
                  options={[
                    { value: "shield", label: "守护" },
                    { value: "certificate", label: "认证" },
                    { value: "clipboard", label: "清单" },
                    { value: "star", label: "星标" },
                    { value: "support", label: "支持" },
                  ]}
                  onChange={(icon) => {
                    const items = section.content.items.map((candidate, candidateIndex) =>
                      candidateIndex === index ? { ...candidate, icon } : candidate,
                    );

                    updateContent({ ...section.content, items });
                  }}
                />
              </div>
              <div className="mt-3">
                <TextField
                  label={`信任项 ${item.title} 说明`}
                  value={item.description}
                  disabled={disabled}
                  required
                  multiline
                  onChange={(description) => {
                    const items = section.content.items.map((candidate, candidateIndex) =>
                      candidateIndex === index ? { ...candidate, description } : candidate,
                    );

                    updateContent({ ...section.content, items });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <SelectField
        label="宽屏列数"
        value={section.settings.columns}
        disabled={disabled}
        options={[
          { value: 2, label: "2 列" },
          { value: 3, label: "3 列" },
          { value: 4, label: "4 列" },
        ]}
        onChange={(columns) => onChange({ ...section, settings: { ...section.settings, columns } })}
      />
    </div>
  );
}
