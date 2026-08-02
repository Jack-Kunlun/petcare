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
import {
  buildPermissionTree,
  isConflict,
  togglePermissionTree,
  type PermissionTreeNode,
} from "./rbac-utils";

/** Collects directly selected menu and button codes from the nested permission tree. */
function collectCheckedCodes(nodes: readonly PermissionTreeNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.checked ? [node.code] : []),
    ...collectCheckedCodes(node.children),
  ]);
}

interface PermissionNodeProps {
  node: PermissionTreeNode;
  disabled: boolean;
  onToggle(code: string): void;
}

/** Renders one permission tree branch and propagates descendant selection changes. */
function PermissionNode({ node, disabled, onToggle }: PermissionNodeProps) {
  return (
    <li className="mt-2">
      <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
        <input
          type="checkbox"
          aria-label={node.label}
          checked={node.checked}
          disabled={disabled}
          ref={(input) => {
            if (input) {
              input.indeterminate = node.indeterminate;
            }
          }}
          onChange={() => onToggle(node.code)}
          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
        />
        <span className="min-w-0">
          <span className="block font-medium text-slate-900">{node.label}</span>
          <span className="block text-xs text-slate-500">{node.code}</span>
        </span>
      </label>
      {node.children.length > 0 ? (
        <ul className="ml-5 border-l border-slate-200 pl-3">
          {node.children.map((child) => (
            <PermissionNode key={child.code} node={child} disabled={disabled} onToggle={onToggle} />
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
  }, [roleQuery.data]);

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
      navigate(`/rbac/${roleId}`);
    },
  });

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
      <div
        aria-label="正在加载角色编辑器"
        className="h-96 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none"
      />
    );
  }

  if (catalogQuery.isError || (!isNew && roleQuery.isError)) {
    return (
      <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-950">
        <h1 className="font-bold">角色编辑器加载失败</h1>
        <button
          type="button"
          onClick={() => {
            void catalogQuery.refetch();
            void roleQuery.refetch();
          }}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-700 px-4 font-semibold hover:bg-red-100"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          重新加载
        </button>
      </section>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <Link
        to={isNew ? "/rbac" : `/rbac/${id}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-800"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        返回角色列表
      </Link>
      <header className="mt-4">
        <p className="text-sm font-medium text-blue-700">角色权限</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          {isNew ? "新建角色" : `编辑角色：${role?.roleName ?? ""}`}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          仅可分配菜单和按钮权限，服务端会按权限目录自动附加接口访问权限。
        </p>
      </header>

      {isSystem ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          系统角色不可编辑
        </div>
      ) : null}
      {saveMutation.isError ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950"
        >
          {isConflict(saveMutation.error)
            ? "角色已被其他管理员更新，请刷新后再试。"
            : "保存角色失败，请检查输入后重试。"}
        </div>
      ) : null}

      <form className="mt-6 space-y-6" onSubmit={submit}>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">基本信息</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-slate-800">角色名称</span>
              <input
                aria-label="角色名称"
                value={roleName}
                disabled={isSystem}
                onChange={(event) => setRoleName(event.target.value)}
                required
                maxLength={50}
                className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>
            <label className="flex items-end gap-3 pb-1">
              <input
                type="checkbox"
                checked={isActive}
                disabled={isSystem}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              <span className="text-sm font-medium text-slate-800">启用角色</span>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-800">角色说明</span>
            <textarea
              aria-label="角色说明"
              value={description}
              disabled={isSystem}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={200}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">菜单与操作权限</h2>
          <p className="mt-1 text-sm text-slate-600">
            勾选父项会同步勾选其所有子项；部分子项已选时父项显示为半选状态。
          </p>
          <ul className="mt-4">
            {tree.map((node) => (
              <PermissionNode
                key={node.code}
                node={node}
                disabled={isSystem}
                onToggle={(code) =>
                  setSelectedCodes(collectCheckedCodes(togglePermissionTree(tree, code)))
                }
              />
            ))}
          </ul>
        </section>
        {!isSystem ? (
          <PermissionGate
            all={[isNew ? "rbac.role.create" : "rbac.role.update"]}
            fallback={
              <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
                没有保存角色的权限。
              </p>
            }
          >
            <button
              type="submit"
              disabled={!roleName.trim() || saveMutation.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              保存角色
            </button>
          </PermissionGate>
        ) : null}
      </form>
    </div>
  );
}
