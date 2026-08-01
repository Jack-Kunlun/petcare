import type { SopConfig, SopConfigStep, SopViolationRule } from "@petcare/shared-types";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
    if (step.stepName.trim().length < 2) {errors[`steps.${index}.stepName`] = "步骤名称至少 2 个字符";}

    if (step.instruction.trim().length < 10) {errors[`steps.${index}.instruction`] = "步骤说明至少 10 个字符";}

    if (!Number.isInteger(step.expectedDurationMinutes) || step.expectedDurationMinutes < 1 || step.expectedDurationMinutes > 240) {errors[`steps.${index}.expectedDurationMinutes`] = "请输入 1 至 240 的整数";}

    if (!Number.isInteger(step.minimumPhotoCount) || step.minimumPhotoCount < 0 || step.minimumPhotoCount > 20) {errors[`steps.${index}.minimumPhotoCount`] = "请输入 0 至 20 的整数";}
  });

  if (config.violationRules.length === 0) {errors.violationRules = "至少保留一条违规处理规则";}

  config.violationRules.forEach((rule, index) => {
    if (rule.description.trim().length < 10) {errors[`rules.${index}.description`] = "规则说明至少 10 个字符";}
  });

  return errors;
}

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[16px] text-slate-950 outline-none transition-colors duration-200 focus-visible:border-blue-800 focus-visible:ring-2 focus-visible:ring-blue-800/20 motion-reduce:transition-none sm:text-sm";

export function SopEditor({ initialValue, onChange }: SopEditorProps) {
  const [config, setConfig] = useState(() => normalize(initialValue));

  function commit(next: SopConfig) {
    const errors = validate(next);

    setConfig(next);
    onChange(Object.keys(errors).length === 0 ? next : null, errors);
  }

  function updateStep(index: number, patch: Partial<SopConfigStep>) {
    commit({ ...config, steps: config.steps.map((step, itemIndex) => itemIndex === index ? { ...step, ...patch } : step) });
  }

  function updateRule(index: number, patch: Partial<SopViolationRule>) {
    commit({ ...config, violationRules: config.violationRules.map((rule, itemIndex) => itemIndex === index ? { ...rule, ...patch } : rule) });
  }

  function addRule() {
    const available = (["minor", "moderate", "severe"] as const).find((severity) => !config.violationRules.some((rule) => rule.severity === severity));

    if (!available) {return;}

    commit({
      ...config,
      violationRules: [...config.violationRules, {
        severity: available,
        description: "",
        serviceFeeDeductionBps: 0,
        ratingDeductionScore: 0,
        suspensionDays: 0,
        retrainingRequired: false,
        sortOrder: config.violationRules.length + 1,
      }],
    });
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="sop-steps-heading" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 id="sop-steps-heading" className="text-base font-semibold text-slate-950">固定五步服务流程</h2>
        <p className="mt-1 text-slate-600">步骤序号固定，发布后按顺序提供给服务者执行。</p>
        <div className="mt-5 space-y-4">
          {config.steps.map((step, index) => (
            <fieldset key={step.stepNumber} className="rounded-lg border border-blue-100 bg-slate-50 p-4">
              <legend className="px-2 font-semibold text-blue-950">第 {step.stepNumber} 步</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="font-medium text-slate-800 sm:col-span-2">步骤名称 <span aria-hidden="true" className="text-red-700">*</span><input value={step.stepName} maxLength={20} onChange={(event) => updateStep(index, { stepName: event.target.value })} className={inputClass} /></label>
                <label className="font-medium text-slate-800 sm:col-span-2">执行说明 <span aria-hidden="true" className="text-red-700">*</span><textarea rows={3} value={step.instruction} maxLength={500} onChange={(event) => updateStep(index, { instruction: event.target.value })} className={`${inputClass} resize-y`} /></label>
                <label className="font-medium text-slate-800">预计时长（分钟）<input type="number" inputMode="numeric" min={1} max={240} value={step.expectedDurationMinutes} onChange={(event) => updateStep(index, { expectedDurationMinutes: Number(event.target.value) })} className={inputClass} /></label>
                <label className="font-medium text-slate-800">最少照片数<input type="number" inputMode="numeric" min={0} max={20} value={step.minimumPhotoCount} onChange={(event) => updateStep(index, { minimumPhotoCount: Number(event.target.value) })} className={inputClass} /></label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-800 sm:col-span-2"><input type="checkbox" checked={step.videoRequired} onChange={(event) => updateStep(index, { videoRequired: event.target.checked })} className="h-5 w-5 cursor-pointer accent-blue-800" />要求上传服务视频</label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section aria-labelledby="violation-heading" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="violation-heading" className="text-base font-semibold text-slate-950">违规处理指引</h2><p className="mt-1 text-slate-600">仅供人工处置参考，不直接触发财务或信用副作用。</p></div>
          <button type="button" onClick={addRule} disabled={config.violationRules.length >= 3} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-blue-700 px-4 py-2 font-semibold text-blue-800 outline-none transition-colors duration-200 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"><Plus aria-hidden="true" className="h-4 w-4" />添加规则</button>
        </div>
        {config.violationRules.length === 0 ? <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">至少保留一条违规处理规则。</p> : null}
        <div className="mt-4 space-y-4">
          {config.violationRules.map((rule, index) => (
            <fieldset key={`${rule.severity}-${index}`} className="rounded-lg border border-slate-200 p-4">
              <legend className="px-2 font-semibold text-slate-900">{rule.severity === "minor" ? "轻微" : (rule.severity === "moderate" ? "中等" : "严重")}规则</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="font-medium text-slate-800 sm:col-span-2">规则说明<textarea rows={3} value={rule.description} onChange={(event) => updateRule(index, { description: event.target.value })} className={`${inputClass} resize-y`} /></label>
                <label className="font-medium text-slate-800">建议扣费（万分比）<input type="number" inputMode="numeric" min={0} max={10000} value={rule.serviceFeeDeductionBps ?? ""} onChange={(event) => updateRule(index, { serviceFeeDeductionBps: event.target.value ? Number(event.target.value) : null })} className={inputClass} /></label>
                <label className="font-medium text-slate-800">建议扣分（百分值）<input type="number" inputMode="numeric" min={0} max={500} value={rule.ratingDeductionScore} onChange={(event) => updateRule(index, { ratingDeductionScore: Number(event.target.value) })} className={inputClass} /></label>
                <label className="font-medium text-slate-800">暂停天数<input type="number" inputMode="numeric" min={0} max={365} value={rule.suspensionDays} onChange={(event) => updateRule(index, { suspensionDays: Number(event.target.value) })} className={inputClass} /></label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-800"><input type="checkbox" checked={rule.retrainingRequired} onChange={(event) => updateRule(index, { retrainingRequired: event.target.checked })} className="h-5 w-5 cursor-pointer accent-blue-800" />建议重新培训</label>
                <button type="button" onClick={() => commit({ ...config, violationRules: config.violationRules.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, sortOrder: itemIndex + 1 })) })} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-800 outline-none transition-colors duration-200 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-700 motion-reduce:transition-none sm:col-span-2"><Trash2 aria-hidden="true" className="h-4 w-4" />移除规则</button>
              </div>
            </fieldset>
          ))}
        </div>
      </section>
    </div>
  );
}
