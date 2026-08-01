import type { FeeConfig } from "@petcare/shared-types";
import { useState } from "react";
import {
  formatBasisPointsAsPercent,
  formatCentsAsYuan,
  parsePercentAsBasisPoints,
  parseYuanAsCents,
} from "./form-utils";
import type { EditorChangeHandler, SettingsFieldErrors } from "./RatingThresholdEditor";

interface FeeEditorProps {
  initialValue: FeeConfig;
  onChange: EditorChangeHandler<FeeConfig>;
}

interface FeeFormState {
  platformCommissionBps: string;
  rewardServiceFeeCents: string;
  withdrawalFeeBps: string;
  minimumWithdrawalFeeCents: string;
}

function initialForm(value: FeeConfig): FeeFormState {
  return {
    platformCommissionBps: formatBasisPointsAsPercent(value.platformCommissionBps),
    rewardServiceFeeCents: formatCentsAsYuan(value.rewardServiceFeeCents),
    withdrawalFeeBps: formatBasisPointsAsPercent(value.withdrawalFeeBps),
    minimumWithdrawalFeeCents: formatCentsAsYuan(value.minimumWithdrawalFeeCents),
  };
}

function parseForm(form: FeeFormState): { config: FeeConfig | null; errors: SettingsFieldErrors } {
  const errors: SettingsFieldErrors = {};
  const platformCommissionBps = parsePercentAsBasisPoints(form.platformCommissionBps);
  const rewardServiceFeeCents = parseYuanAsCents(form.rewardServiceFeeCents);
  const withdrawalFeeBps = parsePercentAsBasisPoints(form.withdrawalFeeBps);
  const minimumWithdrawalFeeCents = parseYuanAsCents(form.minimumWithdrawalFeeCents);

  if (platformCommissionBps === null) {errors.platformCommissionBps = "最多保留两位小数";}
  else if (platformCommissionBps > 5000) {errors.platformCommissionBps = "平台佣金不能超过 50%";}

  if (rewardServiceFeeCents === null) {errors.rewardServiceFeeCents = "最多保留两位小数";}

  if (withdrawalFeeBps === null) {errors.withdrawalFeeBps = "最多保留两位小数";}
  else if (withdrawalFeeBps > 5000) {errors.withdrawalFeeBps = "提现手续费不能超过 50%";}

  if (minimumWithdrawalFeeCents === null) {errors.minimumWithdrawalFeeCents = "最多保留两位小数";}

  if (
    Object.keys(errors).length > 0 ||
    platformCommissionBps === null ||
    rewardServiceFeeCents === null ||
    withdrawalFeeBps === null ||
    minimumWithdrawalFeeCents === null
  ) {
    return { config: null, errors };
  }

  return {
    config: {
      platformCommissionBps,
      rewardServiceFeeCents,
      withdrawalFeeBps,
      minimumWithdrawalFeeCents,
    },
    errors,
  };
}

const inputClass =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-14 text-[16px] text-slate-950 outline-none transition-colors duration-200 focus-visible:border-blue-800 focus-visible:ring-2 focus-visible:ring-blue-800/20 motion-reduce:transition-none sm:text-sm";

export function FeeEditor({ initialValue, onChange }: FeeEditorProps) {
  const [form, setForm] = useState(() => initialForm(initialValue));
  const [touched, setTouched] = useState<Set<keyof FeeFormState>>(() => new Set());
  const result = parseForm(form);

  function update(field: keyof FeeFormState, value: string) {
    const next = { ...form, [field]: value };
    const nextResult = parseForm(next);

    setForm(next);
    onChange(nextResult.config, nextResult.errors);
  }

  function error(field: keyof FeeFormState) {
    return touched.has(field) ? result.errors[field] : undefined;
  }

  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <legend className="px-2 text-base font-semibold text-slate-950">平台收费规则</legend>
      <p className="mb-5 text-slate-600">比例以整数万分比、金额以整数分保存，界面按百分比和人民币元展示。</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <FeeField label="平台佣金" suffix="%" value={form.platformCommissionBps} error={error("platformCommissionBps")} onChange={(value) => update("platformCommissionBps", value)} onBlur={() => setTouched((current) => new Set(current).add("platformCommissionBps"))} />
        <FeeField label="悬赏服务费" suffix="元" value={form.rewardServiceFeeCents} error={error("rewardServiceFeeCents")} onChange={(value) => update("rewardServiceFeeCents", value)} onBlur={() => setTouched((current) => new Set(current).add("rewardServiceFeeCents"))} />
        <FeeField label="提现手续费" suffix="%" value={form.withdrawalFeeBps} error={error("withdrawalFeeBps")} onChange={(value) => update("withdrawalFeeBps", value)} onBlur={() => setTouched((current) => new Set(current).add("withdrawalFeeBps"))} />
        <FeeField label="最低提现手续费" suffix="元" value={form.minimumWithdrawalFeeCents} error={error("minimumWithdrawalFeeCents")} onChange={(value) => update("minimumWithdrawalFeeCents", value)} onBlur={() => setTouched((current) => new Set(current).add("minimumWithdrawalFeeCents"))} />
      </div>
    </fieldset>
  );
}

function FeeField({ label, suffix, value, error, onChange, onBlur }: { label: string; suffix: string; value: string; error?: string; onChange(value: string): void; onBlur(): void }) {
  return (
    <label className="font-medium text-slate-800">
      {label} <span aria-hidden="true" className="text-red-700">*</span>
      <span className="relative block">
        <input type="number" inputMode="decimal" min={0} step="0.01" value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} aria-invalid={Boolean(error)} className={inputClass} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">{suffix}</span>
      </span>
      {error ? <span role="alert" className="mt-1 block text-sm font-normal text-red-700">{error}</span> : null}
    </label>
  );
}
