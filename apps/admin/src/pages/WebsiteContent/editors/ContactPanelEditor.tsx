import type { WebsiteContactPanelSection } from "@petcare/shared-types";
import type { SectionEditorProps } from "./editor-types";
import { CheckboxField, SelectField, TextField } from "./fields";

/** Edits the template-owned public contact channels with bounded column settings. */
export function ContactPanelEditor({
  section,
  onChange,
  disabled = false,
}: SectionEditorProps<WebsiteContactPanelSection>) {
  const updateContent = (content: WebsiteContactPanelSection["content"]) =>
    onChange({ ...section, content });

  return (
    <div className="space-y-4">
      <TextField
        label="联系区标题"
        value={section.content.title}
        disabled={disabled}
        required
        onChange={(title) => updateContent({ ...section.content, title })}
      />
      <TextField
        label="联系区说明"
        value={section.content.description}
        disabled={disabled}
        required
        multiline
        onChange={(description) => updateContent({ ...section.content, description })}
      />
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">固定联系渠道</legend>
        <div className="mt-3 space-y-4">
          {section.content.channels.map((channel, channelIndex) => (
            <div key={channel.channelKey} className="rounded-lg bg-slate-50 p-3">
              <CheckboxField
                label={`显示联系渠道 ${channel.label}`}
                checked={channel.isEnabled !== false}
                disabled={disabled}
                onChange={(isEnabled) => {
                  const channels = section.content.channels.map((candidate, candidateIndex) =>
                    candidateIndex === channelIndex ? { ...candidate, isEnabled } : candidate,
                  );

                  updateContent({ ...section.content, channels });
                }}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TextField
                  label={`联系渠道 ${channel.label} 标签`}
                  value={channel.label}
                  disabled={disabled}
                  required
                  onChange={(label) => {
                    const channels = section.content.channels.map((candidate, candidateIndex) =>
                      candidateIndex === channelIndex ? { ...candidate, label } : candidate,
                    );

                    updateContent({ ...section.content, channels });
                  }}
                />
                <TextField
                  label={`联系渠道 ${channel.label} 值`}
                  value={channel.value}
                  disabled={disabled}
                  required
                  onChange={(value) => {
                    const channels = section.content.channels.map((candidate, candidateIndex) =>
                      candidateIndex === channelIndex ? { ...candidate, value } : candidate,
                    );

                    updateContent({ ...section.content, channels });
                  }}
                />
                <TextField
                  label={`联系渠道 ${channel.label} 链接`}
                  value={channel.href}
                  disabled={disabled}
                  required
                  onChange={(href) => {
                    const channels = section.content.channels.map((candidate, candidateIndex) =>
                      candidateIndex === channelIndex
                        ? { ...candidate, href: href as typeof candidate.href }
                        : candidate,
                    );

                    updateContent({ ...section.content, channels });
                  }}
                />
                <TextField
                  label={`联系渠道 ${channel.label} 可用时间`}
                  value={channel.availability}
                  disabled={disabled}
                  onChange={(availability) => {
                    const channels = section.content.channels.map((candidate, candidateIndex) =>
                      candidateIndex === channelIndex ? { ...candidate, availability } : candidate,
                    );

                    updateContent({ ...section.content, channels });
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
          { value: 1, label: "1 列" },
          { value: 2, label: "2 列" },
          { value: 3, label: "3 列" },
        ]}
        onChange={(columns) => onChange({ ...section, settings: { ...section.settings, columns } })}
      />
    </div>
  );
}
