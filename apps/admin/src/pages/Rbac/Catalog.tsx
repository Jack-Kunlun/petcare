import { RBAC_PERMISSION_TYPES, type RbacPermissionDefinition } from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { FolderTree, RefreshCw, ShieldCheck } from "lucide-react";
import { fetchRbacCatalog } from "../../api/rbac";
import {
  Badge,
  Button,
  PageHeader,
  PageShell,
  Panel,
  Skeleton,
  StatePanel,
} from "../../components/ui";

interface PermissionGroup {
  module: string;
  permissions: RbacPermissionDefinition[];
}

/** Groups the server-owned UI permission catalog by its product module. */
function groupPermissions(permissions: readonly RbacPermissionDefinition[]): PermissionGroup[] {
  const groups = new Map<string, RbacPermissionDefinition[]>();

  for (const permission of permissions) {
    if (permission.type === RBAC_PERMISSION_TYPES.API) {
      continue;
    }

    const group = groups.get(permission.module) ?? [];

    group.push(permission);
    groups.set(permission.module, group);
  }

  return [...groups.entries()]
    .map(([module, modulePermissions]) => ({
      module,
      permissions: modulePermissions.sort(
        (left, right) => left.order - right.order || left.code.localeCompare(right.code),
      ),
    }))
    .sort((left, right) => {
      const leftOrder = left.permissions[0]?.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.permissions[0]?.order ?? Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder || left.module.localeCompare(right.module);
    });
}

/** Renders the menu and button catalog as scannable module groups. */
function PermissionCatalog({ permissions }: { permissions: readonly RbacPermissionDefinition[] }) {
  const groups = groupPermissions(permissions);
  const parentLabels = new Map(
    permissions.map((permission) => [permission.code, permission.label]),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {groups.map((group) => {
        const menuCount = group.permissions.filter(
          (permission) => permission.type === RBAC_PERMISSION_TYPES.MENU,
        ).length;

        return (
          <Panel key={group.module} padding="none" className="overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-surface-subtle px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <FolderTree aria-hidden="true" className="h-4 w-4 text-brand-primary" />
                  <h2 className="font-semibold text-text-primary">{group.module}</h2>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {menuCount} 个菜单 · {group.permissions.length - menuCount} 个操作
                </p>
              </div>
              <Badge tone="neutral">只读目录</Badge>
            </header>
            <ul className="divide-y divide-border">
              {group.permissions.map((permission) => (
                <li
                  key={permission.code}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-page-background sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">{permission.label}</p>
                    <p className="mt-1 break-all font-mono text-xs text-text-muted">
                      {permission.code}
                    </p>
                    {permission.parentCode ? (
                      <p className="mt-1.5 text-xs text-text-secondary">
                        归属：{parentLabels.get(permission.parentCode) ?? permission.parentCode}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    className="self-start"
                    tone={permission.type === RBAC_PERMISSION_TYPES.MENU ? "brand" : "neutral"}
                  >
                    {permission.type === RBAC_PERMISSION_TYPES.MENU ? "菜单" : "操作"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}

/** Displays the read-only permission catalog returned by the server. */
export default function RbacCatalog() {
  const catalogQuery = useQuery({ queryKey: ["rbac-catalog"], queryFn: fetchRbacCatalog });

  return (
    <PageShell>
      <PageHeader
        eyebrow="访问控制"
        title="菜单目录"
        description="按业务模块查看后台页面、按钮及其归属关系；目录由服务端统一维护。"
        meta={
          catalogQuery.data ? <Badge tone="info">目录 {catalogQuery.data.version}</Badge> : null
        }
      />

      <Panel className="flex items-start gap-3" padding="sm">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
        <div>
          <h2 className="font-semibold text-text-primary">权限派生规则</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            目录只读，API 权限由服务端根据菜单和按钮权限自动派生。
          </p>
        </div>
      </Panel>

      {catalogQuery.isPending ? (
        <Panel aria-label="正在加载菜单目录">
          <Skeleton lines={8} />
        </Panel>
      ) : null}

      {catalogQuery.isError ? (
        <StatePanel
          role="alert"
          tone="danger"
          icon={<RefreshCw aria-hidden="true" className="h-5 w-5" />}
          title="权限目录加载失败"
          description="未能读取服务端权限目录，请检查连接后重试。"
          action={
            <Button intent="dangerOutline" onClick={() => void catalogQuery.refetch()}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              重新加载
            </Button>
          }
        />
      ) : null}

      {catalogQuery.data ? <PermissionCatalog permissions={catalogQuery.data.permissions} /> : null}
    </PageShell>
  );
}
