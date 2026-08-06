import type {
  AdminOrderListItem,
  AdminOrderStatus,
  AdminOrderType,
  AdminServiceType,
} from "@petcare/shared-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  PawPrint,
  RotateCcw,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { fetchAdminOrders } from "../../api/orders";

const PAGE_SIZE = 20;

const orderTypeLabels: Record<AdminOrderType, string> = {
  reward: "悬赏订单",
  platform: "平台订单",
};

const serviceTypeLabels: Record<AdminServiceType, string> = {
  feeding: "上门喂养",
  walking: "遛宠陪伴",
  playing: "互动陪玩",
};

const statusLabels: Record<AdminOrderStatus, string> = {
  pending_confirm: "待确认",
  confirmed: "已确认",
  in_progress: "服务中",
  completed: "已完成",
  cancelled: "已取消",
};

const statusClasses: Record<AdminOrderStatus, string> = {
  pending_confirm: "bg-amber-50 text-amber-700 ring-amber-600/20",
  confirmed: "bg-blue-50 text-blue-700 ring-blue-600/20",
  in_progress: "bg-violet-50 text-violet-700 ring-violet-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

/** 将以元为单位的订单金额格式化为人民币文本。 */
function formatMoney(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  })
    .format(value)
    .replace("CN¥", "¥");
}

/** 将 ISO 时间格式化为后台列表使用的本地日期时间。 */
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

