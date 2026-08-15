import type { PublishWebsiteContentRequest, WebsiteContentDiffItem } from "@petcare/shared-types";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ContentDiff } from "./ContentDiff";

interface PublishDialogProps {
  /** Whether the publish confirmation dialog is visible. */
  open: boolean;
  /** Content unit being published. */
  contentKey: string;
  /** Saved draft revision to publish. */
  revision: number;
  /** Field-level diff between the saved draft and published snapshot. */
  diff: readonly WebsiteContentDiffItem[];
  /** Whether the diff request is pending. */
  diffLoading: boolean;
  /** Whether the diff request failed. */
  diffError: boolean;
  /** Whether the current publish mutation is pending. */
  pending: boolean;
  /** Whether current edits have been saved and are eligible for publication. */
  canPublish?: boolean;
  /** Controls dialog visibility. */
  onOpenChange(open: boolean): void;
  /** Retries the diff request. */
  onRetryDiff(): void;
  /** Executes the explicit publish command. */
  onPublish(request: PublishWebsiteContentRequest): void;
}

function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

/** Confirms a page-scoped Website Content publish with diff review and an explicit second confirmation. */
export function PublishDialog({
  open,
  contentKey,
  revision,
  diff,
  diffLoading,
  diffError,
  pending,
  canPublish = true,
  onOpenChange,
  onRetryDiff,
  onPublish,
}: PublishDialogProps) {
  const [stage, setStage] = useState<"review" | "confirm">("review");
  const [changeSummary, setChangeSummary] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStage("review");
      setChangeSummary("");
      idempotencyKeyRef.current = null;
    }
  }, [open]);

  function confirmPublish() {
    idempotencyKeyRef.current ??= createIdempotencyKey();
    onPublish({
      revision,
      idempotencyKey: idempotencyKeyRef.current,
      changeSummary: changeSummary.trim(),
    });
  }

  const canContinue =
    canPublish && !diffLoading && !diffError && diff.length > 0 && Boolean(changeSummary.trim());

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 max-h-[90dvh] -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-800 sm:left-1/2 sm:right-auto sm:w-[min(768px,calc(100vw-32px))] sm:-translate-x-1/2 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold text-slate-950">
                {stage === "review" ? `发布前确认：${contentKey}` : "最终发布确认"}
              </Dialog.Title>
              <Dialog.Description className="mt-2 leading-6 text-slate-600">
                {stage === "review"
                  ? "请检查字段差异并填写本次发布摘要。"
                  : "这是第二次确认。发布后新的业务版本会立即对外生效。"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="关闭发布确认"
                disabled={pending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:opacity-40"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle aria-hidden="true" className="h-5 w-5" />
              发布影响
            </p>
            <p className="mt-2 leading-6">
              发布只影响“{contentKey}”页面，不会自动发布其他页面或未保存编辑。
            </p>
          </div>

          {stage === "review" ? (
            <div className="mt-5 space-y-5">
              {diffLoading ? (
                <p aria-live="polite" className="py-8 text-center text-slate-600">
                  正在计算字段差异…
                </p>
              ) : null}
              {diffError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-950"
                >
                  <p className="font-semibold">字段差异加载失败</p>
                  <button
                    type="button"
                    onClick={onRetryDiff}
                    className="mt-3 min-h-11 rounded-lg border border-red-700 px-4 py-2 font-semibold outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-800"
                  >
                    重试加载差异
                  </button>
                </div>
              ) : null}
              {!diffLoading && !diffError ? <ContentDiff items={diff} /> : null}
              <label className="block">
                <span className="text-sm font-medium text-slate-800">
                  变更摘要{" "}
                  <span aria-hidden="true" className="text-red-700">
                    *
                  </span>
                </span>
                <textarea
                  aria-label="变更摘要"
                  rows={3}
                  value={changeSummary}
                  onChange={(event) => setChangeSummary(event.target.value)}
                  className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                />
              </label>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border-2 border-red-200 bg-red-50 p-5 text-red-950">
              <p className="font-semibold">确认立即发布？</p>
              <p className="mt-2">
                系统会记录发布人、时间和变更摘要，此操作不能在当前对话框中撤销。
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={pending}
                className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-800 disabled:opacity-40"
              >
                取消
              </button>
            </Dialog.Close>
            {stage === "review" ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStage("confirm")}
                className="min-h-11 rounded-lg bg-blue-800 px-5 py-2 font-semibold text-white outline-none hover:bg-blue-900 focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                继续发布
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={confirmPublish}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 py-2 font-semibold text-white outline-none hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? (
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : null}
                {pending ? "正在发布…" : "确认发布"}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
