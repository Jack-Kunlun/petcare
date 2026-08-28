import type { CurrentWebsiteContentKey, WebsiteContentVersion } from "@petcare/shared-types";
import { ChevronRight, Clock3, History, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Skeleton, StatePanel } from "../../components/ui";
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
      <div aria-live="polite" aria-label="正在加载历史版本…" className="space-y-3">
        <span className="sr-only">正在加载历史版本…</span>
        <Skeleton lines={4} />
      </div>
    );
  }

  if (error) {
    return (
      <StatePanel
        role="alert"
        tone="danger"
        className="min-h-44"
        icon={<RefreshCw aria-hidden="true" className="h-5 w-5" />}
        title="历史版本加载失败"
        description="未能读取不可变发布历史。"
        action={
          onRetry ? (
            <Button intent="dangerOutline" onClick={onRetry}>
              重试
            </Button>
          ) : null
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <StatePanel
        className="min-h-44"
        icon={<History aria-hidden="true" className="h-5 w-5" />}
        title="暂无已发布历史版本。"
        description="首次发布后，这里会按时间显示不可变版本记录。"
      />
    );
  }

  return (
    <nav aria-label="内容历史版本">
      <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[11px] before:top-4 before:w-px before:bg-border">
        {items.map((version) => (
          <li key={version.id} className="relative pl-8">
            <span
              aria-hidden="true"
              className="absolute left-1 top-5 z-[1] h-4 w-4 rounded-full border-4 border-surface bg-brand-primary"
            />
            <Link
              to={getContentHistoryPath(contentKey, version.id)}
              aria-current={version.id === selectedVersionId ? "page" : undefined}
              className="group block rounded-xl border border-border bg-surface p-4 outline-none transition-[border-color,background-color,box-shadow] hover:border-brand-primary/30 hover:bg-surface-subtle hover:shadow-panel focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text-primary">
                      {version.businessVersion === null
                        ? `修订 r${version.revision}`
                        : `已发布 v${version.businessVersion}`}
                    </span>
                    <Badge tone={version.status === "published" ? "success" : "neutral"}>
                      {version.status === "published" ? "当前生效" : "历史版本"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">
                    {version.changeSummary}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-muted">
                    <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                    {new Intl.DateTimeFormat("zh-CN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(version.publishedAt ?? version.createdAt))}
                  </span>
                </div>
                <ChevronRight
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
