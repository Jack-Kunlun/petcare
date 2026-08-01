import {
  type AdminComplaintListItem,
  type AdminComplaintListQuery,
  type AdminComplaintQueue,
  type ComplaintStatus,
} from "@petcare/shared-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClockAlert,
  Inbox,
  RotateCcw,
  Search,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchAdminComplaints } from "../../../api/complaints";
import { OrderManagementNavigation } from "../Navigation";

const PAGE_SIZE = 20;
const STAGE_OVERDUE_MILLISECONDS = 24 * 60 * 60 * 1000;

const queueTabs: ReadonlyArray<{ value: AdminComplaintQueue; label: string }> = [
  { value: "mine", label: "待我处理" },
  { value: "unassigned", label: "待认领" },
  { value: "pending_response", label: "待回应" },
  { value: "processing_initial", label: "待初裁" },
  { value: "initial_decided", label: "申诉期内" },
  { value: "processing_final", label: "待终裁" },
  { value: "execution_failed", label: "执行异常" },
  { value: "closed", label: "已结案" },
];

const statusLabels: Record<ComplaintStatus, string> = {
  pending_response: "待回应",
  unassigned: "待认领",
  processing_initial: "初审中",
  initial_decided: "申诉期内",
  processing_final: "终审中",
  closed: "已结案",
  withdrawn: "已撤回",
};

const statusClasses: Record<ComplaintStatus, string> = {
  pending_response:
    "inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20",
  unassigned:
    "inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-500/20",
  processing_initial:
    "inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-600/20",
  initial_decided:
    "inline-flex items-center rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-600/20",
  processing_final:
    "inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800 ring-1 ring-inset ring-indigo-600/20",
  closed:
    "inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20",
  withdrawn:
    "inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20",
};

const complaintTypeLabels: Record<string, string> = {
  service_quality: "服务质量",
  service_attitude: "服务态度",
  payment_dispute: "费用争议",
  safety_incident: "安全事件",
};

function isQueue(value: string | null): value is AdminComplaintQueue {
  return queueTabs.some((queue) => queue.value === value);
}

function isStatus(value: string | null): value is ComplaintStatus {
  return value !== null && Object.keys(statusLabels).includes(value);
}

function normalizedPage(value: string | null): number {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function optionalTrimmed(value: string | null): string | undefined {
  return value?.trim() || undefined;
}

function formatStageDuration(updatedAt: string, now = Date.now()): string {
  const milliseconds = Math.max(0, now - new Date(updatedAt).getTime());
  const hours = Math.floor(milliseconds / (60 * 60 * 1000));

  if (hours >= 48) {
    return `停留 ${Math.floor(hours / 24)} 天`;
  }

  if (hours >= 1) {
    return `停留 ${hours} 小时`;
  }

  return `停留 ${Math.max(1, Math.floor(milliseconds / (60 * 1000)))} 分钟`;
}

function formatAppealCountdown(deadline: string | null, now = Date.now()): string {
  if (!deadline) {
    return "无申诉倒计时";
  }

  const remaining = new Date(deadline).getTime() - now;

  if (remaining <= 0) {
    return "申诉期已结束";
  }

  const hours = Math.ceil(remaining / (60 * 60 * 1000));

  return hours >= 48 ? `申诉剩余 ${Math.ceil(hours / 24)} 天` : `申诉剩余 ${hours} 小时`;
}

function isStageOverdue(item: AdminComplaintListItem, now = Date.now()): boolean {
  return (
    item.status !== "closed" &&
    item.status !== "withdrawn" &&
    now - new Date(item.updatedAt).getTime() >= STAGE_OVERDUE_MILLISECONDS
  );
}

function StatusBadge({ status }: { status: ComplaintStatus }) {
  return <span className={statusClasses[status]}>{statusLabels[status]}</span>;
}

function AttentionMarkers({ item }: { item: AdminComplaintListItem }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {isStageOverdue(item) && (
        <span
          aria-label="超时提醒"
          className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20"
        >
          <ClockAlert aria-hidden="true" className="h-4 w-4" />
          阶段已超时
        </span>
      )}
      {item.hasFailedExecution && (
        <span
          aria-label="执行异常提醒"
          className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-600/20"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          执行异常
        </span>
      )}
    </div>
  );
}

