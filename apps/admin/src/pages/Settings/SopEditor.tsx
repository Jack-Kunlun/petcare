import type { SopConfig, SopConfigStep, SopViolationRule } from "@petcare/shared-types";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { settingsFieldId } from "./field-errors";
import type { EditorChangeHandler, SettingsFieldErrors } from "./RatingThresholdEditor";

interface SopEditorProps {
  initialValue: SopConfig;
  onChange: EditorChangeHandler<SopConfig>;
}

function emptyStep(stepNumber: number): SopConfigStep {
  return {
    stepNumber,
    stepName: "",
    instruction: "",
    expectedDurationMinutes: 5,
    minimumPhotoCount: 1,
    videoRequired: false,
  };
}

function normalize(value: SopConfig): SopConfig {
  return {
    steps: Array.from({ length: 5 }, (_, index) => value.steps[index] ?? emptyStep(index + 1)).map(
      (step, index) => ({ ...step, stepNumber: index + 1 }),
    ),
    violationRules: value.violationRules.map((rule) => ({ ...rule })),
  };
}

function validate(config: SopConfig): SettingsFieldErrors {
  const errors: SettingsFieldErrors = {};

  config.steps.forEach((step, index) => {
    if (step.stepName.trim().length < 2) {
      errors[`steps.${index}.stepName`] = `第 ${index + 1} 步“步骤名称”至少 2 个字符`;
    }

    if (step.instruction.trim().length < 10) {
      errors[`steps.${index}.instruction`] = `第 ${index + 1} 步“执行说明”至少 10 个字符`;
    }

    if (
      !Number.isInteger(step.expectedDurationMinutes) ||
      step.expectedDurationMinutes < 1 ||
      step.expectedDurationMinutes > 240
    ) {
      errors[`steps.${index}.expectedDurationMinutes`] =
        `第 ${index + 1} 步“预计时长”请输入 1 至 240 的整数`;
    }

    if (
      !Number.isInteger(step.minimumPhotoCount) ||
      step.minimumPhotoCount < 0 ||
      step.minimumPhotoCount > 20
    ) {
      errors[`steps.${index}.minimumPhotoCount`] =
        `第 ${index + 1} 步“最少照片数”请输入 0 至 20 的整数`;
    }
  });

  if (config.violationRules.length === 0) {
    errors.violationRules = "至少保留一条违规处理规则";
  }

  config.violationRules.forEach((rule, index) => {
    if (rule.description.trim().length < 10) {
      errors[`rules.${index}.description`] = `第 ${index + 1} 条违规规则“规则说明”至少 10 个字符`;
    }
  });

  return errors;
}

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[16px] text-slate-950 outline-none transition-colors duration-200 focus-visible:border-blue-800 focus-visible:ring-2 focus-visible:ring-blue-800/20 motion-reduce:transition-none sm:text-sm";
const textareaClass =
  "mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[16px] text-slate-950 outline-none transition-colors duration-200 focus-visible:border-blue-800 focus-visible:ring-2 focus-visible:ring-blue-800/20 motion-reduce:transition-none sm:text-sm";

function settingsFieldErrorId(path: string): string {
  return `settings-error-${path.replace(/\./gu, "-")}`;
}

function FieldError({ path, errors }: { path: string; errors: SettingsFieldErrors }) {
  const error = errors[path];

  return error ? (
    <span
      id={settingsFieldErrorId(path)}
      role="alert"
      className="mt-1 block text-sm font-normal text-red-700"
    >
      {error}
    </span>
  ) : null;
}

function violationSeverityLabel(severity: SopViolationRule["severity"]): string {
  if (severity === "minor") {
    return "轻微";
  }

  if (severity === "moderate") {
    return "中等";
  }

  return "严重";
}