/** 缩短过长的订单号，同时保留首尾以便人工识别。 */
function shortOrderId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function StatusBadge({ status }: { status: AdminOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function OrderParties({ order }: { order: AdminOrderListItem }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-slate-900">{order.owner.nickname}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
        <PawPrint aria-hidden="true" className="h-3.5 w-3.5 text-blue-600" />
        <span className="truncate">
          {order.pet.name} · {order.pet.breed}
        </span>
      </p>
    </div>
  );
}

export default function OrderManagement() {
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState<string>();
  const [orderType, setOrderType] = useState<AdminOrderType>();
  const [serviceType, setServiceType] = useState<AdminServiceType>();
  const [status, setStatus] = useState<AdminOrderStatus>();

  const query = useQuery({
    queryKey: ["admin-orders", { page, keyword, orderType, serviceType, status }],
    queryFn: () =>
      fetchAdminOrders({
        page,
        pageSize: PAGE_SIZE,
        keyword,
        orderType,
        serviceType,
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
    setOrderType(undefined);
    setServiceType(undefined);
    setStatus(undefined);
    setPage(1);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 text-text-primary">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-700">交易履约</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">订单管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            监控悬赏与平台订单，跟进服务进度和异常状态。
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm sm:self-auto">
          <ShoppingBag aria-hidden="true" className="h-4 w-4 text-blue-700" />
          <span className="text-sm font-medium text-slate-700">共 {total} 笔订单</span>
        </div>
      </section>

      <section
        aria-label="订单筛选"
        className="rounded-xl border border-border bg-white p-4 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
      >
        <form
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_150px_150px_150px_auto]"
          onSubmit={submitSearch}
        >
          <label className="relative block">
            <span className="sr-only">搜索订单</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              aria-label="搜索订单"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索订单号、手机号、用户或宠物"
              className="h-11 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary hover:border-brand-primary/60 focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            />
          </label>

          <label>
            <span className="sr-only">订单类型</span>
            <select
              aria-label="订单类型"
              value={orderType ?? ""}
              onChange={(event) => {
                setOrderType((event.target.value || undefined) as AdminOrderType | undefined);
                setPage(1);
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-border bg-white px-3 text-sm text-text-secondary outline-none transition-colors hover:border-brand-primary/60 active:bg-page-background focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            >
              <option value="">全部订单类型</option>
              <option value="reward">悬赏订单</option>
              <option value="platform">平台订单</option>
            </select>
          </label>

          <label>
            <span className="sr-only">服务类型</span>
            <select
              aria-label="服务类型"
              value={serviceType ?? ""}
              onChange={(event) => {
                setServiceType((event.target.value || undefined) as AdminServiceType | undefined);
                setPage(1);
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-border bg-white px-3 text-sm text-text-secondary outline-none transition-colors hover:border-brand-primary/60 active:bg-page-background focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            >
              <option value="">全部服务类型</option>
              <option value="feeding">上门喂养</option>
              <option value="walking">遛宠陪伴</option>
              <option value="playing">互动陪玩</option>
            </select>
          </label>

          <label>
            <span className="sr-only">订单状态</span>
            <select
              aria-label="订单状态"
              value={status ?? ""}
              onChange={(event) => {
                setStatus((event.target.value || undefined) as AdminOrderStatus | undefined);
                setPage(1);
              }}
              className="h-11 w-full cursor-pointer rounded-lg border border-border bg-white px-3 text-sm text-text-secondary outline-none transition-colors hover:border-brand-primary/60 active:bg-page-background focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20"
            >
              <option value="">全部订单状态</option>
              <option value="pending_confirm">待确认</option>
              <option value="confirmed">已确认</option>
              <option value="in_progress">服务中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </label>

          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button
              type="submit"
              className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover active:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 xl:flex-none"
            >
              查询
            </button>
            <button
              type="button"
              aria-label="重置筛选"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand-primary/60 hover:bg-page-background hover:text-text-primary active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              onClick={resetFilters}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>

      <section
        aria-label="订单列表"
        className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
      >
        {query.isPending && (
          <div aria-label="正在加载订单" className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="h-16 rounded-lg bg-slate-100 animate-[pc-skeleton-shimmer_220ms_linear_infinite] motion-reduce:animate-none"
              />
            ))}
          </div>
        )}

        {query.isError && (
          <div
            role="alert"
            className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center"
          >
            <span className="rounded-full bg-red-50 p-3 text-red-700">
              <AlertCircle aria-hidden="true" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">订单列表加载失败</h2>
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
              <ShoppingBag aria-hidden="true" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">没有找到订单</h2>
            <p className="mt-1 text-sm text-slate-500">调整关键词或筛选条件后再试。</p>
          </div>
        )}

        {!query.isPending && !query.isError && query.data && query.data.list.length > 0 && (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">平台订单列表</caption>
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    {[
                      "订单号",
                      "下单用户 / 宠物",
                      "服务",
                      "服务时间",
                      "金额",
                      "服务者",
                      "状态",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {query.data.list.map((order) => (
                    <tr
                      key={order.id}
                      className="border-border transition-[background-color,border-color] duration-200 hover:bg-page-background hover:border-border"
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        <p
                          title={order.id}
                          className="font-mono text-xs font-medium text-slate-700"
                        >
                          {shortOrderId(order.id)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {orderTypeLabels[order.orderType]}
                        </p>
                      </td>
                      <td className="max-w-56 px-5 py-4">
                        <OrderParties order={order} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {serviceTypeLabels[order.serviceType]}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm tabular-nums text-slate-600">
                        {formatDateTime(order.serviceTime)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold tabular-nums text-slate-900">
                        {formatMoney(order.amount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {order.provider?.nickname ?? "待分配"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 lg:hidden">
              {query.data.list.map((order) => (
                <li key={order.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p title={order.id} className="font-mono text-xs font-medium text-slate-700">
                        {shortOrderId(order.id)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {orderTypeLabels[order.orderType]}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <OrderParties order={order} />
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-slate-400">服务内容</dt>
                      <dd className="mt-1 text-slate-700">
                        {serviceTypeLabels[order.serviceType]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">订单金额</dt>
                      <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                        {formatMoney(order.amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1 text-slate-400">
                        <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
                        服务时间
                      </dt>
                      <dd className="mt-1 tabular-nums text-slate-700">
                        {formatDateTime(order.serviceTime)}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1 text-slate-400">
                        <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                        服务者
                      </dt>
                      <dd className="mt-1 text-slate-700">
                        {order.provider?.nickname ?? "待分配"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}

        {!query.isPending && !query.isError && total > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              第 {page} / {totalPages} 页，每页 {PAGE_SIZE} 条
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="上一页"
                disabled={page <= 1 || query.isFetching}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand-primary/60 hover:bg-page-background active:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="下一页"
                disabled={page >= totalPages || query.isFetching}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:border-brand-primary/60 hover:bg-page-background active:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
