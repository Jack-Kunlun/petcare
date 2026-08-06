import { RBAC_PERMISSION_TYPES, type RbacPermissionDefinition } from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchRbacCatalog } from "../../api/rbac";

/** Renders the server-owned menu and button permission catalog for administrators. */
function PermissionCatalog({ permissions }: { permissions: readonly RbacPermissionDefinition[] }) {
  const uiPermissions = permissions
    .filter((permission) => permission.type !== RBAC_PERMISSION_TYPES.API)
    .sort((left, right) => left.order - right.order || left.code.localeCompare(right.code));
  const parentLabels = new Map(
    permissions.map((permission) => [permission.code, permission.label]),
  );

  return (
    <section
      aria-label="菜单目录"
      className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
    >
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-950">菜单与操作目录</h2>
        <p className="mt-1 text-sm text-slate-600">
          目录只读，API 权限由服务端根据菜单和按钮权限自动派生。
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {uiPermissions.map((permission) => (
          <li
            key={permission.code}
            className="flex flex-col gap-1 border-border px-5 py-4 transition-[background-color,border-color] duration-200 hover:bg-page-background hover:border-border sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-slate-900">{permission.label}</p>
              <p className="mt-1 text-xs text-slate-500">{permission.code}</p>
            </div>
            <div className="text-sm text-slate-600">
              <span className="rounded bg-slate-100 px-2 py-1">
                {permission.type === RBAC_PERMISSION_TYPES.MENU ? "菜单" : "操作"}
              </span>
              {permission.parentCode ? (
                <span className="ml-2">
                  归属：{parentLabels.get(permission.parentCode) ?? permission.parentCode}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Displays the read-only permission catalog returned by the server. */
export default function RbacCatalog() {
  const catalogQuery = useQuery({ queryKey: ["rbac-catalog"], queryFn: fetchRbacCatalog });

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 text-text-primary">
      <header>
        <p className="text-sm font-medium text-blue-700">访问控制</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          菜单目录
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          查看当前后台页面、按钮及其归属关系；目录由服务端统一维护。
        </p>
      </header>

      {catalogQuery.isPending ? (
        <div
          aria-label="正在加载菜单目录"
          className="h-48 rounded-xl bg-slate-200 animate-[pc-skeleton-shimmer_220ms_linear_infinite] motion-reduce:animate-none"
        />
      ) : null}

      {catalogQuery.isError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-950">
          <p className="font-semibold">权限目录加载失败</p>
          <button
            type="button"
            onClick={() => void catalogQuery.refetch()}
            className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-red-700 px-4 font-semibold transition-colors hover:bg-red-100 active:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            重新加载
          </button>
        </div>
      ) : null}

      {catalogQuery.data ? <PermissionCatalog permissions={catalogQuery.data.permissions} /> : null}
    </div>
  );
}
