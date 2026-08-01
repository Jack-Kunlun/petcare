import type { SystemConfigDiff } from "@petcare/shared-types";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfigDiff } from "./ConfigDiff";

interface PublishDialogProps {
  open: boolean;
  title: string;
  impact: string;
  diff: SystemConfigDiff[];
  diffLoading: boolean;
  pending: boolean;
  onOpenChange(open: boolean): void;
  onPublish(): void;
}

export function PublishDialog({ open, title, impact, diff, diffLoading, pending, onOpenChange, onPublish }: PublishDialogProps) {
  const [stage, setStage] = useState<"review" | "confirm">("review");

  useEffect(() => {
    if (!open) {setStage("review");}
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] data-[state=closed]:opacity-0 data-[state=open]:opacity-100 data-[state=closed]:transition-opacity data-[state=open]:transition-opacity data-[state=closed]:duration-200 data-[state=open]:duration-200 motion-reduce:transition-none" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 max-h-[90dvh] -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-800 sm:left-1/2 sm:right-auto sm:w-[min(768px,calc(100vw-32px))] sm:-translate-x-1/2 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold text-slate-950">{stage === "review" ? `发布前确认：${title}` : "最终发布确认"}</Dialog.Title>
              <Dialog.Description className="mt-2 leading-6 text-slate-600">{stage === "review" ? "请逐项检查字段差异和业务影响。" : "这是第二次确认。发布后新业务将立即使用该配置。"}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="关闭发布确认" disabled={pending} className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 outline-none transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"><X aria-hidden="true" className="h-5 w-5" /></button>
            </Dialog.Close>
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle aria-hidden="true" className="h-5 w-5" />影响说明</p>
            <p className="mt-2 leading-6">{impact}</p>
          </div>

          {stage === "review" ? <div className="mt-5">{diffLoading ? <p aria-live="polite" className="py-8 text-center text-slate-600">正在计算字段差异…</p> : <ConfigDiff items={diff} />}</div> : (
            <div className="mt-5 rounded-lg border-2 border-red-200 bg-red-50 p-5 text-red-950">
              <p className="font-semibold">确认现在发布？</p>
              <p className="mt-2">系统会记录发布人、时间和变更摘要。此操作不能在当前对话框中撤销，可稍后从历史版本复制为新草稿。</p>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Dialog.Close asChild><button type="button" disabled={pending} className="min-h-11 cursor-pointer rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 outline-none transition-colors duration-200 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none">取消</button></Dialog.Close>
            {stage === "review" ? <button type="button" disabled={diffLoading || diff.length === 0} onClick={() => setStage("confirm")} className="min-h-11 cursor-pointer rounded-lg bg-blue-800 px-5 py-2 font-semibold text-white outline-none transition-colors duration-200 hover:bg-blue-900 focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none">继续发布</button> : <button type="button" disabled={pending} onClick={onPublish} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-700 px-5 py-2 font-semibold text-white outline-none transition-colors duration-200 hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">{pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}{pending ? "正在发布…" : "确认发布"}</button>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
