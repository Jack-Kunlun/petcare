import { RBAC_PERMISSION_CATALOG, RBAC_PERMISSION_TYPES } from "@petcare/shared-types";
import { ChevronRight } from "lucide-react";
import { matchPath, NavLink, useLocation } from "react-router-dom";
import {
  ADMIN_ROUTE_REGISTRY,
  getVisibleChildMenuRoutes,
  getVisibleMenuRoutes,
} from "../routes/registry";

const allMenuPermissionCodes = RBAC_PERMISSION_CATALOG.filter(
  (permission) => permission.type === RBAC_PERMISSION_TYPES.MENU,
).map((permission) => permission.code);

const menuRoutes = ADMIN_ROUTE_REGISTRY.filter((route) => route.menuPermission !== null);

function getExactMenuRoute(pathname: string) {
  return menuRoutes.find((route) => matchPath({ path: route.path, end: true }, pathname));
}

function getDetailParentMenuRoute(pathname: string) {
  const detailRoute = ADMIN_ROUTE_REGISTRY.find(
    (route) =>
      route.menuPermission === null && matchPath({ path: route.path, end: true }, pathname),
  );

  return detailRoute
    ? (menuRoutes.find((route) => route.path === detailRoute.parentPath) ?? null)
    : null;
}

function getModuleRootRoute(route: (typeof menuRoutes)[number] | null) {
  let current = route;

  while (current?.parentPath) {
    const parent = menuRoutes.find((candidate) => candidate.path === current?.parentPath);

    if (!parent) {
      break;
    }

    current = parent;
  }

  return current;
}

/** Renders the current module's PC-only vertical secondary navigation. */
export function SecondarySidebar({ permissions }: { permissions?: readonly string[] }) {
  const location = useLocation();
  const effectivePermissions = permissions ?? allMenuPermissionCodes;
  const currentMenuRoute =
    getExactMenuRoute(location.pathname) ?? getDetailParentMenuRoute(location.pathname);
  const moduleRootRoute = getModuleRootRoute(currentMenuRoute);
  const visibleMenuRoutes = getVisibleMenuRoutes(effectivePermissions);
  const visibleModuleRoot = moduleRootRoute
    ? visibleMenuRoutes.find((route) => route.path === moduleRootRoute.path)
    : null;
  const childRoutes = moduleRootRoute
    ? getVisibleChildMenuRoutes(moduleRootRoute.path, effectivePermissions)
    : [];
  const navigationItems =
    childRoutes.length > 0
      ? (visibleModuleRoot
        ? [visibleModuleRoot, ...childRoutes]
        : childRoutes)
      : [];

  if (navigationItems.length === 0) {
    return null;
  }

  return (
    <aside className="hidden h-screen min-h-0 w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">当前模块</p>
        <p className="mt-2 truncate text-base font-semibold text-slate-950">
          {moduleRootRoute?.menuLabel ?? "后台菜单"}
        </p>
      </div>
      <nav aria-label="后台二级导航" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navigationItems.map((route) => (
            <li key={route.path}>
              <NavLink
                to={route.path}
                end={route.path !== currentMenuRoute?.path}
                className={({ isActive }) =>
                  `group flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? "bg-blue-50 text-blue-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`
                }
                aria-current={route.path === currentMenuRoute?.path ? "page" : undefined}
              >
                {({ isActive }) => (
                  <>
                    <span className="flex-1 truncate">{route.menuLabel ?? route.id}</span>
                    <ChevronRight
                      aria-hidden="true"
                      className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-700" : "text-slate-300 group-hover:text-slate-500"}`}
                    />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
