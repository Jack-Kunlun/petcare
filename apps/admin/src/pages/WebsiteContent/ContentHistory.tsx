import type { CurrentWebsiteContentKey, WebsiteContentVersion } from "@petcare/shared-types";
import { Link } from "react-router-dom";
import { getContentHistoryPath } from "./content-registry";

interface ContentHistoryProps {
  /** Independently managed Website Content identity. */
  contentKey: CurrentWebsiteContentKey;
  /** Immutable published versions ordered by the Server response. */
  items: readonly WebsiteContentVersion[];
  /** Version currently open in the detail route. */
  selectedVersionId?: string;
  /** Indicates that history is being loaded. */
  loading?: boolean;
  /** Indicates that history failed to load. */
  error?: boolean;
  /** Retries the history request. */
  onRetry?(): void;
}

/** Renders immutable Website Content history links without presenting rollback semantics. */
export function ContentHistory({
  contentKey,
  items,
  selectedVersionId,
  loading = false,
  error = false,
  onRetry,
}: ContentHistoryProps) {
  if (loading) {
    return (
      <p
        aria-live="polite"
        className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600"
      >
        正在加载历史版本…
      </p>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-950">
        <p className="font-semibold">历史版本加载失败</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-lg border border-red-700 px-4 font-semibold outline-none hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-800"
          >
            重试
          </button>
        ) : null}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-slate-600">
        暂无已发布历史版本。
      </p>
    );
  }

  return (
    <nav aria-label="内容历史版本">
      <ol className="space-y-2">
        {items.map((version) => (
          <li key={version.id}>
            <Link
              to={getContentHistoryPath(contentKey, version.id)}
              aria-current={version.id === selectedVersionId ? "page" : undefined}
              className="block rounded-lg border border-slate-200 bg-white p-4 outline-none transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-950">
                  {version.businessVersion === null
                    ? `修订 r${version.revision}`
                    : `已发布 v${version.businessVersion}`}
                </span>
                <span className="text-sm text-slate-600">
                  {new Intl.DateTimeFormat("zh-CN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(version.publishedAt ?? version.createdAt))}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{version.changeSummary}</p>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
