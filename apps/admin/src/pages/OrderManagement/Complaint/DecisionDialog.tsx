import type { DecisionLevel, SubmitDisputeDecisionRequest } from "@petcare/shared-types";
import { useState, type FormEvent } from "react";

interface DecisionDialogProps {
  /** 本次裁决层级。 */
  level: DecisionLevel;
  /** 当前案件并发版本。 */
  version: number;
  /** 订单裁决可分配金额，单位为分。 */
  allocatableAmount: number;
  /** 是否正在提交。 */
  pending: boolean;
  /** 关闭弹窗。 */
  onClose: () => void;
  /** 提交已确认的裁决。 */
  onSubmit: (request: SubmitDisputeDecisionRequest) => void;
}

/** 将整数分格式化为人民币元。 */
function money(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

/** 将表单字符串严格解析为十进制整数。 */
function parseInteger(value: string): number | null {
  if (!/^-?\d+$/.test(value || "0")) {
    return null;
  }

  return Number(value || "0");
}

/** 提供裁决验证、影响预览和二次确认。 */
export function DecisionDialog({
  level,
  version,
  allocatableAmount,
  pending,
  onClose,
  onSubmit,
}: DecisionDialogProps) {
  const [liability, setLiability] =
    useState<SubmitDisputeDecisionRequest["liability"]>("respondent");
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState("");
  const [settlement, setSettlement] = useState("");
  const [complainantCredit, setComplainantCredit] = useState("");
  const [respondentCredit, setRespondentCredit] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<SubmitDisputeDecisionRequest | null>(null);
  const [confirming, setConfirming] = useState(false);

  function validate(): SubmitDisputeDecisionRequest | null {
    const refundAmount = parseInteger(refund);
    const settlementAmount = parseInteger(settlement);
    const complainantCreditDelta = parseInteger(complainantCredit);
    const respondentCreditDelta = parseInteger(respondentCredit);

    if (reason.trim().length < 10 || reason.trim().length > 1000) {
      setError("裁决理由需填写 10 至 1000 个字符");

      return null;
    }

    if (
      refundAmount === null ||
      settlementAmount === null ||
      refundAmount < 0 ||
      settlementAmount < 0
    ) {
      setError("金额必须为非负整数分");

      return null;
    }

    if (refundAmount + settlementAmount > allocatableAmount) {
      setError(`退款与结算合计不能超过订单可分配金额 ${allocatableAmount} 分`);

      return null;
    }

    if (
      complainantCreditDelta === null ||
      respondentCreditDelta === null ||
      complainantCreditDelta < -100 ||
      complainantCreditDelta > 100 ||
      respondentCreditDelta < -100 ||
      respondentCreditDelta > 100
    ) {
      setError("双方信用分变化必须是 -100 至 100 的整数");

      return null;
    }

    setError("");

    return {
      liability,
      reason: reason.trim(),
      refundAmount,
      settlementAmount,
      complainantCreditDelta,
      respondentCreditDelta,
      version,
    };
  }

  function showPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = validate();

    if (request) {
      setPreview(request);
    }
  }

  const title = level === "final" ? "作出最终裁决" : "作出初审裁决";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        className="my-6 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <h2 id="decision-title" className="text-xl font-semibold text-slate-950">
          {title}
        </h2>
        <form className="mt-5 space-y-4" onSubmit={showPreview}>
          <label className="block text-sm font-medium text-slate-800">
            责任划分
            <select
              value={liability}
              onChange={(event) => setLiability(event.target.value as typeof liability)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="complainant">投诉方责任</option>
              <option value="respondent">被投诉方责任</option>
              <option value="shared">双方共同责任</option>
              <option value="insufficient_evidence">证据不足</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-800">
            裁决理由
            <textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="退款金额（分）" value={refund} setValue={setRefund} />
            <NumberField label="结算金额（分）" value={settlement} setValue={setSettlement} />
            <NumberField
              label="投诉方信用分变化"
              value={complainantCredit}
              setValue={setComplainantCredit}
            />
            <NumberField
              label="被投诉方信用分变化"
              value={respondentCredit}
              setValue={setRespondentCredit}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {preview ? (
            <section
              aria-label="裁决影响预览"
              className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800"
            >
              <h3 className="font-semibold text-slate-950">裁决影响预览</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <p>退款 {money(preview.refundAmount)}</p>
                <p>结算 {money(preview.settlementAmount)}</p>
                <p>
                  投诉方信用 {preview.complainantCreditDelta >= 0 ? "+" : ""}
                  {preview.complainantCreditDelta}
                </p>
                <p>
                  被投诉方信用 {preview.respondentCreditDelta >= 0 ? "+" : ""}
                  {preview.respondentCreditDelta}
                </p>
              </div>
              <p className="mt-3 font-medium text-blue-900">
                {level === "final"
                  ? "最终裁决提交后不可再次申诉"
                  : "初审裁决提交后进入 72 小时申诉期"}
              </p>
            </section>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-slate-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              取消
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-blue-300 px-4 font-semibold text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              预览裁决影响
            </button>
            {preview ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                提交{level === "final" ? "最终" : "初审"}裁决
              </button>
            ) : null}
          </div>
        </form>
        {confirming && preview ? (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/50 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-label={`确认提交${level === "final" ? "最终" : "初审"}裁决`}
              className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            >
              <h3 className="text-xl font-semibold">
                确认提交{level === "final" ? "最终" : "初审"}裁决
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                请再次核对裁决影响，提交后将立即进入后续流程。
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="min-h-11 rounded-lg border px-4"
                >
                  返回检查
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onSubmit(preview)}
                  className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50"
                >
                  确认提交
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      <input
        inputMode="numeric"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
      />
    </label>
  );
}
