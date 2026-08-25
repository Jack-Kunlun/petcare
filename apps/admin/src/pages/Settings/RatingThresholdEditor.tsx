import type { RatingThresholdConfig } from "@petcare/shared-types";
import { useState } from "react";
import { formatScoreAsStars, parseStarsAsScore } from "./form-utils";

export type SettingsFieldErrors = Record<string, string>;

export interface EditorChangeHandler<TConfig> {
  (value: TConfig | null, errors: SettingsFieldErrors): void;
}

interface RatingThresholdEditorProps {
  initialValue: RatingThresholdConfig;
  onChange: EditorChangeHandler<RatingThresholdConfig>;
}

interface RatingFormState {
  evaluationWindow: string;
  minimumSampleSize: string;
  warningScore: string;
  suspensionScore: string;
  retrainingRequirement: string;
}

function initialForm(value: RatingThresholdConfig): RatingFormState {
  return {
    evaluationWindow: String(value.evaluationWindow),
    minimumSampleSize: String(value.minimumSampleSize),
    warningScore: formatScoreAsStars(value.warningScore),
    suspensionScore: formatScoreAsStars(value.suspensionScore),
    retrainingRequirement: value.retrainingRequirement,
  };
}

function validate(form: RatingFormState): {
  config: RatingThresholdConfig | null;
  errors: SettingsFieldErrors;
} {
  const errors: SettingsFieldErrors = {};
  const evaluationWindow = Number(form.evaluationWindow);
  const minimumSampleSize = Number(form.minimumSampleSize);
  const warningScore = parseStarsAsScore(form.warningScore);
  const suspensionScore = parseStarsAsScore(form.suspensionScore);

  if (!Number.isInteger(evaluationWindow) || evaluationWindow < 5 || evaluationWindow > 100) {
    errors.evaluationWindow = "请输入 5 至 100 的整数";
  }

  if (!Number.isInteger(minimumSampleSize) || minimumSampleSize < 1 || minimumSampleSize > 100) {
    errors.minimumSampleSize = "请输入 1 至 100 的整数";
  } else if (minimumSampleSize > evaluationWindow) {
    errors.minimumSampleSize = "最小样本数不能超过评分窗口";
  }

  if (warningScore === null) {
    errors.warningScore = "最多保留两位小数";
  } else if (warningScore < 100 || warningScore > 500) {
    errors.warningScore = "请输入 1.00 至 5.00 星";
  }

  if (suspensionScore === null) {
    errors.suspensionScore = "最多保留两位小数";
  } else if (suspensionScore < 100 || suspensionScore > 500) {
    errors.suspensionScore = "请输入 1.00 至 5.00 星";
  } else if (warningScore !== null && suspensionScore >= warningScore) {
    errors.suspensionScore = "暂停评分必须低于预警评分";
  }

  if (!form.retrainingRequirement.trim()) {
    errors.retrainingRequirement = "请填写再培训要求";
  }

  if (Object.keys(errors).length > 0 || warningScore === null || suspensionScore === null) {
    return { config: null, errors };
  }

  return {
    config: {
      evaluationWindow,
      minimumSampleSize,
      warningScore,
      suspensionScore,
      retrainingRequirement: form.retrainingRequirement.trim(),
    },
    errors,
  };
}

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[16px] text-slate-950 outline-none transition-colors duration-200 focus-visible:border-blue-800 focus-visible:ring-2 focus-visible:ring-blue-800/20 motion-reduce:transition-none sm:text-sm";
const textareaClass =
  "mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[16px] text-slate-950 outline-none transition-colors duration-200 focus-visible:border-blue-800 focus-visible:ring-2 focus-visible:ring-blue-800/20 motion-reduce:transition-none sm:text-sm";

