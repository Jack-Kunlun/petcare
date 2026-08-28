import {
  isCurrentWebsiteContentKey,
  type CurrentWebsiteContentKey,
  type WebsiteContentOverviewResponse,
} from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FilePenLine, FileText, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchWebsiteContentOverview, websiteContentQueryKeys } from "../../api/website-content";
import { PermissionGate } from "../../auth/PermissionGate";
import {
  Badge,
  Button,
  PageHeader,
  PageShell,
  Panel,
  Skeleton,
  StatePanel,
} from "../../components/ui";
import { getContentEditPath, MANAGED_CONTENT_LABELS } from "./content-registry";

type CurrentOverviewItem = WebsiteContentOverviewResponse[number] & {
  contentKey: CurrentWebsiteContentKey;
};

interface ManagedContentOverviewProps {
  /** Short category label shown above the page title. */
  eyebrow: string;
  /** Primary page heading. */
  title: string;
  /** Explains the exact publication scope represented by this page. */
  description: string;
  /** Disjoint content keys owned by this overview. */
  contentKeys: readonly CurrentWebsiteContentKey[];
  /** Accessible list name used by tests and assistive technology. */
  listLabel: string;
}

function isCurrentOverviewItem(
  item: WebsiteContentOverviewResponse[number],
): item is CurrentOverviewItem {
  return isCurrentWebsiteContentKey(item.contentKey);
}

/** Renders one scoped content-management overview without mixing unrelated publication areas. */
export function ManagedContentOverview({
  eyebrow,
  title,
  description,
  contentKeys,
  listLabel,
}: ManagedContentOverviewProps) {
  const overviewQuery = useQuery({
    queryKey: websiteContentQueryKeys.overview(),
    queryFn: fetchWebsiteContentOverview,
  });
  const keySet = new Set(contentKeys);
  const scopedOverview = overviewQuery.data
    ?.filter(isCurrentOverviewItem)
    .filter((item) => keySet.has(item.contentKey));

  return (
    <PageShell width="reading">
      <PageHeader description={description} eyebrow={eyebrow} title={title} />

      {overviewQuery.isPending ? (
        <div aria-label={`正在加载${title}`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contentKeys.map((contentKey) => (
            <Panel className="h-56" key={contentKey}>
              <Skeleton className="pt-1" lines={4} />
            </Panel>
          ))}
        </div>
      ) : null}

      {overviewQuery.isError ? (
        <StatePanel
          action={
            <Button intent="secondary" onClick={() => void overviewQuery.refetch()}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              重新加载
            </Button>
          }
          description="请检查网络连接后重试，已发布内容不会受到影响。"
          icon={<AlertCircle aria-hidden="true" className="h-6 w-6" />}
          role="alert"
          title={`${title}加载失败`}
          tone="danger"
        />
      ) : null}

      {scopedOverview && scopedOverview.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={listLabel}>
          {scopedOverview.map((item) => (
            <li key={item.contentKey}>
              <Panel className="flex h-full flex-col" interactive>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand-primary">
                      <FileText aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <h2 className="mt-3 font-semibold text-text-primary">
                      {MANAGED_CONTENT_LABELS[item.contentKey]}
                    </h2>
                    <p className="mt-0.5 text-xs text-text-secondary">{item.contentKey}</p>
                  </div>
                  <Badge tone="neutral">草稿 r{item.draftRevision}</Badge>
                </div>
                <dl className="mt-4 space-y-2.5 text-sm text-text-secondary">
                  <div className="flex justify-between gap-3">
                    <dt>当前发布版本</dt>
                    <dd className="font-medium text-text-primary">
                      {item.publishedBusinessVersion === null
                        ? "尚未发布"
                        : `v${item.publishedBusinessVersion}`}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>最近编辑</dt>
                    <dd className="text-text-primary">{item.lastEditedBy.displayName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>发布时间</dt>
                    <dd className="text-right text-text-primary">
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleString("zh-CN")
                        : "未发布"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex min-h-6 flex-wrap items-center gap-2">
                  <Badge tone={item.publishedBusinessVersion === null ? "neutral" : "success"}>
                    {item.publishedBusinessVersion === null
                      ? "尚未发布"
                      : `已发布 v${item.publishedBusinessVersion}`}
                  </Badge>
                  {item.hasUnpublishedChanges ? <Badge tone="warning">有未发布变更</Badge> : null}
                </div>
                <PermissionGate all={["website.edit"]}>
                  <Button asChild className="mt-4 w-fit" intent="secondary">
                    <Link
                      to={getContentEditPath(item.contentKey)}
                      aria-label={`编辑${MANAGED_CONTENT_LABELS[item.contentKey]}草稿`}
                    >
                      <FilePenLine aria-hidden="true" className="h-4 w-4" />
                      编辑草稿
                    </Link>
                  </Button>
                </PermissionGate>
              </Panel>
            </li>
          ))}
        </ul>
      ) : null}

      {scopedOverview && scopedOverview.length === 0 ? (
        <StatePanel
          description="当前没有可维护的内容单元。"
          icon={<FileText aria-hidden="true" className="h-6 w-6" />}
          title="暂无内容配置"
        />
      ) : null}
    </PageShell>
  );
}
