import type { RbacRoleListItem } from "@petcare/shared-types";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteRbacRole, fetchRbacRoles } from "../../api/rbac";
import { PermissionGate } from "../../auth/PermissionGate";
import { isConflict } from "./rbac-utils";

const PAGE_SIZE = 10;

/** Translates a role's system and activation flags into its status badge. */
function RoleStatus({ role }: { role: RbacRoleListItem }) {
  if (role.isSystem) {
    return (
      <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
        系统角色
      </span>
    );
  }

  return role.isActive ? (
    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
      启用
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
      停用
    </span>
  );
}

/** Lists roles and exposes role-level actions guarded by exact permissions. */
export default function Rbac() {
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<RbacRoleListItem | null>(null);
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({
    queryKey: ["rbac-roles", { page, pageSize: PAGE_SIZE }],
    queryFn: () => fetchRbacRoles({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteRbacRole,
    onSuccess: async () => {
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: ["rbac-roles"] });
    },
  });
  const total = rolesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">访问控制</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            角色管理
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            维护管理员角色及其可分配的菜单、按钮权限；接口权限由服务端目录自动派生。
          </p>
        </div>
        <PermissionGate all={["rbac.role.create"]}>
          <Link
            to="/rbac/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            新建角色
          </Link>
        </PermissionGate>
      </header>

      <section
        aria-label="角色列表"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        {rolesQuery.isPending ? (
          <div aria-label="正在加载角色" className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : null}

        {rolesQuery.isError ? (
          <div
            role="alert"
            className="flex min-h-64 flex-col items-center justify-center p-8 text-center"
          >
            <AlertCircle aria-hidden="true" className="h-8 w-8 text-red-700" />
            <h2 className="mt-3 font-semibold text-slate-950">角色列表加载失败</h2>
            <button
              type="button"
              onClick={() => void rolesQuery.refetch()}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 font-semibold hover:bg-slate-50"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              重新加载
            </button>
          </div>
        ) : null}

        {!rolesQuery.isPending && !rolesQuery.isError && rolesQuery.data?.list.length === 0 ? (
          <div className="p-10 text-center text-slate-600">暂无角色，请先创建一个角色。</div>
        ) : null}

        {!rolesQuery.isPending && !rolesQuery.isError && rolesQuery.data?.list.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">角色列表</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    角色
                  </th>
                  <th scope="col" className="px-5 py-3">
                    状态
                  </th>
                  <th scope="col" className="px-5 py-3">
                    权限
                  </th>
                  <th scope="col" className="px-5 py-3">
                    管理员
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rolesQuery.data.list.map((role) => (
                  <tr key={role.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <Link
                        to={`/rbac/${role.id}`}
                        className="font-semibold text-slate-950 hover:text-blue-800"
                      >
                        {role.roleName}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">
                        {role.description ?? "未填写说明"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <RoleStatus role={role} />
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{role.permissionCount} 项</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{role.userCount} 位</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/rbac/${role.id}`}
                          className="inline-flex min-h-10 items-center rounded-lg px-3 font-medium text-slate-700 hover:bg-slate-100"
                        >
                          查看
                        </Link>
                        <PermissionGate all={["rbac.role.update"]}>
                          {role.isSystem ? (
                            <span className="inline-flex min-h-10 items-center px-3 text-sm text-slate-500">
                              系统角色只读
                            </span>
                          ) : (
                            <Link
                              aria-label={`编辑 ${role.roleName}`}
                              to={`/rbac/${role.id}/edit`}
                              className="inline-flex min-h-10 items-center rounded-lg px-3 font-medium text-blue-800 hover:bg-blue-50"
                            >
                              编辑
                            </Link>
                          )}
                        </PermissionGate>
                        <PermissionGate all={["rbac.role.delete"]}>
                          {!role.isSystem ? (
                            <button
                              type="button"
                              aria-label={`删除 ${role.roleName}`}
                              onClick={() => setPendingDelete(role)}
                              className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 font-medium text-red-700 hover:bg-red-50"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                              删除
                            </button>
                          ) : null}
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!rolesQuery.isPending && !rolesQuery.isError && total > 0 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <p className="text-sm text-slate-600">
              第 {page} / {totalPages} 页，每页 {PAGE_SIZE} 条
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="上一页"
                disabled={page <= 1 || rolesQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="下一页"
                disabled={page >= totalPages || rolesQuery.isFetching}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {pendingDelete ? (
        <div
          role="alertdialog"
          aria-label="删除角色确认"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-950">删除角色</h2>
            <p className="mt-2 text-slate-600">
              确认删除“{pendingDelete.roleName}”吗？此操作无法撤销。
            </p>
            {deleteMutation.isError ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {isConflict(deleteMutation.error)
                  ? "角色仍关联管理员或已被更新，无法删除。"
                  : "删除失败，请稍后重试。"}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="min-h-11 rounded-lg px-4 font-semibold text-slate-700 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(pendingDelete.id)}
                className="min-h-11 rounded-lg bg-red-700 px-4 font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
