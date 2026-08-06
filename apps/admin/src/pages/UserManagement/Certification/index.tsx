import type {
  ProviderCertificationStatus,
  AdminProviderCertificationListItem,
} from "@petcare/shared-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { fetchAdminProviderCertifications } from "../../../api/provider-certifications";

const PAGE_SIZE = 20;

const statusLabels: Record<ProviderCertificationStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已驳回",
};

const statusClasses: Record<ProviderCertificationStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
};

/** 将 ISO 时间格式化为审核列表使用的本地日期时间。 */
function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function CertificationStatus({ status }: { status: ProviderCertificationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function VerificationSummary({ application }: { application: AdminProviderCertificationListItem }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="inline-flex items-center gap-1 text-slate-600">
        <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-blue-700" />
        {application.idCardVerified ? "实名资料已提交" : "实名资料缺失"}
      </span>
      <span className="inline-flex items-center gap-1 text-slate-600">
        <BadgeCheck
          aria-hidden="true"
          className={`h-3.5 w-3.5 ${application.trainingPassed ? "text-emerald-600" : "text-amber-600"}`}
        />
        {application.trainingPassed ? "培训已通过" : "培训未通过"}
      </span>
    </div>
  );
}

export default function ProviderCertificationList() {
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState<string>();
  const [status, setStatus] = useState<ProviderCertificationStatus | undefined>("pending");
  const query = useQuery({
    queryKey: ["admin-provider-certifications", { page, keyword, status }],
    queryFn: () =>
      fetchAdminProviderCertifications({
        page,
        pageSize: PAGE_SIZE,
        keyword,
        status,
      }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setKeyword(keywordInput.trim() || undefined);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 text-text-primary">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-700">准入审核</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">认证审核</h1>
          <p className="mt-1 text-sm text-slate-500">
            审核宠托师实名、培训和信用资料，确保服务供给质量。
          </p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
          当前筛选共 {total} 条
        </p>
      </section>

      <section
        aria-label="认证申请筛选"
        className="rounded-xl border border-border bg-white p-4 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
      >
        <form
          className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_180px_auto]"
          onSubmit={submitSearch}
        >
          <label className="relative">
            <span className="sr-only">搜索认证申请</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              aria-label="搜索认证申请"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索手机号、账号或昵称"
              className="h-11 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-text-primary outline-none transition-colors hover:border-brand-primary/60 focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            />
          </label>
          <label>
            <span className="sr-only">审核状态</span>
            <select
              aria-label="审核状态"
              value={status ?? ""}
              onChange={(event) => {
                setStatus(
                  (event.target.value || undefined) as ProviderCertificationStatus | undefined,
                );
                setPage(1);
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-border bg-white px-3 text-sm text-text-secondary outline-none transition-colors hover:border-brand-primary/60 active:bg-page-background focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            >
              <option value="">全部状态</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已驳回</option>
            </select>
          </label>
          <button
            type="submit"
            className="h-11 cursor-pointer rounded-lg bg-brand-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover active:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            查询
          </button>
        </form>
      </section>

      <section
        aria-label="认证申请列表"
        className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
      >
        {query.isPending ? (
          <div aria-label="正在加载认证申请" className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="h-16 rounded-lg bg-slate-100 animate-[pc-skeleton-shimmer_220ms_linear_infinite] motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : null}

        {query.isError ? (
          <div role="alert" className="flex min-h-64 flex-col items-center justify-center p-8">
            <AlertCircle aria-hidden="true" className="h-7 w-7 text-red-600" />
            <p className="mt-3 font-semibold text-slate-900">认证申请加载失败</p>
            <button
              type="button"
              className="mt-4 h-11 cursor-pointer rounded-lg border border-slate-300 px-4 text-sm"
              onClick={() => void query.refetch()}
            >
              重新加载
            </button>
          </div>
        ) : null}

        {!query.isPending && !query.isError && query.data?.list.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <ShieldCheck aria-hidden="true" className="h-8 w-8 text-slate-400" />
            <p className="mt-3 font-semibold text-slate-900">没有符合条件的认证申请</p>
            <p className="mt-1 text-sm text-slate-500">调整关键词或审核状态后再试。</p>
          </div>
        ) : null}

        {query.data && query.data.list.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {query.data.list.map((application) => (
              <li
                key={application.id}
                className="flex flex-col gap-4 border-border p-5 transition-[background-color,border-color] duration-200 hover:bg-page-background hover:border-border md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{application.applicant.nickname}</p>
                    <CertificationStatus status={application.status} />
                  </div>
                  <p className="mt-1 text-sm tabular-nums text-slate-500">
                    {application.applicant.phone} · {application.realNameMasked}
                  </p>
                  <div className="mt-2">
                    <VerificationSummary application={application} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 md:justify-end">
                  <div className="text-right text-xs text-slate-500">
                    <p>申请时间</p>
                    <p className="mt-1 tabular-nums">{formatDateTime(application.createdAt)}</p>
                  </div>
                  <Link
                    to={`/users/certifications/${application.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    查看详情
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {!query.isPending && !query.isError && total > 0 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <p className="text-xs text-slate-500">
              第 {page} / {totalPages} 页
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="上一页"
                disabled={page <= 1 || query.isFetching}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="下一页"
                disabled={page >= totalPages || query.isFetching}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
