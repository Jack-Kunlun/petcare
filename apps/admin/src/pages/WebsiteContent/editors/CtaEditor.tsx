import type { WebsiteCtaSection } from "@petcare/shared-types";
import type { SectionEditorProps } from "./editor-types";
import { ActionLinkFields, SelectField, TextField } from "./fields";

/** Edits the fixed call-to-action fields and approved visual variants. */
export function CtaEditor({ section, onChange, disabled = false }: SectionEditorProps<WebsiteCtaSection>) {
  const updateContent = (content: WebsiteCtaSection["content"]) =>
    onChange({ ...section, content });

  return (
    <div className="space-y-4">
      <TextField
        label="行动标题"
        value={section.content.title}
        disabled={disabled}
        required
        onChange={(title) => updateContent({ ...section.content, title })}
      />
      <TextField
        label="行动说明"
        value={section.content.description}
        disabled={disabled}
        required
        multiline
        onChange={(description) => updateContent({ ...section.content, description })}
      />
      <ActionLinkFields
        label="主要行动按钮"
        value={section.content.primaryAction}
        disabled={disabled}
        required
        onChange={(primaryAction) => {
          if (primaryAction) {
            updateContent({ ...section.content, primaryAction });
          }
        }}
      />
      <ActionLinkFields
        label="次要行动按钮"
        value={section.content.secondaryAction}
        disabled={disabled}
        onChange={(secondaryAction) => updateContent({ ...section.content, secondaryAction })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="强调风格"
          value={section.settings.tone}
          disabled={disabled}
          options={[
            { value: "brand", label: "品牌" },
            { value: "soft", label: "柔和" },
          ]}
          onChange={(tone) => onChange({ ...section, settings: { ...section.settings, tone } })}
        />
        <SelectField
          label="文本对齐"
          value={section.settings.alignment}
          disabled={disabled}
          options={[
            { value: "left", label: "左对齐" },
            { value: "center", label: "居中" },
          ]}
          onChange={(alignment) => onChange({ ...section, settings: { ...section.settings, alignment } })}
        />
      </div>
    </div>
  );
}
