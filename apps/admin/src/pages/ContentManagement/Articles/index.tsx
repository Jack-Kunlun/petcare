import type {
  AdminClassroomArticleListItem,
  AdminClassroomArticleStatus,
} from "@petcare/shared-types";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
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

const PAGE_SIZE = 20;

const statusLabels: Record<AdminClassroomArticleStatus, string> = {
  draft: "草稿",
  published: "已发布",
  offline: "已下线",
};

const statusClasses: Record<AdminClassroomArticleStatus, string> = {
  draft: "bg-amber-50 text-amber-700 ring-amber-600/20",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  offline: "bg-slate-100 text-slate-600 ring-slate-500/20",
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
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
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
  let confirmationLabel = "确认下线";

  if (publishing) {
    confirmationLabel = "确认发布";
  }

  if (pending) {
    confirmationLabel = "处理中…";
  }

  return (
    <Dialog.Root open={article !== null} onOpenChange={(open) => !pending && onOpenChange(open)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45" />
        <Dialog.Content
          onEscapeKeyDown={(event) => pending && event.preventDefault()}
          onPointerDownOutside={(event) => pending && event.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-[min(448px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          <Dialog.Title className="text-lg font-semibold text-slate-950">
            {publishing ? "确认发布文章" : "确认下线文章"}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
            {publishing
              ? `发布后官网将立即展示《${article?.title ?? ""}》。`
              : `下线后官网将不再展示《${article?.title ?? ""}》。`}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => onOpenChange(false)}
              className="min-h-11 cursor-pointer rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className="min-h-11 cursor-pointer rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white outline-none transition-colors hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {confirmationLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

  return (
    <tr className="border-t border-border align-top transition-[background-color,border-color] duration-200 hover:bg-page-background hover:border-border">
      <td className="px-5 py-4">
        <div className="flex min-w-[320px] items-start gap-3">
          <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
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
            <p className="font-medium text-slate-900">{article.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{article.summary}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-slate-700">{article.author?.nickname ?? "系统文章"}</td>
      <td className="px-5 py-4">
        <StatusBadge status={article.status} />
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">{formatDate(article.publishedAt)}</td>
      <td className="px-5 py-4 text-sm text-slate-600">{formatDate(article.updatedAt)}</td>
      <td className="px-5 py-4">
        <div className="flex min-w-max items-center gap-3 text-sm font-medium">
          {canWrite && article.status !== "published" ? (
            <Link
              to={`/content/articles/${article.id}/edit`}
              className="cursor-pointer text-blue-700 transition-colors hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              编辑
            </Link>
          ) : null}
          {article.status === "published" ? (
            <a
              href={article.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`查看官网 ${article.title}`}
              className="cursor-pointer text-blue-700 transition-colors hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              查看官网
            </a>
          ) : null}
          {canPublish ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={`更多 ${article.title}`}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-slate-600 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-700"
                >
                  更多
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-30 min-w-32 rounded-lg border border-slate-200 bg-white p-1 shadow-lg outline-none"
                >
                  <DropdownMenu.Item
                    aria-label={`${statusActionLabel} ${article.title}`}
                    onSelect={() =>
                      onStateChange(article, article.status === "published" ? "offline" : "publish")
                    }
                    className={`flex min-h-10 cursor-pointer items-center rounded-md px-3 py-2 text-sm font-medium outline-none ${
                      article.status === "published"
                        ? "text-amber-700 hover:bg-amber-50 focus:bg-amber-50"
                        : "text-emerald-700 hover:bg-emerald-50 focus:bg-emerald-50"
                    }`}
                  >
                    {statusActionLabel}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
      </td>
    </tr>
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

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 text-text-primary">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-700">内容管理</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">文章管理</h1>
          <p className="mt-1 text-sm text-slate-500">维护宠物护理课堂文章的发布状态和基础信息。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4">
            <BookOpen aria-hidden="true" className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-600">共 {total} 篇文章</span>
          </div>
          {canWrite ? (
            <Link
              to="/content/articles/new"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              新建文章
            </Link>
          ) : null}
        </div>
      </section>

      <section
        aria-label="文章筛选"
        className="rounded-xl border border-border bg-white p-4 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
      >
        <form
          className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_180px_80px_40px]"
          onSubmit={submitSearch}
        >
          <label className="relative block">
            <span className="sr-only">搜索文章</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              aria-label="搜索文章"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索标题、摘要或正文"
              className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary hover:border-brand-primary/60 focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            />
          </label>
          <label>
            <span className="sr-only">文章状态</span>
            <select
              aria-label="文章状态"
              value={status ?? ""}
              onChange={(event) => {
                setStatus(
                  (event.target.value || undefined) as AdminClassroomArticleStatus | undefined,
                );
                setPage(1);
              }}
              className="h-10 w-full cursor-pointer rounded-lg border border-border bg-white px-3 text-sm text-text-secondary outline-none transition-colors hover:border-brand-primary/60 active:bg-page-background focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            >
              <option value="">全部文章状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="offline">已下线</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover active:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            查询
          </button>
          <span className="group relative block">
            <button
              type="button"
              aria-label="重置筛选条件"
              aria-describedby="article-filter-reset-tooltip"
              onClick={resetFilters}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand-primary/60 hover:bg-page-background active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            </button>
            <span
              id="article-filter-reset-tooltip"
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-max rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              重置筛选条件
            </span>
          </span>
        </form>
      </section>

      <section
        aria-label="文章列表"
        className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
      >
        {query.isPending && (
          <div aria-label="正在加载文章" className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="h-16 rounded-lg bg-slate-100 animate-[pc-skeleton-shimmer_220ms_linear_infinite] motion-reduce:animate-none"
              />
            ))}
          </div>
        )}
        {!query.isPending && query.isError && (
          <div
            role="alert"
            className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center"
          >
            <AlertCircle aria-hidden="true" className="h-6 w-6 text-red-700" />
            <h2 className="mt-4 font-semibold text-slate-900">文章加载失败</h2>
            <p className="mt-1 text-sm text-slate-500">请检查服务端连接后重试。</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-4 cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              重试
            </button>
          </div>
        )}
        {!query.isPending && !query.isError && query.data?.list.length === 0 && (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
            <BookOpen aria-hidden="true" className="h-8 w-8 text-slate-300" />
            <h2 className="mt-4 font-semibold text-slate-900">
              {filtersActive ? "没有符合条件的文章" : "暂无文章"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {filtersActive
                ? "尝试调整搜索关键词或筛选条件。"
                : "还没有创建文章，可以创建第一篇文章。"}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 h-10 cursor-pointer rounded-lg border border-border px-4 font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                重置筛选
              </button>
            )}
            {!filtersActive && canWrite && (
              <Link
                to="/content/articles/new"
                className="mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white outline-none transition-colors hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                创建第一篇文章
              </Link>
            )}
          </div>
        )}
        {!query.isPending && !query.isError && query.data?.list.length !== 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">文章</th>
                    <th className="px-5 py-3">作者</th>
                    <th className="px-5 py-3">状态</th>
                    <th className="px-5 py-3">发布时间</th>
                    <th className="px-5 py-3">更新时间</th>
                    <th className="px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data?.list.map((article) => (
                    <ArticleRow
                      key={article.id}
                      article={article}
                      canWrite={canWrite}
                      canPublish={canPublish}
                      onStateChange={handleStateChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
              <span>
                第 {page} / {totalPages} 页，共 {total} 条
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="上一页"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand-primary/60 hover:bg-page-background active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-60"
                >
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="下一页"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand-primary/60 hover:bg-page-background active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-60"
                >
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
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
    </div>
  );
}
