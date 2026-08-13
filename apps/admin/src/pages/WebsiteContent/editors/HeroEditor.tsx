import type { WebsiteHeroSection } from "@petcare/shared-types";
import { MediaAssetPicker } from "../MediaAssetPicker";
import type { SectionEditorProps } from "./editor-types";
import { ActionLinkFields, SelectField, TextField } from "./fields";

/** Edits the strongly typed hero copy, actions, image reference, and bounded display settings. */
export function HeroEditor({ section, onChange, disabled = false }: SectionEditorProps<WebsiteHeroSection>) {
  const updateContent = (content: WebsiteHeroSection["content"]) =>
    onChange({ ...section, content });

  return (
    <div className="grid gap-4">
      <TextField
        label="眉题"
        value={section.content.eyebrow}
        disabled={disabled}
        onChange={(eyebrow) => updateContent({ ...section.content, eyebrow })}
      />
      <TextField
        label="主标题"
        value={section.content.title}
        disabled={disabled}
        required
        onChange={(title) => updateContent({ ...section.content, title })}
      />
      <TextField
        label="介绍正文"
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
        onChange={(primaryAction) => updateContent({ ...section.content, primaryAction })}
      />
      <ActionLinkFields
        label="次要行动按钮"
        value={section.content.secondaryAction}
        disabled={disabled}
        onChange={(secondaryAction) => updateContent({ ...section.content, secondaryAction })}
      />
      <MediaAssetPicker
        label="首屏图片"
        value={section.content.image}
        disabled={disabled}
        onChange={(image) => updateContent({ ...section.content, image })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
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
        <SelectField
          label="图片位置"
          value={section.settings.imagePosition}
          disabled={disabled}
          options={[
            { value: "left", label: "左侧" },
            { value: "right", label: "右侧" },
            { value: "background", label: "背景" },
          ]}
          onChange={(imagePosition) =>
            onChange({ ...section, settings: { ...section.settings, imagePosition } })
          }
        />
      </div>
    </div>
  );
}
