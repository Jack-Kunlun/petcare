import { X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import {
  dismissGlobalError,
  getGlobalErrorSnapshot,
  subscribeGlobalError,
} from "../lib/global-error";

/** Renders the active global error with a close control and a three-second auto-dismiss timer. */
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

    const timer = window.setTimeout(() => dismissGlobalError(current.id), 3_000);

    return () => window.clearTimeout(timer);
  }, [current]);

  if (!current) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed left-1/2 top-4 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-3 rounded-lg bg-red-700 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>{current.message}</span>
      <button
        type="button"
        aria-label="关闭错误提示"
        className="cursor-pointer rounded p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={() => dismissGlobalError(current.id)}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
