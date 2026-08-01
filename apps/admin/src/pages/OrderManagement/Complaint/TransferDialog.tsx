import type { TransferComplaintRequest } from "@petcare/shared-types";
import { useState, type FormEvent } from "react";

interface TransferDialogProps {
  /** 当前案件并发版本。 */
  version: number;
  /** 是否正在提交。 */
  pending: boolean;
  /** 关闭弹窗。 */
  onClose: () => void;
  /** 提交转派请求。 */
  onSubmit: (request: TransferComplaintRequest) => void;
}

/** 收集目标管理员与转派原因。 */
export function TransferDialog({ version, pending, onClose, onSubmit }: TransferDialogProps) {
  const [targetAdminId, setTargetAdminId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!targetAdminId.trim() || reason.trim().length < 2) {
      setError("请填写目标管理员 ID，并至少用 2 个字符说明转派原因");

      return;
    }

    onSubmit({ targetAdminId: targetAdminId.trim(), reason: reason.trim(), version });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <h2 id="transfer-title" className="text-xl font-semibold text-slate-950">
          转派案件
        </h2>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-800">
            目标管理员 ID
            <input
              value={targetAdminId}
              onChange={(event) => setTargetAdminId(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            转派原因
            <textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-slate-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              确认转派
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
