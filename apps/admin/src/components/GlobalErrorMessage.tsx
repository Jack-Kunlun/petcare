import { AlertCircle, ShieldAlert, X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import {
  dismissGlobalError,
  getGlobalErrorSnapshot,
  subscribeGlobalError,
} from "../lib/global-error";

const NORMAL_ERROR_DURATION_MS = 6_000;
const SESSION_ERROR_DURATION_MS = 10_000;

/** Renders the active global error as a non-blocking, dismissible top-right notice. */
export function GlobalErrorMessage() {
  const current = useSyncExternalStore(
    subscribeGlobalError,
    getGlobalErrorSnapshot,
    getGlobalErrorSnapshot,
  );

  useEffect(() => {
    if (!current) {
      return;
    }

    const duration =
      current.priority === "session" ? SESSION_ERROR_DURATION_MS : NORMAL_ERROR_DURATION_MS;
    const timer = window.setTimeout(() => dismissGlobalError(current.id), duration);

    return () => window.clearTimeout(timer);
  }, [current]);

  if (!current) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-atomic="true"
      data-priority={current.priority}
      className="fixed inset-x-4 top-4 z-[100] flex items-start gap-3 rounded-xl border border-danger-border bg-surface p-4 text-sm text-text-primary shadow-float sm:left-auto sm:right-4 sm:w-[min(420px,calc(100vw-32px))]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger">
        {current.priority === "session" ? (
          <ShieldAlert aria-hidden="true" className="h-5 w-5" />
        ) : (
          <AlertCircle aria-hidden="true" className="h-5 w-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-text-primary">
          {current.priority === "session" ? "登录状态异常" : "操作未完成"}
        </span>
        <span className="mt-1 block leading-5 text-text-secondary">{current.message}</span>
      </span>
      <button
        type="button"
        aria-label="关闭错误提示"
        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-text-secondary outline-none transition-colors hover:bg-surface-subtle hover:text-text-primary focus-visible:ring-2 focus-visible:ring-brand-primary"
        onClick={() => dismissGlobalError(current.id)}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
