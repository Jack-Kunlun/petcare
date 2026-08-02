import { RBAC_PERMISSION_CATALOG, RBAC_PERMISSION_TYPES } from "@petcare/shared-types";
import {
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  House,
  MessageSquareWarning,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { matchPath, NavLink, useLocation } from "react-router-dom";
import {
  getVisibleChildMenuRoutes,
  getVisibleRootMenuRoutes,
  type AdminRouteDefinition,
} from "../routes/registry";

const menuPermissionByCode = new Map(
  RBAC_PERMISSION_CATALOG.filter(
    (permission) => permission.type === RBAC_PERMISSION_TYPES.MENU,
  ).map((permission) => [permission.code, permission]),
);
const allMenuPermissionCodes = [...menuPermissionByCode.keys()];
const icons: Record<string, LucideIcon> = {
  House,
  Users,
  ShoppingBag,
  Settings,
  BadgeCheck,
  MessageSquareWarning,
  ShieldCheck,
};

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  permissions?: readonly string[];
}

interface MenuTreeNode {
  route: AdminRouteDefinition;
  children: AdminRouteDefinition[];
}

function getMenuLabel(route: AdminRouteDefinition) {
  return route.menuPermission
    ? (menuPermissionByCode.get(route.menuPermission)?.label ?? route.menuLabel ?? route.id)
    : (route.menuLabel ?? route.id);
}

function getIcon(route: AdminRouteDefinition) {
  return route.icon ? (icons[route.icon] ?? ShieldCheck) : ShieldCheck;
}

function isRouteActive(path: string, pathname: string) {
  if (path === "/") {
    return pathname === "/";
  }

  return matchPath({ path, end: false }, pathname) !== null;
}

function RootMenuLink({
  route,
  label,
  onClose,
  end,
}: {
  route: AdminRouteDefinition;
  label: string;
  onClose?: () => void;
  end: boolean;
}) {
  const Icon = getIcon(route);

  return (
    <NavLink
      to={route.path}
      end={end}
      onClick={onClose}
      className={({ isActive }) =>
        `group flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-400 ${
          isActive
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-300 hover:bg-white/8 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            aria-hidden="true"
            className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {isActive ? <ChevronRight aria-hidden="true" className="h-4 w-4 text-blue-100" /> : null}
        </>
      )}
    </NavLink>
  );
}

/** Renders the single PC/mobile navigation tree used by the administration console. */
export function Sidebar({ open = false, onClose, permissions }: SidebarProps) {
  const location = useLocation();
  const effectivePermissions = permissions ?? allMenuPermissionCodes;
  const menuTree = useMemo<MenuTreeNode[]>(
    () =>
      getVisibleRootMenuRoutes(effectivePermissions).map((route) => ({
        route,
        children: getVisibleChildMenuRoutes(route.path, effectivePermissions),
      })),
    [effectivePermissions],
  );
  const activeRootPaths = useMemo(
    () =>
      new Set(
        menuTree
          .filter(({ route }) => isRouteActive(route.path, location.pathname))
          .map(({ route }) => route.path),
      ),
    [location.pathname, menuTree],
  );
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(activeRootPaths);

  useEffect(() => {
    if (activeRootPaths.size === 0) {
      return;
    }

    setExpandedPaths((current) => {
      const next = new Set(current);
      let changed = false;

      for (const path of activeRootPaths) {
        if (!next.has(path)) {
          next.add(path);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [activeRootPaths]);

  const toggleExpanded = (path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  };

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="关闭导航遮罩"
          className="fixed inset-0 z-30 cursor-pointer bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen min-h-0 w-64 flex-col border-r border-slate-200 bg-slate-950 text-slate-300 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-950/40">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-wide text-white">PetCare</p>
              <p className="truncate text-xs text-slate-400">运营管理中心</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭导航"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:hidden"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="后台主导航" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            工作台
          </p>

          <div data-testid="mobile-menu" className="lg:hidden">
            <ul className="space-y-1">
              {menuTree.map(({ route }) => (
                <li key={route.path}>
                  <RootMenuLink
                    route={route}
                    label={getMenuLabel(route)}
                    onClose={onClose}
                    end={route.path === "/"}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div data-testid="desktop-menu-tree" className="hidden lg:block">
            <ul className="space-y-1">
              {menuTree.map(({ route, children }) => {
                const Icon = getIcon(route);
                const label = getMenuLabel(route);
                const hasChildren = children.length > 0;
                const isExpanded = expandedPaths.has(route.path);
                const isParentActive = isRouteActive(route.path, location.pathname);
                const childRoutes = hasChildren ? [route, ...children] : [];

                return (
                  <li key={route.path}>
                    {hasChildren ? (
                      <button
                        type="button"
                        aria-label={`${label}菜单`}
                        aria-expanded={isExpanded}
                        aria-controls={`submenu-${route.id}`}
                        className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          isParentActive
                            ? "bg-blue-600/40 text-blue-100"
                            : "text-slate-300 hover:bg-white/8 hover:text-white"
                        }`}
                        onClick={() => toggleExpanded(route.path)}
                      >
                        <Icon
                          aria-hidden="true"
                          className={`h-4.5 w-4.5 shrink-0 ${isParentActive ? "text-blue-200" : "text-slate-400 group-hover:text-white"}`}
                        />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 transition-transform duration-150 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                        />
                      </button>
                    ) : (
                      <RootMenuLink
                        route={route}
                        label={label}
                        onClose={onClose}
                        end={route.path === "/"}
                      />
                    )}

                    {hasChildren && isExpanded ? (
                      <ul
                        id={`submenu-${route.id}`}
                        className="ml-6 mt-1 space-y-1 border-l border-white/10 pl-3"
                      >
                        {childRoutes.map((child) => {
                          return (
                            <li key={child.path}>
                              <NavLink
                                to={child.path}
                                end
                                onClick={onClose}
                                className={({ isActive }) =>
                                  `group flex min-h-10 items-center rounded-md px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 ${
                                    isActive
                                      ? "bg-blue-600 font-medium text-white shadow-sm"
                                      : "text-slate-400 hover:bg-white/8 hover:text-white"
                                  }`
                                }
                              >
                                {child === route
                                  ? (route.menuLabel ?? label)
                                  : (child.menuLabel ?? child.id)}
                              </NavLink>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/5 px-3 py-3">
            <p className="text-xs font-medium text-slate-300">系统状态</p>
            <p className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              所有服务运行正常
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
