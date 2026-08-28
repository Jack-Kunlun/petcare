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
import { EditorPageLayout, FormSection } from "../../components/EditorPageLayout";
import { Badge, Button, StatePanel, Textarea } from "../../components/ui";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
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

function normalizeUserIds(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
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
  const dirty =
    Boolean(roleQuery.data) &&
    JSON.stringify([...normalizeUserIds(userIdsText)].sort()) !==
      JSON.stringify([...new Set(roleQuery.data!.userIds)].sort());
  const unsavedChanges = useUnsavedChanges(dirty);

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
      <StatePanel
        aria-label="正在加载角色详情"
        title="正在加载角色详情"
        description="正在读取权限目录和关联管理员。"
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
      <StatePanel
        role="alert"
        tone="danger"
        icon={<RefreshCw aria-hidden="true" className="h-5 w-5" />}
        title="角色详情加载失败"
        description="未能读取角色、权限目录或关联管理员。"
        action={
          <Button
            intent="dangerOutline"
            onClick={() => {
              void catalogQuery.refetch();
              void roleQuery.refetch();
              void usersQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新加载
          </Button>
        }
      />
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

    replaceUsersMutation.mutate(normalizeUserIds(userIdsText));
  }

  return (
    <EditorPageLayout
      width="wide"
      title={role.roleName}
      description={role.description ?? "未填写角色说明"}
      back={
        <Button asChild intent="ghost">
          <Link to="/rbac">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            返回角色列表
          </Link>
        </Button>
      }
      status={
        dirty ? (
          <Badge role="status" aria-live="polite" tone="warning">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            有未保存修改
          </Badge>
        ) : null
      }
      actions={
        <>
          <PermissionGate all={["rbac.role.update"]}>
            {role.isSystem ? null : (
              <Button asChild intent="secondary">
                <Link to={`/rbac/${role.id}/edit`}>
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                  编辑角色
                </Link>
              </Button>
            )}
          </PermissionGate>
          {!role.isSystem ? (
            <PermissionGate all={["rbac.assign_role"]}>
              <Button
                aria-label="顶部保存关联管理员"
                type="button"
                disabled={replaceUsersMutation.isPending}
                onClick={saveUsers}
                loading={replaceUsersMutation.isPending}
              >
                <Save aria-hidden="true" className="h-4 w-4" />
                保存关联管理员
              </Button>
            </PermissionGate>
          ) : null}
        </>
      }
      unsavedChanges={unsavedChanges}
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <FormSection title="角色元数据">
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-slate-500">角色类型</dt>
                <dd className="mt-1">
                  <Badge tone={role.isSystem ? "brand" : "neutral"}>
                    {role.isSystem ? "系统角色" : "自定义角色"}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">状态</dt>
                <dd className="mt-1">
                  <Badge tone={role.isActive ? "success" : "neutral"}>
                    {role.isActive ? "启用" : "停用"}
                  </Badge>
                </dd>
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
          </FormSection>

          <FormSection
            title="有效权限"
            description="包含由菜单和按钮权限自动派生的服务端接口权限。"
            actions={<Badge tone="info">{effectivePermissions.length} 项</Badge>}
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {effectivePermissions.map((permission) => (
                <li
                  key={permission.code}
                  className="rounded-xl border border-border bg-surface-subtle px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text-primary">{permission.label}</p>
                    <Badge tone={directPermissionCodes.has(permission.code) ? "brand" : "neutral"}>
                      {directPermissionCodes.has(permission.code) ? "直接分配" : "自动派生"}
                    </Badge>
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-text-muted">
                    {permission.code}
                  </p>
                </li>
              ))}
            </ul>
          </FormSection>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-28">
          <FormSection
            title={
              <span className="flex items-center gap-2">
                <Users aria-hidden="true" className="h-5 w-5 text-brand-primary" />
                关联管理员
              </span>
            }
            description="查看当前成员，并在有权限时批量替换关联。"
            actions={<Badge tone="info">{usersQuery.data?.length ?? 0} 位</Badge>}
          >
            <ul className="divide-y divide-border rounded-xl border border-border">
              {usersQuery.data?.length ? (
                usersQuery.data.map((user) => (
                  <li key={user.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{user.nickname}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {user.id} · @{user.username ?? "未设置账号"}
                      </p>
                    </div>
                    <Badge tone={user.status === "active" ? "success" : "neutral"}>
                      {user.status === "active" ? "启用" : user.status}
                    </Badge>
                  </li>
                ))
              ) : (
                <li className="px-4 py-5 text-sm text-slate-600">当前没有关联管理员。</li>
              )}
            </ul>
            {!role.isSystem ? (
              <PermissionGate all={["rbac.assign_role"]}>
                <div className="mt-5 border-t border-border pt-5">
                  <label className="block">
                    <span className="text-sm font-medium text-text-primary">关联管理员 ID</span>
                    <span className="mt-1 block text-xs leading-5 text-text-secondary">
                      批量替换模式：每行一个管理员 ID。保存后，未列出的现有关联会被移除。
                    </span>
                    <Textarea
                      aria-label="关联管理员 ID"
                      value={userIdsText}
                      onChange={(event) => setUserIdsText(event.target.value)}
                      rows={4}
                      className="mt-2 font-mono"
                    />
                  </label>
                  {replaceUsersMutation.isError ? (
                    <p role="alert" className="mt-3 text-sm text-red-700">
                      {isConflict(replaceUsersMutation.error)
                        ? "关联管理员已变更，请刷新后再试。"
                        : "保存关联管理员失败，请稍后重试。"}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    disabled={replaceUsersMutation.isPending}
                    onClick={saveUsers}
                    loading={replaceUsersMutation.isPending}
                    className="mt-4 w-full"
                  >
                    <Save aria-hidden="true" className="h-4 w-4" />
                    保存关联管理员
                  </Button>
                </div>
              </PermissionGate>
            ) : null}
          </FormSection>
        </aside>
      </div>
    </EditorPageLayout>
  );
}
