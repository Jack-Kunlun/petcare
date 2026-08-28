import type { RbacRoleListItem } from "@petcare/shared-types";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteRbacRole, fetchRbacRoles } from "../../api/rbac";
import { PermissionGate } from "../../auth/PermissionGate";
import {
  Badge,
  Button,
  ConfirmDialog,
  DataPanel,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableRow,
  ListSkeleton,
  PageHeader,
  PageShell,
  Pagination,
  StatePanel,
} from "../../components/ui";
import { isConflict } from "./rbac-utils";

const PAGE_SIZE = 10;

/** Translates a role's system and activation flags into its status badge. */
function RoleStatus({ role }: { role: RbacRoleListItem }) {
  if (role.isSystem) {
    return <Badge tone="brand">系统角色</Badge>;
  }

  return role.isActive ? <Badge tone="success">启用</Badge> : <Badge tone="neutral">停用</Badge>;
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
    <PageShell>
      <PageHeader
        actions={
          <PermissionGate all={["rbac.role.create"]}>
            <Button asChild>
              <Link to="/rbac/new">
                <Plus aria-hidden="true" className="h-4 w-4" />
                新建角色
              </Link>
            </Button>
          </PermissionGate>
        }
        description="维护管理员角色及其可分配的菜单、按钮权限；接口权限由服务端目录自动派生。"
        eyebrow="访问控制"
        meta={
          <Badge tone="brand">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />共 {total} 个角色
          </Badge>
        }
        title="角色管理"
      />

      <DataPanel aria-label="角色列表">
        {rolesQuery.isPending ? <ListSkeleton label="正在加载角色" /> : null}

        {rolesQuery.isError ? (
          <StatePanel
            action={
              <Button intent="secondary" onClick={() => void rolesQuery.refetch()}>
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                重新加载
              </Button>
            }
            description="请检查服务端连接后重试。"
            icon={<AlertCircle aria-hidden="true" className="h-6 w-6" />}
            title="角色列表加载失败"
            tone="danger"
          />
        ) : null}

        {!rolesQuery.isPending && !rolesQuery.isError && rolesQuery.data?.list.length === 0 ? (
          <StatePanel
            description="创建角色后，可为管理员分配对应的菜单和按钮权限。"
            icon={<ShieldCheck aria-hidden="true" className="h-6 w-6" />}
            title="暂无角色"
          />
        ) : null}

        {!rolesQuery.isPending && !rolesQuery.isError && rolesQuery.data?.list.length ? (
          <DataTable minWidthClassName="min-w-[760px]">
            <caption className="sr-only">角色列表</caption>
            <DataTableHead>
              <tr>
                <DataTableHeadCell>角色</DataTableHeadCell>
                <DataTableHeadCell>状态</DataTableHeadCell>
                <DataTableHeadCell>权限</DataTableHeadCell>
                <DataTableHeadCell>管理员</DataTableHeadCell>
                <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {rolesQuery.data.list.map((role) => (
                <DataTableRow key={role.id}>
                  <DataTableCell>
                    <Link
                      to={`/rbac/${role.id}`}
                      className="cursor-pointer rounded-sm font-semibold text-text-primary transition-colors hover:text-brand-primary active:text-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      {role.roleName}
                    </Link>
                    <p className="mt-1 text-sm text-text-secondary">
                      {role.description ?? "未填写说明"}
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    <RoleStatus role={role} />
                  </DataTableCell>
                  <DataTableCell className="text-text-secondary">
                    {role.permissionCount} 项
                  </DataTableCell>
                  <DataTableCell className="text-text-secondary">{role.userCount} 位</DataTableCell>
                  <DataTableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild intent="ghost" size="sm">
                        <Link to={`/rbac/${role.id}`}>查看</Link>
                      </Button>
                      <PermissionGate all={["rbac.role.update"]}>
                        {role.isSystem ? (
                          <span className="inline-flex min-h-9 items-center px-3 text-sm text-text-muted">
                            系统角色只读
                          </span>
                        ) : (
                          <Button asChild intent="ghost" size="sm">
                            <Link aria-label={`编辑 ${role.roleName}`} to={`/rbac/${role.id}/edit`}>
                              编辑
                            </Link>
                          </Button>
                        )}
                      </PermissionGate>
                      <PermissionGate all={["rbac.role.delete"]}>
                        {!role.isSystem ? (
                          <Button
                            aria-label={`删除 ${role.roleName}`}
                            intent="dangerOutline"
                            onClick={() => setPendingDelete(role)}
                            size="sm"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                            删除
                          </Button>
                        ) : null}
                      </PermissionGate>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        ) : null}

        {!rolesQuery.isPending && !rolesQuery.isError && total > 0 ? (
          <Pagination
            disabled={rolesQuery.isFetching}
            itemLabel="个角色"
            onPageChange={setPage}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            totalPages={totalPages}
          />
        ) : null}
      </DataPanel>

      {pendingDelete ? (
        <ConfirmDialog
          confirmLabel={deleteMutation.isPending ? "正在删除…" : "确认删除"}
          confirmTone="danger"
          description={`确认删除“${pendingDelete.roleName}”吗？此操作无法撤销。`}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onOpenChange={(open) => {
            if (!open && !deleteMutation.isPending) {
              setPendingDelete(null);
            }
          }}
          open
          pending={deleteMutation.isPending}
          title="删除角色"
        >
          {deleteMutation.isError ? (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {isConflict(deleteMutation.error)
                ? "角色仍关联管理员或已被更新，无法删除。"
                : "删除失败，请稍后重试。"}
            </p>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </PageShell>
  );
}
