import type { WebsiteFeatureSplitSection } from "@petcare/shared-types";
import { MediaAssetPicker } from "../MediaAssetPicker";
import type { SectionEditorProps } from "./editor-types";
import { ActionLinkFields, SelectField, TextField } from "./fields";

/** Edits a bounded text-and-image feature section. */
export function FeatureSplitEditor({
  section,
  onChange,
  disabled = false,
}: SectionEditorProps<WebsiteFeatureSplitSection>) {
  const updateContent = (content: WebsiteFeatureSplitSection["content"]) =>
    onChange({ ...section, content });

  return (
    <div className="space-y-4">
      <TextField
        label="眉题"
        value={section.content.eyebrow}
        disabled={disabled}
        onChange={(eyebrow) => updateContent({ ...section.content, eyebrow })}
      />
      <TextField
        label="特性标题"
        value={section.content.title}
        disabled={disabled}
        required
        onChange={(title) => updateContent({ ...section.content, title })}
      />
      <TextField
        label="特性说明"
        value={section.content.description}
        disabled={disabled}
        required
        multiline
        onChange={(description) => updateContent({ ...section.content, description })}
      />
      <ActionLinkFields
        label="特性行动按钮"
        value={section.content.action}
        disabled={disabled}
        onChange={(action) => updateContent({ ...section.content, action })}
      />
      <MediaAssetPicker
        label="特性图片"
        value={section.content.image}
        disabled={disabled}
        onChange={(image) => updateContent({ ...section.content, image })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="图片位置"
          value={section.settings.imagePosition}
          disabled={disabled}
          options={[
            { value: "left", label: "左侧" },
            { value: "right", label: "右侧" },
          ]}
          onChange={(imagePosition) =>
            onChange({ ...section, settings: { ...section.settings, imagePosition } })
          }
        />
        <SelectField
          label="背景风格"
          value={section.settings.tone}
          disabled={disabled}
          options={[
            { value: "plain", label: "纯净" },
            { value: "soft", label: "柔和" },
            { value: "accent", label: "强调" },
          ]}
          onChange={(tone) => onChange({ ...section, settings: { ...section.settings, tone } })}
        />
      </div>
    </div>
  );
}