export function SopEditor({ initialValue, onChange }: SopEditorProps) {
  const [config, setConfig] = useState(() => normalize(initialValue));
  const [errors, setErrors] = useState<SettingsFieldErrors>({});

  function commit(next: SopConfig) {
    const errors = validate(next);

    setConfig(next);
    setErrors(errors);
    onChange(Object.keys(errors).length === 0 ? next : null, errors);
  }

  function updateStep(index: number, patch: Partial<SopConfigStep>) {
    commit({
      ...config,
      steps: config.steps.map((step, itemIndex) =>
        itemIndex === index ? { ...step, ...patch } : step,
      ),
    });
  }

  function updateRule(index: number, patch: Partial<SopViolationRule>) {
    commit({
      ...config,
      violationRules: config.violationRules.map((rule, itemIndex) =>
        itemIndex === index ? { ...rule, ...patch } : rule,
      ),
    });
  }

  function addRule() {
    const available = (["minor", "moderate", "severe"] as const).find(
      (severity) => !config.violationRules.some((rule) => rule.severity === severity),
    );

    if (!available) {
      return;
    }

    commit({
      ...config,
      violationRules: [
        ...config.violationRules,
        {
          severity: available,
          description: "",
          serviceFeeDeductionBps: 0,
          ratingDeductionScore: 0,
          suspensionDays: 0,
          retrainingRequired: false,
          sortOrder: config.violationRules.length + 1,
        },
      ],
    });
  }

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="sop-steps-heading"
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <h2 id="sop-steps-heading" className="text-base font-semibold text-slate-950">
          固定五步服务流程
        </h2>
        <p className="mt-1 text-slate-600">步骤序号固定，发布后按顺序提供给服务者执行。</p>
        <div className="mt-5 space-y-4">
          {config.steps.map((step, index) => {
            const stepNamePath = `steps.${index}.stepName`;
            const instructionPath = `steps.${index}.instruction`;
            const durationPath = `steps.${index}.expectedDurationMinutes`;
            const photoPath = `steps.${index}.minimumPhotoCount`;

            return (
              <fieldset
                key={step.stepNumber}
                className="rounded-lg border border-blue-100 bg-slate-50 p-4"
              >
                <legend className="px-2 font-semibold text-blue-950">
                  第 {step.stepNumber} 步
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="font-medium text-slate-800 sm:col-span-2">
                    步骤名称{" "}
                    <span aria-hidden="true" className="text-red-700">
                      *
                    </span>
                    <input
                      id={settingsFieldId(stepNamePath)}
                      value={step.stepName}
                      maxLength={20}
                      aria-invalid={Boolean(errors[stepNamePath])}
                      aria-describedby={
                        errors[stepNamePath] ? settingsFieldErrorId(stepNamePath) : undefined
                      }
                      onChange={(event) => updateStep(index, { stepName: event.target.value })}
                      className={inputClass}
                    />
                    <FieldError path={stepNamePath} errors={errors} />
                  </label>
                  <label className="font-medium text-slate-800 sm:col-span-2">
                    执行说明{" "}
                    <span aria-hidden="true" className="text-red-700">
                      *
                    </span>
                    <textarea
                      id={settingsFieldId(instructionPath)}
                      rows={3}
                      value={step.instruction}
                      maxLength={500}
                      aria-invalid={Boolean(errors[instructionPath])}
                      aria-describedby={
                        errors[instructionPath] ? settingsFieldErrorId(instructionPath) : undefined
                      }
                      onChange={(event) => updateStep(index, { instruction: event.target.value })}
                      className={`${textareaClass} resize-y`}
                    />
                    <FieldError path={instructionPath} errors={errors} />
                  </label>
                  <label className="font-medium text-slate-800">
                    预计时长（分钟）
                    <input
                      id={settingsFieldId(durationPath)}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={240}
                      value={step.expectedDurationMinutes}
                      aria-invalid={Boolean(errors[durationPath])}
                      aria-describedby={
                        errors[durationPath] ? settingsFieldErrorId(durationPath) : undefined
                      }
                      onChange={(event) =>
                        updateStep(index, { expectedDurationMinutes: Number(event.target.value) })
                      }
                      className={inputClass}
                    />
                    <FieldError path={durationPath} errors={errors} />
                  </label>
                  <label className="font-medium text-slate-800">
                    最少照片数
                    <input
                      id={settingsFieldId(photoPath)}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={20}
                      value={step.minimumPhotoCount}
                      aria-invalid={Boolean(errors[photoPath])}
                      aria-describedby={
                        errors[photoPath] ? settingsFieldErrorId(photoPath) : undefined
                      }
                      onChange={(event) =>
                        updateStep(index, { minimumPhotoCount: Number(event.target.value) })
                      }
                      className={inputClass}
                    />
                    <FieldError path={photoPath} errors={errors} />
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-800 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={step.videoRequired}
                      onChange={(event) =>
                        updateStep(index, { videoRequired: event.target.checked })
                      }
                      className="h-5 w-5 cursor-pointer accent-blue-800"
                    />
                    要求上传服务视频
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="violation-heading"
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="violation-heading" className="text-base font-semibold text-slate-950">
              违规处理指引
            </h2>
            <p className="mt-1 text-slate-600">仅供人工处置参考，不直接触发财务或信用副作用。</p>
          </div>
          <button
            id={settingsFieldId("violationRules")}
            type="button"
            onClick={addRule}
            disabled={config.violationRules.length >= 3}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-blue-700 px-4 font-semibold text-blue-800 outline-none transition-colors duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            添加规则
          </button>
        </div>
        {config.violationRules.length === 0 ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950"
          >
            至少保留一条违规处理规则。
          </p>
        ) : null}
        <div className="mt-4 space-y-4">
          {config.violationRules.map((rule, index) => {
            const descriptionPath = `rules.${index}.description`;

            return (
              <fieldset
                key={`${rule.severity}-${index}`}
                className="rounded-lg border border-slate-200 p-4"
              >
                <legend className="px-2 font-semibold text-slate-900">
                  {violationSeverityLabel(rule.severity)}规则
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="font-medium text-slate-800 sm:col-span-2">
                    规则说明
                    <textarea
                      id={settingsFieldId(descriptionPath)}
                      rows={3}
                      value={rule.description}
                      aria-invalid={Boolean(errors[descriptionPath])}
                      aria-describedby={
                        errors[descriptionPath] ? settingsFieldErrorId(descriptionPath) : undefined
                      }
                      onChange={(event) => updateRule(index, { description: event.target.value })}
                      className={`${textareaClass} resize-y`}
                    />
                    <FieldError path={descriptionPath} errors={errors} />
                  </label>
                  <label className="font-medium text-slate-800">
                    建议扣费（万分比）
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={10000}
                      value={rule.serviceFeeDeductionBps ?? ""}
                      onChange={(event) =>
                        updateRule(index, {
                          serviceFeeDeductionBps: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="font-medium text-slate-800">
                    建议扣分（百分值）
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={500}
                      value={rule.ratingDeductionScore}
                      onChange={(event) =>
                        updateRule(index, { ratingDeductionScore: Number(event.target.value) })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="font-medium text-slate-800">
                    暂停天数
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={365}
                      value={rule.suspensionDays}
                      onChange={(event) =>
                        updateRule(index, { suspensionDays: Number(event.target.value) })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={rule.retrainingRequired}
                      onChange={(event) =>
                        updateRule(index, { retrainingRequired: event.target.checked })
                      }
                      className="h-5 w-5 cursor-pointer accent-blue-800"
                    />
                    建议重新培训
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      commit({
                        ...config,
                        violationRules: config.violationRules
                          .filter((_, itemIndex) => itemIndex !== index)
                          .map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 })),
                      })
                    }
                    className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 px-3 font-semibold text-red-800 outline-none transition-colors duration-200 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-700 motion-reduce:transition-none sm:col-span-2"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    移除规则
                  </button>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>
    </div>
  );
}