export function RatingThresholdEditor({ initialValue, onChange }: RatingThresholdEditorProps) {
  const [form, setForm] = useState(() => initialForm(initialValue));
  const [touched, setTouched] = useState<Set<keyof RatingFormState>>(() => new Set());
  const result = validate(form);

  function update(field: keyof RatingFormState, value: string) {
    const next = { ...form, [field]: value };
    const nextResult = validate(next);

    setForm(next);
    onChange(nextResult.config, nextResult.errors);
  }

  function fieldError(field: keyof RatingFormState) {
    return touched.has(field) ? result.errors[field] : undefined;
  }

  function markTouched(field: keyof RatingFormState) {
    setTouched((current) => new Set(current).add(field));
  }

  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <legend className="px-2 text-base font-semibold text-slate-950">评分资格规则</legend>
      <p className="mb-5 text-slate-600">评分以整数百分值保存，界面以星级展示。</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="font-medium text-slate-800">
          评分窗口{" "}
          <span aria-hidden="true" className="text-red-700">
            *
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={100}
            value={form.evaluationWindow}
            onChange={(event) => update("evaluationWindow", event.target.value)}
            onBlur={() => markTouched("evaluationWindow")}
            aria-invalid={Boolean(fieldError("evaluationWindow"))}
            aria-describedby={
              fieldError("evaluationWindow")
                ? "evaluationWindow-help evaluationWindow-error"
                : "evaluationWindow-help"
            }
            className={inputClass}
          />
          <span
            id="evaluationWindow-help"
            className="mt-1 block text-xs font-normal text-slate-500"
          >
            最近 5 至 100 条评价。
          </span>
          {fieldError("evaluationWindow") ? (
            <FieldError id="evaluationWindow-error" message={fieldError("evaluationWindow")!} />
          ) : null}
        </label>
        <label className="font-medium text-slate-800">
          最小评价样本数{" "}
          <span aria-hidden="true" className="text-red-700">
            *
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={form.minimumSampleSize}
            onChange={(event) => update("minimumSampleSize", event.target.value)}
            onBlur={() => markTouched("minimumSampleSize")}
            aria-invalid={Boolean(fieldError("minimumSampleSize"))}
            aria-describedby={
              fieldError("minimumSampleSize") ? "minimumSampleSize-error" : undefined
            }
            className={inputClass}
          />
          {fieldError("minimumSampleSize") ? (
            <FieldError id="minimumSampleSize-error" message={fieldError("minimumSampleSize")!} />
          ) : null}
        </label>
        <label className="font-medium text-slate-800">
          预警评分{" "}
          <span aria-hidden="true" className="text-red-700">
            *
          </span>
          <span className="relative mt-1.5 block">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={5}
              step="0.01"
              value={form.warningScore}
              onChange={(event) => update("warningScore", event.target.value)}
              onBlur={() => markTouched("warningScore")}
              aria-invalid={Boolean(fieldError("warningScore"))}
              aria-describedby={fieldError("warningScore") ? "warningScore-error" : undefined}
              className={`${inputClass} mt-0 pr-12`}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500"
            >
              星
            </span>
          </span>
          {fieldError("warningScore") ? (
            <FieldError id="warningScore-error" message={fieldError("warningScore")!} />
          ) : null}
        </label>
        <label className="font-medium text-slate-800">
          暂停评分{" "}
          <span aria-hidden="true" className="text-red-700">
            *
          </span>
          <span className="relative mt-1.5 block">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={5}
              step="0.01"
              value={form.suspensionScore}
              onChange={(event) => update("suspensionScore", event.target.value)}
              onBlur={() => markTouched("suspensionScore")}
              aria-invalid={Boolean(fieldError("suspensionScore"))}
              aria-describedby={fieldError("suspensionScore") ? "suspensionScore-error" : undefined}
              className={`${inputClass} mt-0 pr-12`}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500"
            >
              星
            </span>
          </span>
          {fieldError("suspensionScore") ? (
            <FieldError id="suspensionScore-error" message={fieldError("suspensionScore")!} />
          ) : null}
        </label>
        <label className="font-medium text-slate-800 sm:col-span-2">
          再培训要求{" "}
          <span aria-hidden="true" className="text-red-700">
            *
          </span>
          <textarea
            rows={4}
            value={form.retrainingRequirement}
            onChange={(event) => update("retrainingRequirement", event.target.value)}
            onBlur={() => markTouched("retrainingRequirement")}
            aria-invalid={Boolean(fieldError("retrainingRequirement"))}
            aria-describedby={
              fieldError("retrainingRequirement") ? "retrainingRequirement-error" : undefined
            }
            className={`${textareaClass} resize-y`}
          />
          {fieldError("retrainingRequirement") ? (
            <FieldError
              id="retrainingRequirement-error"
              message={fieldError("retrainingRequirement")!}
            />
          ) : null}
        </label>
      </div>
    </fieldset>
  );
}

function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <span id={id} role="alert" className="mt-1 block text-sm font-normal text-red-700">
      {message}
    </span>
  );
}
