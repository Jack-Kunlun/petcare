import type {
  WebsiteHomeExperienceBrandStory,
  WebsiteHomeExperienceMediaGroup,
  WebsiteHomeExperienceRecord,
  WebsiteHomeExperienceRecordStep,
  WebsiteHomeExperienceSection,
  WebsiteHomeExperienceTextGroup,
} from "@petcare/shared-types";
import { MediaAssetPicker } from "../MediaAssetPicker";
import type { SectionEditorProps } from "./editor-types";
import { ActionLinkFields, SelectField, TextField } from "./fields";

interface HomeMediaGroupEditorProps {
  group: WebsiteHomeExperienceMediaGroup;
  label: string;
  disabled: boolean;
  onChange(group: WebsiteHomeExperienceMediaGroup): void;
}

function HomeMediaGroupEditor({ group, label, disabled, onChange }: HomeMediaGroupEditorProps) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{label}内容</legend>
      <div className="mt-2 space-y-4">
        <TextField
          label={`${label}眉题`}
          value={group.eyebrow}
          disabled={disabled}
          onChange={(eyebrow) => onChange({ ...group, eyebrow })}
        />
        <TextField
          label={`${label}标题`}
          value={group.title}
          disabled={disabled}
          required
          onChange={(title) => onChange({ ...group, title })}
        />
        <TextField
          label={`${label}说明`}
          value={group.description}
          disabled={disabled}
          required
          multiline
          onChange={(description) => onChange({ ...group, description })}
        />
        <ActionLinkFields
          label={`${label}行动按钮`}
          value={group.action}
          disabled={disabled}
          onChange={(action) => onChange({ ...group, action })}
        />
        {group.items.map((item, index) => (
          <fieldset key={item.itemKey} className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">
              {label}项目 {index + 1}
            </legend>
            <div className="mt-2 grid gap-4">
              <TextField
                label={`${label}项目 ${index + 1}标签`}
                value={item.label}
                disabled={disabled}
                required
                onChange={(next) =>
                  onChange({
                    ...group,
                    items: group.items.map((candidate, itemIndex) =>
                      itemIndex === index ? { ...candidate, label: next } : candidate,
                    ),
                  })
                }
              />
              <TextField
                label={`${label}项目 ${index + 1}标题`}
                value={item.title}
                disabled={disabled}
                required
                onChange={(title) =>
                  onChange({
                    ...group,
                    items: group.items.map((candidate, itemIndex) =>
                      itemIndex === index ? { ...candidate, title } : candidate,
                    ),
                  })
                }
              />
              <TextField
                label={`${label}项目 ${index + 1}说明`}
                value={item.description}
                disabled={disabled}
                multiline
                onChange={(description) =>
                  onChange({
                    ...group,
                    items: group.items.map((candidate, itemIndex) =>
                      itemIndex === index ? { ...candidate, description } : candidate,
                    ),
                  })
                }
              />
              <MediaAssetPicker
                label={`${label}项目 ${index + 1}图片`}
                value={item.image}
                disabled={disabled}
                onChange={(image) =>
                  onChange({
                    ...group,
                    items: group.items.map((candidate, itemIndex) =>
                      itemIndex === index ? { ...candidate, image } : candidate,
                    ),
                  })
                }
              />
            </div>
          </fieldset>
        ))}
      </div>
    </fieldset>
  );
}

interface HomeTextGroupEditorProps {
  group: WebsiteHomeExperienceTextGroup;
  label: string;
  disabled: boolean;
  onChange(group: WebsiteHomeExperienceTextGroup): void;
}

