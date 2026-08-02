import type { RbacPermissionDefinition } from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, RefreshCw, Save, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchRbacCatalog,
  fetchRbacRole,
  fetchRbacRoleUsers,
  replaceRbacRoleUsers,
} from "../../api/rbac";
import { PermissionGate } from "../../auth/PermissionGate";
import { isConflict } from "./rbac-utils";
import { replaceRbacRoleUsersForRole } from "./role-users-utils";

/** Expands selected UI permission codes into the effective API permission set. */
function getEffectivePermissionCodes(
  permissionCodes: readonly string[],
  definitions: readonly RbacPermissionDefinition[],
): Set<string> {
  const definitionsByCode = new Map(definitions.map((definition) => [definition.code, definition]));
  const effectiveCodes = new Set(permissionCodes);
  const pending = [...permissionCodes];

  while (pending.length > 0) {
    const code = pending.pop()!;
    const definition = definitionsByCode.get(code);

    for (const impliedCode of definition?.impliedApiCodes ?? []) {
      if (!effectiveCodes.has(impliedCode)) {
        effectiveCodes.add(impliedCode);
        pending.push(impliedCode);
      }
    }
  }

  return effectiveCodes;
}

/** Shows role metadata, effective permissions, and role-to-administrator associations. */
export default function RbacDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [userIdsText, setUserIdsText] = useState("");
  const catalogQuery = useQuery({ queryKey: ["rbac-catalog"], queryFn: fetchRbacCatalog });
  const roleQuery = useQuery({
    queryKey: ["rbac-role", id],
    queryFn: () => fetchRbacRole(id!),
    enabled: Boolean(id),
  });
  const usersQuery = useQuery({
    queryKey: ["rbac-role-users", id],
    queryFn: () => fetchRbacRoleUsers(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (roleQuery.data) {
      setUserIdsText(roleQuery.data.userIds.join("\n"));
    }
  }, [roleQuery.data]);

  const effectiveCodes = useMemo(
    () =>
      roleQuery.data && catalogQuery.data
        ? getEffectivePermissionCodes(roleQuery.data.permissionCodes, catalogQuery.data.permissions)
        : new Set<string>(),
    [catalogQuery.data, roleQuery.data],
  );
  const replaceUsersMutation = useMutation({
    mutationFn: (userIds: string[]) => {
      if (!roleQuery.data) {
        return Promise.resolve(undefined);
      }

      return replaceRbacRoleUsersForRole(roleQuery.data, id!, userIds, replaceRbacRoleUsers);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rbac-role", id] });
      await queryClient.invalidateQueries({ queryKey: ["rbac-role-users", id] });
    },
  });

  if (catalogQuery.isPending || roleQuery.isPending || usersQuery.isPending) {
    return (
      <div
        aria-label="正在加载角色详情"
        className="h-96 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none"
      />
    );
  }

  if (
    catalogQuery.isError ||
    roleQuery.isError ||
    usersQuery.isError ||
    !roleQuery.data ||
    !catalogQuery.data
  ) {
    return (
      <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-950">
        <h1 className="font-bold">角色详情加载失败</h1>
        <button
          type="button"
          onClick={() => {
            void catalogQuery.refetch();
            void roleQuery.refetch();
            void usersQuery.refetch();
          }}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-700 px-4 font-semibold hover:bg-red-100"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          重新加载
        </button>
      </section>
    );
  }

  const role = roleQuery.data;
  const definitionsByCode = new Map(
    catalogQuery.data.permissions.map((permission) => [permission.code, permission]),
  );
  const effectivePermissions = [...effectiveCodes]
    .map((code) => definitionsByCode.get(code))
    .filter((permission): permission is RbacPermissionDefinition => Boolean(permission))
    .sort((left, right) => left.order - right.order || left.code.localeCompare(right.code));
  const directPermissionCodes = new Set(role.permissionCodes);

  /** Normalizes administrator IDs and replaces the role's user associations. */
  function saveUsers() {
    if (role.isSystem) {
      return;
    }

    const userIds = [
      ...new Set(
        userIdsText
          .split(/[\n,\s]+/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];

    replaceUsersMutation.mutate(userIds);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/rbac"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-800"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          返回角色列表
        </Link>
        <PermissionGate all={["rbac.role.update"]}>
          {role.isSystem ? null : (
            <Link
              to={`/rbac/${role.id}/edit`}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-700 px-4 font-semibold text-blue-800 hover:bg-blue-50"
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
              编辑角色
            </Link>
          )}
        </PermissionGate>
      </div>
      <header>
        <p className="text-sm font-medium text-blue-700">角色详情</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{role.roleName}</h1>
        <p className="mt-2 text-slate-600">{role.description ?? "未填写角色说明"}</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">角色元数据</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-slate-500">角色类型</dt>
            <dd className="mt-1 font-medium text-slate-900">
              {role.isSystem ? "系统角色" : "自定义角色"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">状态</dt>
            <dd className="mt-1 font-medium text-slate-900">{role.isActive ? "启用" : "停用"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">目录版本</dt>
            <dd className="mt-1 font-medium text-slate-900">
              目录版本：{catalogQuery.data.version}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">最后更新</dt>
            <dd className="mt-1 font-medium text-slate-900">
              {new Date(role.updatedAt).toLocaleString("zh-CN")}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">有效权限</h2>
        <p className="mt-1 text-sm text-slate-600">
          包含由菜单和按钮权限自动派生的服务端接口权限。
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {effectivePermissions.map((permission) => (
            <li key={permission.code} className="rounded-lg bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">
                {permission.label}
                {directPermissionCodes.has(permission.code) ? "" : "（自动派生）"}
              </p>
              <p className="mt-1 text-xs text-slate-500">{permission.code}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="h-5 w-5 text-blue-700" />
          <h2 className="font-semibold text-slate-950">关联管理员</h2>
        </div>
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {usersQuery.data?.length ? (
            usersQuery.data.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{user.nickname}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {user.id} · @{user.username ?? "未设置账号"}
                  </p>
                </div>
                <span className="text-sm text-slate-600">
                  {user.status === "active" ? "启用" : user.status}
                </span>
              </li>
            ))
          ) : (
            <li className="px-4 py-5 text-sm text-slate-600">当前没有关联管理员。</li>
          )}
        </ul>
        {!role.isSystem ? (
          <PermissionGate all={["rbac.assign_role"]}>
            <div className="mt-5 border-t border-slate-200 pt-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-800">关联管理员 ID</span>
                <span className="mt-1 block text-xs text-slate-500">
                  每行一个管理员 ID，保存将替换该角色的全部关联管理员。
                </span>
                <textarea
                  aria-label="关联管理员 ID"
                  value={userIdsText}
                  onChange={(event) => setUserIdsText(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                />
              </label>
              {replaceUsersMutation.isError ? (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {isConflict(replaceUsersMutation.error)
                    ? "关联管理员已变更，请刷新后再试。"
                    : "保存关联管理员失败，请稍后重试。"}
                </p>
              ) : null}
              <button
                type="button"
                disabled={replaceUsersMutation.isPending}
                onClick={saveUsers}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save aria-hidden="true" className="h-4 w-4" />
                保存关联管理员
              </button>
            </div>
          </PermissionGate>
        ) : null}
      </section>
    </div>
  );
}
