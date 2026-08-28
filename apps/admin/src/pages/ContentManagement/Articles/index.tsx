import type {
  AdminClassroomArticleListItem,
  AdminClassroomArticleStatus,
} from "@petcare/shared-types";
import { CLASSROOM_ARTICLE_CATEGORY_LABELS } from "@petcare/shared-types";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BookOpen, MoreHorizontal, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  articleQueryKeys,
  fetchAdminClassroomArticles,
  offlineAdminClassroomArticle,
  publishAdminClassroomArticle,
} from "../../../api/content/articles";
import { usePermissions } from "../../../auth/permissions";
import {
  Badge,
  Button,
  ConfirmDialog,
  DataPanel,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableRow,
  FilterBar,
  ListSkeleton,
  PageHeader,
  PageShell,
  Pagination,
  SearchInput,
  Select,
  StatePanel,
} from "../../../components/ui";

const PAGE_SIZE = 20;

const statusLabels: Record<AdminClassroomArticleStatus, string> = {
  draft: "草稿",
  published: "已发布",
  offline: "已下线",
};

const statusTones: Record<AdminClassroomArticleStatus, "warning" | "success" | "neutral"> = {
  draft: "warning",
  published: "success",
  offline: "neutral",
};

const statusActionLabels: Record<AdminClassroomArticleStatus, string> = {
  draft: "发布",
  published: "下线",
  offline: "重新发布",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "未发布";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: AdminClassroomArticleStatus }) {
  return <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>;
}

type ArticleStateAction = "publish" | "offline";

interface ArticleStateDialogProps {
  article: AdminClassroomArticleListItem | null;
  action: ArticleStateAction;
  pending: boolean;
  onConfirm(): void;
  onOpenChange(open: boolean): void;
}

function ArticleStateDialog({
  article,
  action,
  pending,
  onConfirm,
  onOpenChange,
}: ArticleStateDialogProps) {
  const publishing = action === "publish";
  let confirmationLabel = publishing ? "确认发布" : "确认下线";

  if (pending) {
    confirmationLabel = "处理中…";
  }

  return (
    <ConfirmDialog
      confirmLabel={confirmationLabel}
      description={
        publishing
          ? `发布后官网将立即展示《${article?.title ?? ""}》。`
          : `下线后官网将不再展示《${article?.title ?? ""}》。`
      }
      onConfirm={onConfirm}
      onOpenChange={(open) => !pending && onOpenChange(open)}
      open={article !== null}
      pending={pending}
      title={publishing ? "确认发布文章" : "确认下线文章"}
    />
  );
}

interface ArticleRowProps {
  article: AdminClassroomArticleListItem;
  canWrite: boolean;
  canPublish: boolean;
  onStateChange(article: AdminClassroomArticleListItem, action: ArticleStateAction): void;
}

