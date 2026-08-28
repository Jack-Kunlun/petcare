import { RBAC_PERMISSION_TYPES } from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createRbacRole,
  fetchRbacCatalog,
  fetchRbacRole,
  replaceRbacRolePermissions,
  updateRbacRole,
} from "../../api/rbac";
import { PermissionGate } from "../../auth/PermissionGate";
import { EditorPageLayout, FormSection } from "../../components/EditorPageLayout";
import { Badge, Button, Input, StatePanel, Textarea } from "../../components/ui";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import {
  buildPermissionTree,
  collectCheckedCodes,
  isConflict,
  togglePermissionTree,
  type PermissionTreeNode,
} from "./rbac-utils";

interface PermissionNodeProps {
  node: PermissionTreeNode;
  disabled: boolean;
  depth?: number;
  onToggle(code: string): void;
}

/** Renders one permission tree branch and propagates descendant selection changes. */
function PermissionNode({ node, disabled, depth = 0, onToggle }: PermissionNodeProps) {
  return (
    <li
      className={depth === 0 ? "rounded-xl border border-border bg-surface-subtle p-3" : "mt-1.5"}
    >
      <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
        <input
          type="checkbox"
          aria-label={node.label}
          checked={node.checked}
          disabled={disabled || node.type === RBAC_PERMISSION_TYPES.API}
          ref={(input) => {
            if (input) {
              input.indeterminate = node.indeterminate;
            }
          }}
          onChange={() => onToggle(node.code)}
          className="h-4 w-4 rounded border-border-strong text-brand-primary focus:ring-brand-primary"
        />
        <span className="min-w-0">
          <span className="block font-medium text-text-primary">{node.label}</span>
          <span className="block font-mono text-xs text-text-muted">{node.code}</span>
        </span>
      </label>
      {node.children.length > 0 ? (
        <ul className="ml-5 border-l border-border pl-3">
          {node.children.map((child) => (
            <PermissionNode
              key={child.code}
              node={child}
              disabled={disabled}
              depth={depth + 1}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Creates or edits a normal role and its menu/button permission assignments. */
export default function RbacEdit() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);
  const [navigationDestination, setNavigationDestination] = useState<string | null>(null);
  const catalogQuery = useQuery({ queryKey: ["rbac-catalog"], queryFn: fetchRbacCatalog });
  const roleQuery = useQuery({
    queryKey: ["rbac-role", id],
    queryFn: () => fetchRbacRole(id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!roleQuery.data) {
      return;
    }

    setRoleName(roleQuery.data.roleName);
    setDescription(roleQuery.data.description ?? "");
    setIsActive(roleQuery.data.isActive);
    setSelectedCodes(roleQuery.data.permissionCodes);
    setDirty(false);
  }, [roleQuery.data]);

  useEffect(() => {
    if (pendingDestination && !dirty) {
      setNavigationDestination(pendingDestination);
      setPendingDestination(null);
    }
  }, [dirty, pendingDestination]);

  useEffect(() => {
    if (navigationDestination) {
      navigate(navigationDestination);
      setNavigationDestination(null);
    }
  }, [navigate, navigationDestination]);

  const role = roleQuery.data;
  const isSystem = role?.isSystem ?? false;
  const tree = catalogQuery.data
    ? buildPermissionTree(catalogQuery.data.permissions, selectedCodes)
    : [];
  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissionCodes = collectCheckedCodes(tree);

      if (isNew) {
        const created = await createRbacRole({
          roleName: roleName.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
        });

        await replaceRbacRolePermissions(created.id, { permissionCodes });

        return created.id;
      }

      await updateRbacRole(id!, {
        roleName: roleName.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        isActive,
      });
      await replaceRbacRolePermissions(id!, { permissionCodes });

      return id!;
    },
    onSuccess: async (roleId) => {
      await queryClient.invalidateQueries({ queryKey: ["rbac-roles"] });
      await queryClient.invalidateQueries({ queryKey: ["rbac-role", roleId] });
      setDirty(false);
      setPendingDestination(`/rbac/${roleId}`);
    },
  });
  const unsavedChanges = useUnsavedChanges(dirty);

  /** Validates the editable role fields before submitting the role mutation. */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!roleName.trim() || isSystem) {
      return;
    }

    saveMutation.mutate();
  }

  if (catalogQuery.isPending || (!isNew && roleQuery.isPending)) {
    return (
      <StatePanel
        aria-label="正在加载角色编辑器"
        title="正在加载角色编辑器"
        description="正在读取角色资料和服务端权限目录。"
      />
    );
  }

  if (catalogQuery.isError || (!isNew && roleQuery.isError)) {
    return (
      <StatePanel
        role="alert"
        tone="danger"
        icon={<RefreshCw aria-hidden="true" className="h-5 w-5" />}
        title="角色编辑器加载失败"
        description="未能读取角色或权限目录，请检查连接后重试。"
        action={
          <Button
            intent="dangerOutline"
            onClick={() => {
              void catalogQuery.refetch();
              void roleQuery.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新加载
          </Button>
        }
      />
    );
  }

  return (
    <EditorPageLayout
      title={isNew ? "新建角色" : `编辑角色：${role?.roleName ?? ""}`}
      description="仅可分配菜单和按钮权限，服务端会按权限目录自动附加接口访问权限。"
      back={
        <Button asChild intent="ghost">
          <Link to={isNew ? "/rbac" : `/rbac/${id}`}>
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
        !isSystem ? (
          <PermissionGate all={[isNew ? "rbac.role.create" : "rbac.role.update"]}>
            <Button
              aria-label="顶部保存角色"
              form="rbac-role-form"
              type="submit"
              disabled={!roleName.trim() || saveMutation.isPending}
              loading={saveMutation.isPending}
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              保存角色
            </Button>
          </PermissionGate>
        ) : null
      }
      unsavedChanges={unsavedChanges}
    >
      {isSystem ? (
        <div className="flex items-center gap-2 rounded-xl border border-warning-border bg-warning-soft p-4 text-warning">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          系统角色不可编辑
        </div>
      ) : null}
      {saveMutation.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-soft p-4 text-danger-strong"
        >
          {isConflict(saveMutation.error)
            ? "角色已被其他管理员更新，请刷新后再试。"
            : "保存角色失败，请检查输入后重试。"}
        </div>
      ) : null}

      <form id="rbac-role-form" className="space-y-6" onSubmit={submit}>
        <FormSection title="基本信息" description="定义角色名称、说明和启用状态。">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label>
              <span className="text-sm font-medium text-text-primary">角色名称</span>
              <Input
                aria-label="角色名称"
                value={roleName}
                disabled={isSystem}
                onChange={(event) => {
                  setRoleName(event.target.value);
                  setDirty(true);
                }}
                required
                maxLength={50}
                className="mt-2"
              />
            </label>
            <label className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface-subtle px-4">
              <input
                type="checkbox"
                checked={isActive}
                disabled={isSystem}
                onChange={(event) => {
                  setIsActive(event.target.checked);
                  setDirty(true);
                }}
                className="h-4 w-4 rounded border-border-strong text-brand-primary"
              />
              <span>
                <span className="block text-sm font-medium text-text-primary">启用角色</span>
                <span className="mt-0.5 block text-xs text-text-secondary">停用后不再授予权限</span>
              </span>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-text-primary">角色说明</span>
            <Textarea
              aria-label="角色说明"
              value={description}
              disabled={isSystem}
              onChange={(event) => {
                setDescription(event.target.value);
                setDirty(true);
              }}
              rows={3}
              maxLength={200}
              className="mt-2"
            />
          </label>
        </FormSection>
        <FormSection
          title="菜单与操作权限"
          description="按根菜单分组；勾选父项会同步勾选所有子项，部分选择时父项显示半选。"
          actions={<Badge tone="info">目录 {catalogQuery.data?.version}</Badge>}
        >
          <ul className="grid gap-4 xl:grid-cols-2">
            {tree.map((node) => (
              <PermissionNode
                key={node.code}
                node={node}
                disabled={isSystem}
                onToggle={(code) => {
                  setSelectedCodes(collectCheckedCodes(togglePermissionTree(tree, code)));
                  setDirty(true);
                }}
              />
            ))}
          </ul>
        </FormSection>
        {!isSystem ? (
          <PermissionGate
            all={[isNew ? "rbac.role.create" : "rbac.role.update"]}
            fallback={
              <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
                没有保存角色的权限。
              </p>
            }
          >
            <Button
              type="submit"
              disabled={!roleName.trim() || saveMutation.isPending}
              loading={saveMutation.isPending}
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              保存角色
            </Button>
          </PermissionGate>
        ) : null}
      </form>
    </EditorPageLayout>
  );
}