function HomeTextGroupEditor({ group, label, disabled, onChange }: HomeTextGroupEditorProps) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{label}内容</legend>
      <div className="mt-2 space-y-4">
        <TextField
          label={`${label}眉题`}
          value={group.eyebrow}
          disabled={disabled}
          onChange={(eyebrow) => onChange({ ...group, eyebrow })}
        />
        <TextField
          label={`${label}标题`}
          value={group.title}
          disabled={disabled}
          required
          onChange={(title) => onChange({ ...group, title })}
        />
        <TextField
          label={`${label}说明`}
          value={group.description}
          disabled={disabled}
          required
          multiline
          onChange={(description) => onChange({ ...group, description })}
        />
        <ActionLinkFields
          label={`${label}行动按钮`}
          value={group.action}
          disabled={disabled}
          onChange={(action) => onChange({ ...group, action })}
        />
        {group.items.map((item, index) => (
          <fieldset key={item.itemKey} className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">
              {label}项目 {index + 1}
            </legend>
            <div className="mt-2 grid gap-4">
              <TextField
                label={`${label}项目 ${index + 1}标题`}
                value={item.title}
                disabled={disabled}
                required
                onChange={(title) =>
                  onChange({
                    ...group,
                    items: group.items.map((candidate, itemIndex) =>
                      itemIndex === index ? { ...candidate, title } : candidate,
                    ),
                  })
                }
              />
              <TextField
                label={`${label}项目 ${index + 1}说明`}
                value={item.description}
                disabled={disabled}
                required
                multiline
                onChange={(description) =>
                  onChange({
                    ...group,
                    items: group.items.map((candidate, itemIndex) =>
                      itemIndex === index ? { ...candidate, description } : candidate,
                    ),
                  })
                }
              />
            </div>
          </fieldset>
        ))}
      </div>
    </fieldset>
  );
}

interface HomeRecordEditorProps {
  record: WebsiteHomeExperienceRecord;
  disabled: boolean;
  onChange(record: WebsiteHomeExperienceRecord): void;
}

