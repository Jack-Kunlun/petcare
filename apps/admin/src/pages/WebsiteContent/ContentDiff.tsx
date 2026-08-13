import type {
  WebsiteContentDiffChangeType,
  WebsiteContentDiffItem,
  WebsiteContentDiffValue,
} from "@petcare/shared-types";
import { ArrowRight } from "lucide-react";

function formatValue(value: WebsiteContentDiffValue | undefined): string {
  if (value === undefined) {
    return "不存在";
  }

  if (value === null) {
    return "空值";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function changeTypeLabel(changeType: WebsiteContentDiffChangeType): string {
  if (changeType === "added") {
    return "新增";
  }

  if (changeType === "removed") {
    return "移除";
  }

  return "修改";
}

/** Renders stable field-level Website Content differences without interpreting arbitrary JSON. */
export function ContentDiff({ items }: { items: readonly WebsiteContentDiffItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-700">
        当前草稿与已发布版本没有字段差异。
      </div>
    );
  }

  return (
    <ol aria-label="官网内容字段差异" className="space-y-3">
      {items.map((item) => (
        <li key={`${item.path}-${item.changeType}`} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="break-all font-mono text-sm font-semibold text-slate-950">{item.path}</p>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
              {changeTypeLabel(item.changeType)}
            </span>
          </div>
          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
            <div className="min-w-0 rounded-md bg-red-50 p-3">
              <span className="block text-xs font-semibold text-red-800">发布前</span>
              <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-red-950">
                {formatValue(item.before)}
              </pre>
            </div>
            <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-90 justify-self-center text-slate-500 sm:rotate-0" />
            <div className="min-w-0 rounded-md bg-emerald-50 p-3">
              <span className="block text-xs font-semibold text-emerald-800">发布后</span>
              <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-emerald-950">
                {formatValue(item.after)}
              </pre>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
