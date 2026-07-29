import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { fetchAdminUsers } from "./users.api";
import type { AdminUserListItem, AdminUserStatus, AdminUserType } from "./users.api";

const PAGE_SIZE = 20;

const statusLabels: Record<AdminUserStatus, string> = {
  active: "正常",
  inactive: "未激活",
  banned: "已封禁",
};

const statusClasses: Record<AdminUserStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  inactive: "bg-slate-100 text-slate-600 ring-slate-500/20",
  banned: "bg-red-50 text-red-700 ring-red-600/20",
};

const userTypeLabels: Record<AdminUserType, string> = {
  pet_owner: "宠物家长",
  provider: "宠托师",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function certificationLabel(user: AdminUserListItem): string {
  if (user.userType !== "provider") {
    return "不适用";
  }

  return user.provider?.certifiedSitter ? "已认证" : "待认证";
}

function StatusBadge({ status }: { status: AdminUserStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function UserIdentity({ user }: { user: AdminUserListItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 font-semibold text-blue-700">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="h-full w-full rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          user.nickname.slice(0, 1).toUpperCase()
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{user.nickname}</p>
        <p className="truncate text-xs text-slate-500">@{user.username ?? "未设置账号"}</p>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState<string>();
  const [userType, setUserType] = useState<AdminUserType>();
  const [status, setStatus] = useState<AdminUserStatus>();

  const query = useQuery({
    queryKey: ["admin-users", { page, keyword, userType, status }],
    queryFn: () =>
      fetchAdminUsers({
        page,
        pageSize: PAGE_SIZE,
        keyword,
        userType,
        status,
      }),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKeyword = keywordInput.trim() || undefined;

    setPage(1);
    setKeyword(nextKeyword);
  }

  function resetFilters() {
    setKeywordInput("");
    setKeyword(undefined);
    setUserType(undefined);
    setStatus(undefined);
    setPage(1);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-700">平台用户</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">用户管理</h1>
          <p className="mt-1 text-sm text-slate-500">查询平台用户、宠托师认证状态与账号状态。</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm sm:self-auto">
          <Users aria-hidden="true" className="h-4 w-4 text-blue-700" />
          <span className="text-sm font-medium text-slate-700">共 {total} 位用户</span>
        </div>
      </section>

      <section
        aria-label="用户筛选"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <form
          className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_160px_auto]"
          onSubmit={submitSearch}
        >
          <label className="relative block">
            <span className="sr-only">搜索用户</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              aria-label="搜索用户"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索手机号、账号或昵称"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </label>

          <label>
            <span className="sr-only">用户类型</span>
            <select
              aria-label="用户类型"
              value={userType ?? ""}
              onChange={(event) => {
                setUserType((event.target.value || undefined) as AdminUserType | undefined);
                setPage(1);
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="">全部用户类型</option>
              <option value="pet_owner">宠物家长</option>
              <option value="provider">宠托师</option>
            </select>
          </label>

          <label>
            <span className="sr-only">账号状态</span>
            <select
              aria-label="账号状态"
              value={status ?? ""}
              onChange={(event) => {
                setStatus((event.target.value || undefined) as AdminUserStatus | undefined);
                setPage(1);
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="">全部账号状态</option>
              <option value="active">正常</option>
              <option value="inactive">未激活</option>
              <option value="banned">已封禁</option>
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 lg:flex-none"
            >
              查询
            </button>
            <button
              type="button"
              aria-label="重置筛选"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              onClick={resetFilters}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>

      <section
        aria-label="用户列表"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        {query.isPending && (
          <div aria-label="正在加载用户" className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        )}
        {query.isError && (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="rounded-full bg-red-50 p-3 text-red-700">
              <AlertCircle aria-hidden="true" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">用户列表加载失败</h2>
            <p className="mt-1 text-sm text-slate-500">请检查服务端连接后重试。</p>
            <button
              type="button"
              className="mt-4 h-11 cursor-pointer rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              onClick={() => void query.refetch()}
            >
              重新加载
            </button>
          </div>
        )}
        {!query.isPending && !query.isError && query.data?.list.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="rounded-full bg-slate-100 p-3 text-slate-500">
              <UserRound aria-hidden="true" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">没有找到用户</h2>
            <p className="mt-1 text-sm text-slate-500">调整关键词或筛选条件后再试。</p>
          </div>
        )}
        {!query.isPending && !query.isError && query.data && query.data.list.length > 0 && (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">平台用户列表</caption>
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    {["用户", "手机号", "用户类型", "认证状态", "账号状态", "注册时间"].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-slate-500"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {query.data.list.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <UserIdentity user={user} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm tabular-nums text-slate-600">
                        {user.phone}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {userTypeLabels[user.userType]}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {user.userType === "provider" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <ShieldCheck
                              aria-hidden="true"
                              className={`h-4 w-4 ${user.provider?.certifiedSitter ? "text-emerald-600" : "text-amber-600"}`}
                            />
                            {user.provider?.certifiedSitter ? "已认证" : "待认证"}
                          </span>
                        ) : (
                          <span className="text-slate-400">不适用</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm tabular-nums text-slate-500">
                        {formatDate(user.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {query.data.list.map((user) => (
                <li key={user.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <UserIdentity user={user} />
                    <StatusBadge status={user.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-slate-400">手机号</dt>
                      <dd className="mt-1 tabular-nums text-slate-700">{user.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">用户类型</dt>
                      <dd className="mt-1 text-slate-700">{userTypeLabels[user.userType]}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">认证状态</dt>
                      <dd className="mt-1 text-slate-700">{certificationLabel(user)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">注册时间</dt>
                      <dd className="mt-1 tabular-nums text-slate-700">
                        {formatDate(user.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}

        {!query.isPending && !query.isError && total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              第 {page} / {totalPages} 页，每页 {PAGE_SIZE} 条
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="上一页"
                disabled={page <= 1 || query.isFetching}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="下一页"
                disabled={page >= totalPages || query.isFetching}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