function Parties({ item }: { item: AdminComplaintListItem }) {
  return (
    <div className="min-w-0 text-sm">
      <p className="truncate font-medium text-slate-900">
        {item.complainant.nickname} <span className="text-slate-400">诉</span>{" "}
        {item.respondent.nickname}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">
        {item.complainant.phone} / {item.respondent.phone}
      </p>
    </div>
  );
}

export default function ComplaintWorkQueue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queueValue = searchParams.get("queue");
  const queue = isQueue(queueValue) ? queueValue : "mine";
  const page = normalizedPage(searchParams.get("page"));
  const keyword = optionalTrimmed(searchParams.get("keyword"));
  const statusValue = searchParams.get("status");
  const status = isStatus(statusValue) ? statusValue : undefined;
  const handlerId = optionalTrimmed(searchParams.get("handlerId"));
  const [keywordInput, setKeywordInput] = useState(keyword ?? "");
  const [handlerInput, setHandlerInput] = useState(handlerId ?? "");

  const normalizedQuery = useMemo<AdminComplaintListQuery>(
    () => ({ queue, page, pageSize: PAGE_SIZE, keyword, status, handlerId }),
    [handlerId, keyword, page, queue, status],
  );

  const query = useQuery({
    queryKey: ["admin-complaints", normalizedQuery],
    queryFn: () => fetchAdminComplaints(normalizedQuery),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function updateSearch(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([name, value]) => {
      if (value) {
        next.set(name, value);
      } else {
        next.delete(name);
      }
    });
    setSearchParams(next);
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSearch({
      keyword: keywordInput.trim() || undefined,
      handlerId: handlerInput.trim() || undefined,
      page: "1",
    });
  }

  function resetFilters() {
    setKeywordInput("");
    setHandlerInput("");
    updateSearch({ keyword: undefined, status: undefined, handlerId: undefined, page: "1" });
  }

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-6">
      <OrderManagementNavigation />

      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-700">投诉与纠纷</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">投诉工作队列</h1>
          <p className="mt-1 text-sm text-slate-500">
            按处理阶段集中跟进案件，及时发现超时与裁决执行异常。
          </p>
        </div>
        <div className="flex min-h-11 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm sm:self-auto">
          <Inbox aria-hidden="true" className="h-4 w-4 text-blue-700" />共 {total} 个案件
        </div>
      </section>

      <section
        aria-label="投诉工作队列"
        className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {queueTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={queue === tab.value}
              className={
                queue === tab.value
                  ? "min-h-11 cursor-pointer rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  : "min-h-11 cursor-pointer rounded-lg px-3 text-sm font-medium text-slate-600 outline-none transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              }
              onClick={() => updateSearch({ queue: tab.value, page: "1" })}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section
        aria-label="投诉筛选"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={submitFilters}>
          <label className="relative block xl:col-span-2">
            <span className="sr-only">搜索案件</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400"
            />
            <input
              type="search"
              aria-label="搜索案件"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索案件编号、订单号或当事人"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </label>

          <label>
            <span className="sr-only">案件状态</span>
            <select
              aria-label="案件状态"
              value={status ?? ""}
              onChange={(event) =>
                updateSearch({ status: event.target.value || undefined, page: "1" })
              }
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            >
              <option value="">全部状态</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">负责人标识</span>
            <input
              type="search"
              aria-label="负责人标识"
              value={handlerInput}
              onChange={(event) => setHandlerInput(event.target.value)}
              placeholder="负责人 ID"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
          </label>

          <div className="flex gap-2 md:col-span-2 xl:col-span-4 xl:justify-end">
            <button
              type="submit"
              className="h-11 flex-1 cursor-pointer rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 xl:flex-none"
            >
              应用筛选
            </button>
            <button
              type="button"
              aria-label="重置筛选"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 outline-none transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600"
              onClick={resetFilters}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>

      <section
        aria-label="投诉工作队列结果"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        {query.isPending && (
          <div aria-label="正在加载投诉工作队列" className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-100" />
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
            <h2 className="mt-4 font-semibold text-slate-900">投诉工作队列加载失败</h2>
            <p className="mt-1 text-sm text-slate-500">请检查服务连接后重新加载。</p>
            <button
              type="button"
              className="mt-4 h-11 cursor-pointer rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
              onClick={() => void query.refetch()}
            >
              重新加载
            </button>
          </div>
        )}

        {!query.isPending && !query.isError && query.data?.list.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="rounded-full bg-slate-100 p-3 text-slate-500">
              <Inbox aria-hidden="true" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">暂无待处理案件</h2>
            <p className="mt-1 text-sm text-slate-500">可切换队列或调整筛选条件查看其他案件。</p>
          </div>
        )}

        {!query.isPending && !query.isError && query.data && query.data.list.length > 0 && (
          <>
            <div className="hidden lg:block">
              <table
                aria-label="投诉纠纷工作队列表格"
                className="w-full table-fixed border-collapse text-left"
              >
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {[
                      "案件 / 订单",
                      "类型与状态",
                      "双方当事人",
                      "负责人",
                      "阶段时长 / 申诉",
                      "操作",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-4 py-3 text-xs font-semibold text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {query.data.list.map((item) => (
                    <tr key={item.id} className="align-top transition-colors hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p
                          className="truncate font-mono text-xs font-semibold text-slate-800"
                          title={item.caseNumber}
                        >
                          {item.caseNumber}
                        </p>
                        <p
                          className="mt-1 truncate font-mono text-xs text-slate-500"
                          title={item.orderId}
                        >
                          {item.orderId}
                        </p>
                        <AttentionMarkers item={item} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        <p>{complaintTypeLabels[item.complaintType] ?? item.complaintType}</p>
                        <div className="mt-2">
                          <StatusBadge status={item.status} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Parties item={item} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {item.handler?.nickname ?? "待认领"}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-600">
                        <p className="flex items-center gap-1">
                          <Clock3 aria-hidden="true" className="h-4 w-4" />
                          {formatStageDuration(item.updatedAt)}
                        </p>
                        <p className="mt-2">{formatAppealCountdown(item.appealDeadlineAt)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          to={`/orders/complaints/${item.id}`}
                          aria-label={`查看案件 ${item.caseNumber}`}
                          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul aria-label="投诉纠纷工作队列卡片" className="divide-y divide-slate-100 lg:hidden">
              {query.data.list.map((item) => (
                <li key={item.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-slate-800">
                        {item.caseNumber}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-slate-500">
                        {item.orderId}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <AttentionMarkers item={item} />
                  <Parties item={item} />
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-slate-500">投诉类型</dt>
                      <dd className="mt-1 text-slate-800">
                        {complaintTypeLabels[item.complaintType] ?? item.complaintType}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">负责人</dt>
                      <dd className="mt-1 text-slate-800">{item.handler?.nickname ?? "待认领"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">阶段时长</dt>
                      <dd className="mt-1 text-slate-800">{formatStageDuration(item.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">申诉倒计时</dt>
                      <dd className="mt-1 text-slate-800">
                        {formatAppealCountdown(item.appealDeadlineAt)}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    to={`/orders/complaints/${item.id}`}
                    aria-label={`查看案件 ${item.caseNumber}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    查看详情
                  </Link>
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
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 outline-none transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-600"
                onClick={() => updateSearch({ page: String(Math.max(1, page - 1)) })}
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="下一页"
                disabled={page >= totalPages || query.isFetching}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 outline-none transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-600"
                onClick={() => updateSearch({ page: String(Math.min(totalPages, page + 1)) })}
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