function ArticleRow({ article, canWrite, canPublish, onStateChange }: ArticleRowProps) {
  const statusActionLabel = statusActionLabels[article.status];
  const publishingBlocked = article.status !== "published" && !article.category;
  let statusActionClass = "cursor-pointer text-success hover:bg-success-soft focus:bg-success-soft";

  if (article.status === "published") {
    statusActionClass = "text-warning hover:bg-warning-soft focus:bg-warning-soft";
  }

  if (publishingBlocked) {
    statusActionClass = "cursor-not-allowed text-text-disabled";
  }

  return (
    <DataTableRow>
      <DataTableCell>
        <div className="flex min-w-[320px] items-start gap-3">
          <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted text-text-muted">
            {article.coverUrl ? (
              <img
                src={article.coverUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <BookOpen aria-hidden="true" className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-text-primary">{article.title}</p>
              <Badge tone={article.category ? "info" : "warning"}>
                {article.category ? CLASSROOM_ARTICLE_CATEGORY_LABELS[article.category] : "未分类"}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
              {article.summary}
            </p>
          </div>
        </div>
      </DataTableCell>
      <DataTableCell className="text-text-secondary">
        {article.author?.nickname ?? "系统文章"}
      </DataTableCell>
      <DataTableCell>
        <StatusBadge status={article.status} />
      </DataTableCell>
      <DataTableCell className="whitespace-nowrap text-text-secondary">
        {formatDate(article.publishedAt)}
      </DataTableCell>
      <DataTableCell className="whitespace-nowrap text-text-secondary">
        {formatDate(article.updatedAt)}
      </DataTableCell>
      <DataTableCell>
        <div className="flex min-w-max items-center gap-1 text-sm font-medium">
          {canWrite && article.status !== "published" ? (
            <Button asChild intent="ghost" size="sm">
              <Link to={`/content/articles/${article.id}/edit`}>编辑</Link>
            </Button>
          ) : null}
          {article.status === "published" ? (
            <Button asChild intent="ghost" size="sm">
              <a
                href={article.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`查看官网 ${article.title}`}
              >
                查看官网
              </a>
            </Button>
          ) : null}
          {canPublish ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  aria-label={`更多 ${article.title}`}
                  className="h-8 px-2"
                  intent="ghost"
                  size="sm"
                >
                  更多
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-30 min-w-32 rounded-lg border border-border bg-surface p-1 shadow-panel-hover outline-none"
                >
                  <DropdownMenu.Item
                    aria-label={`${publishingBlocked ? "请先选择分类" : statusActionLabel} ${article.title}`}
                    disabled={publishingBlocked}
                    onSelect={() =>
                      onStateChange(article, article.status === "published" ? "offline" : "publish")
                    }
                    className={`flex min-h-10 items-center rounded-md px-3 py-2 text-sm font-medium outline-none ${statusActionClass}`}
                  >
                    {publishingBlocked ? "请先选择分类" : statusActionLabel}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
      </DataTableCell>
    </DataTableRow>
  );
}

export default function ContentArticles() {
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState<string>();
  const [status, setStatus] = useState<AdminClassroomArticleStatus>();
  const [dialog, setDialog] = useState<{
    article: AdminClassroomArticleListItem;
    action: ArticleStateAction;
  } | null>(null);
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const canWrite = permissions.has("content.article.write");
  const canPublish = permissions.has("content.article.publish");

  const query = useQuery({
    queryKey: [...articleQueryKeys.all, { page, keyword, status }],
    queryFn: () => fetchAdminClassroomArticles({ page, pageSize: PAGE_SIZE, keyword, status }),
    placeholderData: keepPreviousData,
  });

  const publishMutation = useMutation({
    mutationFn: (article: AdminClassroomArticleListItem) =>
      publishAdminClassroomArticle(article.id, { expectedUpdatedAt: article.updatedAt }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all });
      setDialog(null);
    },
  });

  const offlineMutation = useMutation({
    mutationFn: (article: AdminClassroomArticleListItem) =>
      offlineAdminClassroomArticle(article.id, { expectedUpdatedAt: article.updatedAt }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all });
      setDialog(null);
    },
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(keyword || status);
  const dialogPending =
    dialog?.action === "publish" ? publishMutation.isPending : offlineMutation.isPending;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKeyword(keywordInput.trim() || undefined);
    setPage(1);
  }

  function resetFilters() {
    setKeywordInput("");
    setKeyword(undefined);
    setStatus(undefined);
    setPage(1);
  }

  function handleStateChange(article: AdminClassroomArticleListItem, action: ArticleStateAction) {
    setDialog({ article, action });
  }

  function confirmStateChange() {
    if (!dialog) {
      return;
    }

    if (dialog.action === "publish") {
      publishMutation.mutate(dialog.article);

      return;
    }

    offlineMutation.mutate(dialog.article);
  }

  function renderEmptyAction() {
    if (filtersActive) {
      return (
        <Button intent="secondary" onClick={resetFilters}>
          重置筛选
        </Button>
      );
    }

    if (canWrite) {
      return (
        <Button asChild>
          <Link to="/content/articles/new">
            <Plus aria-hidden="true" className="h-4 w-4" />
            创建第一篇文章
          </Link>
        </Button>
      );
    }

    return null;
  }

  return (
    <PageShell>
      <PageHeader
        actions={
          <>
            <Badge className="h-10 px-3" tone="brand">
              <BookOpen aria-hidden="true" className="h-4 w-4" />共 {total} 篇文章
            </Badge>
            {canWrite ? (
              <Button asChild>
                <Link to="/content/articles/new">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  新建文章
                </Link>
              </Button>
            ) : null}
          </>
        }
        description="维护宠物护理课堂文章的发布状态和基础信息。"
        eyebrow="内容管理"
        title="文章管理"
      />

      <FilterBar
        aria-label="文章筛选"
        className="md:grid-cols-[minmax(260px,1fr)_180px_auto]"
        onSubmit={submitSearch}
      >
        <SearchInput
          aria-label="搜索文章"
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="搜索标题、摘要或正文"
          value={keywordInput}
        />
        <Select
          aria-label="文章状态"
          onChange={(event) => {
            setStatus((event.target.value || undefined) as AdminClassroomArticleStatus | undefined);
            setPage(1);
          }}
          value={status ?? ""}
        >
          <option value="">全部文章状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="offline">已下线</option>
        </Select>
        <div className="flex gap-2">
          <Button className="flex-1 md:flex-none" type="submit">
            查询
          </Button>
          <span className="group relative block">
            <Button
              aria-label="重置筛选条件"
              aria-describedby="article-filter-reset-tooltip"
              intent="secondary"
              onClick={resetFilters}
              size="icon"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            </Button>
            <span
              id="article-filter-reset-tooltip"
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-max rounded-md bg-slate-950 px-2 py-1 text-xs text-white opacity-0 shadow-panel transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              重置筛选条件
            </span>
          </span>
        </div>
      </FilterBar>

      <DataPanel aria-label="文章列表">
        {query.isPending && <ListSkeleton label="正在加载文章" rowClassName="h-16" />}
        {!query.isPending && query.isError && (
          <StatePanel
            action={<Button onClick={() => void query.refetch()}>重试</Button>}
            description="请检查服务端连接后重试。"
            icon={<AlertCircle aria-hidden="true" className="h-6 w-6" />}
            title="文章加载失败"
            tone="danger"
          />
        )}
        {!query.isPending && !query.isError && query.data?.list.length === 0 && (
          <StatePanel
            action={renderEmptyAction()}
            description={
              filtersActive
                ? "尝试调整搜索关键词或筛选条件。"
                : "还没有创建文章，可以创建第一篇文章。"
            }
            icon={<BookOpen aria-hidden="true" className="h-6 w-6" />}
            title={filtersActive ? "没有符合条件的文章" : "暂无文章"}
          />
        )}
        {!query.isPending && !query.isError && query.data?.list.length !== 0 && (
          <>
            <DataTable minWidthClassName="min-w-[920px]">
              <DataTableHead>
                <tr>
                  <DataTableHeadCell>文章</DataTableHeadCell>
                  <DataTableHeadCell>作者</DataTableHeadCell>
                  <DataTableHeadCell>状态</DataTableHeadCell>
                  <DataTableHeadCell>发布时间</DataTableHeadCell>
                  <DataTableHeadCell>更新时间</DataTableHeadCell>
                  <DataTableHeadCell>操作</DataTableHeadCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {query.data?.list.map((article) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    canWrite={canWrite}
                    canPublish={canPublish}
                    onStateChange={handleStateChange}
                  />
                ))}
              </DataTableBody>
            </DataTable>
            <Pagination
              disabled={query.isFetching}
              itemLabel="篇文章"
              onPageChange={setPage}
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              totalPages={totalPages}
            />
          </>
        )}
      </DataPanel>
      <ArticleStateDialog
        article={dialog?.article ?? null}
        action={dialog?.action ?? "publish"}
        pending={dialogPending}
        onConfirm={confirmStateChange}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
          }
        }}
      />
    </PageShell>
  );
}
