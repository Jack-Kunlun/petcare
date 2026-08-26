import type { AdminContentPostListItem, AdminContentPostStatus } from "@petcare/shared-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  RotateCcw,
  Search,
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { fetchAdminContentPosts } from "../../../api/content/posts";

const PAGE_SIZE = 20;

const statusLabels: Record<AdminContentPostStatus, string> = {
  pending: "待审核",
  published: "已发布",
  rejected: "已驳回",
  offline: "已下架",
  deleted: "已删除",
};

const statusClasses: Record<AdminContentPostStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
  offline: "bg-orange-50 text-orange-700 ring-orange-600/20",
  deleted: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: AdminContentPostStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function PostRow({ post }: { post: AdminContentPostListItem }) {
  return (
    <tr className="border-t border-border align-top transition-[background-color,border-color] duration-200 hover:bg-page-background hover:border-border">
      <td className="max-w-[360px] px-5 py-4">
        <p className="line-clamp-2 font-medium leading-6 text-slate-900">{post.contentExcerpt}</p>
        <p className="mt-1 text-xs text-slate-500">{post.id}</p>
      </td>
      <td className="px-5 py-4">
        <p className="font-medium text-slate-900">{post.author.nickname}</p>
        <p className="mt-1 text-xs text-slate-500">{post.author.phone}</p>
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">{post.mediaCount} 个媒体</td>
      <td className="px-5 py-4 text-sm text-slate-600">
        <div className="flex gap-3">
          <span>赞 {post.likesCount}</span>
          <span>评 {post.commentsCount}</span>
          <span>转 {post.sharesCount}</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <StatusBadge status={post.status} />
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">{formatDate(post.createdAt)}</td>
    </tr>
  );
}

export default function ContentPosts() {
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState<string>();
  const [status, setStatus] = useState<AdminContentPostStatus>();

  const query = useQuery({
    queryKey: ["admin-content-posts", { page, keyword, status }],
    queryFn: () => fetchAdminContentPosts({ page, pageSize: PAGE_SIZE, keyword, status }),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 text-text-primary">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-700">内容管理</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">帖子管理</h1>
          <p className="mt-1 text-sm text-slate-500">查看社区帖子、媒体数量和互动数据。</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm sm:self-auto">
          <MessageSquare aria-hidden="true" className="h-4 w-4 text-blue-700" />
          <span className="text-sm font-medium text-slate-700">共 {total} 条帖子</span>
        </div>
      </section>

      <section
        aria-label="帖子筛选"
        className="rounded-xl border border-border bg-white p-4 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
      >
        <form
          className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_170px_auto]"
          onSubmit={submitSearch}
        >
          <label className="relative block">
            <span className="sr-only">搜索帖子</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              aria-label="搜索帖子"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索帖子、作者或正文"
              className="h-11 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary hover:border-brand-primary/60 focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            />
          </label>
          <label>
            <span className="sr-only">帖子状态</span>
            <select
              aria-label="帖子状态"
              value={status ?? ""}
              onChange={(event) => {
                setStatus((event.target.value || undefined) as AdminContentPostStatus | undefined);
                setPage(1);
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-border bg-white px-3 text-sm text-text-secondary outline-none transition-colors hover:border-brand-primary/60 active:bg-page-background focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            >
              <option value="">全部帖子状态</option>
              <option value="pending">待审核</option>
              <option value="published">已发布</option>
              <option value="rejected">已驳回</option>
              <option value="offline">已下架</option>
              <option value="deleted">已删除</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover active:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              查询
            </button>
            <button
              type="button"
              aria-label="重置筛选"
              onClick={resetFilters}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand-primary/60 hover:bg-page-background active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>

      <section
        aria-label="帖子列表"
        className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
      >
        {query.isPending && (
          <div aria-label="正在加载帖子" className="space-y-3 p-5">
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
            <h2 className="mt-4 font-semibold text-slate-900">帖子列表加载失败</h2>
            <p className="mt-1 text-sm text-slate-500">请检查服务端连接后重试。</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              重试
            </button>
          </div>
        )}
        {!query.isPending && !query.isError && query.data?.list.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <MessageSquare aria-hidden="true" className="h-8 w-8 text-slate-300" />
            <h2 className="mt-4 font-semibold text-slate-900">暂无帖子内容</h2>
            <p className="mt-1 text-sm text-slate-500">调整筛选条件后可以继续查看。</p>
          </div>
        )}
        {!query.isPending && !query.isError && query.data?.list.length !== 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">帖子内容</th>
                    <th className="px-5 py-3">作者</th>
                    <th className="px-5 py-3">媒体</th>
                    <th className="px-5 py-3">互动</th>
                    <th className="px-5 py-3">状态</th>
                    <th className="px-5 py-3">发布时间</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data?.list.map((post) => (
                    <PostRow key={post.id} post={post} />
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
    </div>
  );
}