function HomeRecordEditor({ record, disabled, onChange }: HomeRecordEditorProps) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">照护记录内容</legend>
      <div className="mt-2 space-y-4">
        <TextField
          label="记录眉题"
          value={record.eyebrow}
          disabled={disabled}
          onChange={(eyebrow) => onChange({ ...record, eyebrow })}
        />
        <TextField
          label="记录标题"
          value={record.title}
          disabled={disabled}
          required
          onChange={(title) => onChange({ ...record, title })}
        />
        <TextField
          label="记录说明"
          value={record.description}
          disabled={disabled}
          required
          multiline
          onChange={(description) => onChange({ ...record, description })}
        />
        <ActionLinkFields
          label="记录行动按钮"
          value={record.action}
          disabled={disabled}
          onChange={(action) => onChange({ ...record, action })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="记录演示标题"
            value={record.demoTitle}
            disabled={disabled}
            required
            onChange={(demoTitle) => onChange({ ...record, demoTitle })}
          />
          <TextField
            label="记录状态文案"
            value={record.statusLabel}
            disabled={disabled}
            required
            onChange={(statusLabel) => onChange({ ...record, statusLabel })}
          />
        </div>
        <TextField
          label="记录额外图片数量"
          value={String(record.extraImageCount)}
          disabled={disabled}
          required
          onChange={(value) => {
            const next = Number.parseInt(value, 10);

            onChange({ ...record, extraImageCount: Number.isNaN(next) ? 0 : next });
          }}
        />
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">记录步骤</h3>
          {record.steps.map((step, index) => (
            <fieldset key={step.itemKey} className="rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">
                记录步骤 {index + 1}
              </legend>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <TextField
                  label={`记录步骤 ${index + 1} 时间`}
                  value={step.time}
                  disabled={disabled}
                  required
                  onChange={(time) =>
                    onChange({
                      ...record,
                      steps: record.steps.map((candidate, stepIndex) =>
                        stepIndex === index ? { ...candidate, time } : candidate,
                      ),
                    })
                  }
                />
                <TextField
                  label={`记录步骤 ${index + 1} 文案`}
                  value={step.label}
                  disabled={disabled}
                  required
                  onChange={(label) =>
                    onChange({
                      ...record,
                      steps: record.steps.map((candidate, stepIndex) =>
                        stepIndex === index ? { ...candidate, label } : candidate,
                      ),
                    })
                  }
                />
                <SelectField<WebsiteHomeExperienceRecordStep["state"]>
                  label={`记录步骤 ${index + 1} 状态`}
                  value={step.state}
                  disabled={disabled}
                  options={[
                    { value: "complete", label: "已完成" },
                    { value: "current", label: "当前" },
                    { value: "pending", label: "待完成" },
                  ]}
                  onChange={(state: WebsiteHomeExperienceRecordStep["state"]) => {
                    const steps = record.steps.map(
                      (candidate, stepIndex): WebsiteHomeExperienceRecordStep => {
                        if (stepIndex === index) {
                          return { ...candidate, state };
                        }

                        if (state === "current" && candidate.state === "current") {
                          return { ...candidate, state: "pending" };
                        }

                        return candidate;
                      },
                    );

                    onChange({ ...record, steps });
                  }}
                />
              </div>
            </fieldset>
          ))}
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">记录图片</h3>
          {record.images.map((image, index) => (
            <MediaAssetPicker
              key={`${index}-${image.altText}`}
              label={`记录图片 ${index + 1}`}
              value={image}
              disabled={disabled}
              onChange={(nextImage) =>
                onChange({
                  ...record,
                  images: record.images.map((candidate, imageIndex) =>
                    imageIndex === index ? nextImage : candidate,
                  ),
                })
              }
            />
          ))}
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">照护证据</h3>
          {record.evidence.map((item, index) => (
            <fieldset key={item.itemKey} className="rounded-lg border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">
                照护证据 {index + 1}
              </legend>
              <div className="mt-2 grid gap-4">
                <TextField
                  label={`照护证据 ${index + 1} 标题`}
                  value={item.title}
                  disabled={disabled}
                  required
                  onChange={(title) =>
                    onChange({
                      ...record,
                      evidence: record.evidence.map((candidate, evidenceIndex) =>
                        evidenceIndex === index ? { ...candidate, title } : candidate,
                      ),
                    })
                  }
                />
                <TextField
                  label={`照护证据 ${index + 1} 说明`}
                  value={item.description}
                  disabled={disabled}
                  required
                  multiline
                  onChange={(description) =>
                    onChange({
                      ...record,
                      evidence: record.evidence.map((candidate, evidenceIndex) =>
                        evidenceIndex === index ? { ...candidate, description } : candidate,
                      ),
                    })
                  }
                />
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

interface HomeBrandEditorProps {
  brand: WebsiteHomeExperienceBrandStory;
  disabled: boolean;
  onChange(brand: WebsiteHomeExperienceBrandStory): void;
}

function HomeBrandEditor({ brand, disabled, onChange }: HomeBrandEditorProps) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">品牌故事内容</legend>
      <div className="mt-2 space-y-4">
        <TextField
          label="品牌眉题"
          value={brand.eyebrow}
          disabled={disabled}
          onChange={(eyebrow) => onChange({ ...brand, eyebrow })}
        />
        <TextField
          label="品牌标题"
          value={brand.title}
          disabled={disabled}
          required
          onChange={(title) => onChange({ ...brand, title })}
        />
        <TextField
          label="品牌说明"
          value={brand.description}
          disabled={disabled}
          required
          multiline
          onChange={(description) => onChange({ ...brand, description })}
        />
        <MediaAssetPicker
          label="品牌故事图片"
          value={brand.image}
          disabled={disabled}
          onChange={(image) => onChange({ ...brand, image })}
        />
      </div>
    </fieldset>
  );
}

/** Edits the six fixed, CMS-managed groups that make up the homepage experience. */
export function HomeExperienceEditor({
  section,
  onChange,
  disabled = false,
}: SectionEditorProps<WebsiteHomeExperienceSection>) {
  const updateContent = (
    update: (
      content: WebsiteHomeExperienceSection["content"],
    ) => WebsiteHomeExperienceSection["content"],
  ) => onChange({ ...section, content: update(section.content) });

  return (
    <div className="space-y-5">
      <HomeMediaGroupEditor
        label="服务"
        group={section.content.services}
        disabled={disabled}
        onChange={(services) => updateContent((content) => ({ ...content, services }))}
      />
      <HomeTextGroupEditor
        label="流程"
        group={section.content.journey}
        disabled={disabled}
        onChange={(journey) => updateContent((content) => ({ ...content, journey }))}
      />
      <HomeRecordEditor
        record={section.content.record}
        disabled={disabled}
        onChange={(record) => updateContent((content) => ({ ...content, record }))}
      />
      <HomeTextGroupEditor
        label="信任"
        group={section.content.trust}
        disabled={disabled}
        onChange={(trust) => updateContent((content) => ({ ...content, trust }))}
      />
      <HomeMediaGroupEditor
        label="社区"
        group={section.content.community}
        disabled={disabled}
        onChange={(community) => updateContent((content) => ({ ...content, community }))}
      />
      <HomeBrandEditor
        brand={section.content.brand}
        disabled={disabled}
        onChange={(brand) => updateContent((content) => ({ ...content, brand }))}
      />
    </div>
  );
}
