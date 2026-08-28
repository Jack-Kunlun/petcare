import type { AdminUserListItem, AdminUserStatus } from "@petcare/shared-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, RotateCcw, UserRound, Users } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { fetchAdminUsers } from "../../api/users";
import {
  Badge,
  Button,
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
} from "../../components/ui";

const PAGE_SIZE = 20;

const statusLabels: Record<AdminUserStatus, string> = {
  active: "正常",
  inactive: "未激活",
  banned: "已封禁",
};

const statusTones: Record<AdminUserStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  banned: "danger",
};

/** 将 ISO 时间格式化为用户列表使用的本地日期。 */
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: AdminUserStatus }) {
  return <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>;
}

function UserIdentity({ user }: { user: AdminUserListItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand-primary">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          user.nickname.slice(0, 1).toUpperCase()
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-text-primary">{user.nickname}</p>
        <p className="truncate text-xs text-text-secondary">@{user.username ?? "未设置账号"}</p>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState<string>();
  const [status, setStatus] = useState<AdminUserStatus>();

  const query = useQuery({
    queryKey: ["admin-users", { page, keyword, status }],
    queryFn: () =>
      fetchAdminUsers({
        page,
        pageSize: PAGE_SIZE,
        keyword,
        userType: undefined,
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
    setStatus(undefined);
    setPage(1);
  }

  return (
    <PageShell>
      <PageHeader
        actions={
          <Badge className="h-9 px-3" tone="brand">
            <Users aria-hidden="true" className="h-4 w-4" />共 {total} 位用户
          </Badge>
        }
        description="查询当前账户资料与账号状态。"
        eyebrow="账户资料"
        title="用户资料"
      />

      <FilterBar
        aria-label="用户筛选"
        className="lg:grid-cols-[minmax(260px,1fr)_160px_auto]"
        onSubmit={submitSearch}
      >
        <SearchInput
          aria-label="搜索用户"
          className="h-10"
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="搜索手机号、账号或昵称"
          value={keywordInput}
        />

        <Select
          aria-label="账号状态"
          onChange={(event) => {
            setStatus((event.target.value || undefined) as AdminUserStatus | undefined);
            setPage(1);
          }}
          value={status ?? ""}
        >
          <option value="">全部账号状态</option>
          <option value="active">正常</option>
          <option value="inactive">未激活</option>
          <option value="banned">已封禁</option>
        </Select>

        <div className="flex gap-2">
          <Button className="flex-1 lg:flex-none" type="submit">
            查询
          </Button>
          <Button aria-label="重置筛选" intent="secondary" onClick={resetFilters} size="icon">
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </FilterBar>

      <DataPanel aria-label="用户列表">
        {query.isPending && <ListSkeleton label="正在加载用户" />}
        {query.isError && (
          <StatePanel
            action={
              <Button intent="secondary" onClick={() => void query.refetch()}>
                重新加载
              </Button>
            }
            description="请检查服务端连接后重试。"
            icon={<AlertCircle aria-hidden="true" className="h-6 w-6" />}
            title="用户列表加载失败"
            tone="danger"
          />
        )}
        {!query.isPending && !query.isError && query.data?.list.length === 0 && (
          <StatePanel
            description="调整关键词或筛选条件后再试。"
            icon={<UserRound aria-hidden="true" className="h-6 w-6" />}
            title="没有找到用户"
          />
        )}
        {!query.isPending && !query.isError && query.data && query.data.list.length > 0 && (
          <>
            <div className="hidden md:block">
              <DataTable>
                <caption className="sr-only">用户资料列表</caption>
                <DataTableHead>
                  <tr>
                    {["用户", "手机号", "账号状态", "注册时间"].map((heading) => (
                      <DataTableHeadCell key={heading}>{heading}</DataTableHeadCell>
                    ))}
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {query.data.list.map((user) => (
                    <DataTableRow key={user.id}>
                      <DataTableCell>
                        <UserIdentity user={user} />
                      </DataTableCell>
                      <DataTableCell className="whitespace-nowrap tabular-nums text-text-secondary">
                        {user.phone}
                      </DataTableCell>
                      <DataTableCell className="whitespace-nowrap">
                        <StatusBadge status={user.status} />
                      </DataTableCell>
                      <DataTableCell className="whitespace-nowrap tabular-nums text-text-secondary">
                        {formatDate(user.createdAt)}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {query.data.list.map((user) => (
                <li key={user.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <UserIdentity user={user} />
                    <StatusBadge status={user.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-text-muted">手机号</dt>
                      <dd className="mt-1 tabular-nums text-text-primary">{user.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">注册时间</dt>
                      <dd className="mt-1 tabular-nums text-text-primary">
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
          <Pagination
            disabled={query.isFetching}
            itemLabel="位用户"
            onPageChange={setPage}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            totalPages={totalPages}
          />
        ) : null}
      </DataPanel>
    </PageShell>
  );
}
