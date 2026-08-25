import type { WebsiteRichTextSection } from "@petcare/shared-types";
import type { SectionEditorProps } from "./editor-types";
import { inputClassName, SelectField, TextField } from "./fields";

/** Edits plain structured narrative text without any HTML or rich-text control. */
export function RichTextEditor({
  section,
  onChange,
  disabled = false,
}: SectionEditorProps<WebsiteRichTextSection>) {
  const updateContent = (content: WebsiteRichTextSection["content"]) =>
    onChange({ ...section, content });

  return (
    <div className="space-y-4">
      <TextField
        label="正文标题"
        value={section.content.title}
        disabled={disabled}
        required
        onChange={(title) => updateContent({ ...section.content, title })}
      />
      <label className="block">
        <span className="text-sm font-medium text-slate-800">生效日期</span>
        <input
          aria-label="生效日期"
          type="text"
          value={section.content.effectiveDate ?? ""}
          disabled={disabled}
          onChange={(event) =>
            updateContent({
              ...section.content,
              effectiveDate: event.target.value.trim() ? event.target.value : null,
            })
          }
          className={inputClassName}
        />
      </label>
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">固定正文小节</legend>
        <div className="mt-3 space-y-4">
          {section.content.parts.map((part, partIndex) => (
            <div key={part.partKey} className="rounded-lg bg-slate-50 p-3">
              <TextField
                label={`正文小节 ${part.heading} 标题`}
                value={part.heading}
                disabled={disabled}
                required
                onChange={(heading) => {
                  const parts = section.content.parts.map((candidate, candidateIndex) =>
                    candidateIndex === partIndex ? { ...candidate, heading } : candidate,
                  );

                  updateContent({ ...section.content, parts });
                }}
              />
              <div className="mt-3 space-y-3">
                {part.paragraphs.map((paragraph, paragraphIndex) => (
                  <TextField
                    key={`${part.partKey}-${paragraphIndex}`}
                    label={`正文小节 ${part.heading} 段落 ${paragraphIndex + 1}`}
                    value={paragraph}
                    disabled={disabled}
                    required
                    multiline
                    onChange={(nextParagraph) => {
                      const parts = section.content.parts.map((candidate, candidateIndex) => {
                        if (candidateIndex !== partIndex) {
                          return candidate;
                        }

                        return {
                          ...candidate,
                          paragraphs: candidate.paragraphs.map(
                            (candidateParagraph, candidateParagraphIndex) =>
                              candidateParagraphIndex === paragraphIndex
                                ? nextParagraph
                                : candidateParagraph,
                          ),
                        };
                      });

                      updateContent({ ...section.content, parts });
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <SelectField
        label="正文宽度"
        value={section.settings.width}
        disabled={disabled}
        options={[
          { value: "normal", label: "常规" },
          { value: "wide", label: "宽版" },
        ]}
        onChange={(width) => onChange({ ...section, settings: { ...section.settings, width } })}
      />
    </div>
  );
}
