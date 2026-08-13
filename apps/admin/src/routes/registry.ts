import { RBAC_PERMISSION_CATALOG, RBAC_PERMISSION_TYPES } from "@petcare/shared-types";
import type { ReactNode } from "react";
import { createElement, lazy, Suspense } from "react";
import { LazyRouteBoundary } from "../components/LazyRouteBoundary";
import ContentManagement from "../pages/ContentManagement";
import ContentArticles from "../pages/ContentManagement/Articles";
import ContentPosts from "../pages/ContentManagement/Posts";
import Dashboard from "../pages/Dashboard";
import OrderManagement from "../pages/OrderManagement";
import ComplaintWorkQueue from "../pages/OrderManagement/Complaint";
import ComplaintDetail from "../pages/OrderManagement/Complaint/Detail";
import Rbac from "../pages/Rbac";
import RbacDetail from "../pages/Rbac/Detail";
import RbacEdit from "../pages/Rbac/Edit";
import UserManagement from "../pages/UserManagement";
import ProviderCertificationList from "../pages/UserManagement/Certification";
import ProviderCertificationDetail from "../pages/UserManagement/Certification/Detail";

const Settings = lazy(() => import("../pages/Settings"));
const SettingsDetail = lazy(() => import("../pages/Settings/Detail"));
const SettingsEdit = lazy(() => import("../pages/Settings/Edit"));
const RbacCatalog = lazy(() => import("../pages/Rbac/Catalog"));
const Account = lazy(() => import("../pages/Account"));

/** A protected administration route, including its menu metadata when it has a menu entry. */
export interface AdminRouteDefinition {
  /** Stable route identifier used as the React route key. */
  id: string;
  /** Absolute administration URL path. */
  path: string;
  /** Page element rendered when the route is matched. */
  element: ReactNode;
  /** Catalog menu permission that owns this menu route, or null for detail routes. */
  menuPermission: string | null;
  /** Every catalog permission required to enter this route. */
  requiredPermissions: readonly string[];
  /** Parent menu path for nested navigation, or null for root menu entries. */
  parentPath: string | null;
  /** Stable display order within the parent route. */
  order: number;
  /** Catalog icon identifier for a menu route, or null for detail routes. */
  icon: string | null;
  /** Display label used by the contextual secondary menu, or null for detail routes. */
  menuLabel: string | null;
}

const catalogByCode = new Map(
  RBAC_PERMISSION_CATALOG.map((permission) => [permission.code, permission]),
);

/** Builds menu route metadata from the shared catalog so paths and ordering cannot drift. */
function catalogMenuRoute(
  id: string,
  permissionCode: string,
  element: ReactNode,
  menuLabel?: string,
): AdminRouteDefinition {
  const permission = catalogByCode.get(permissionCode);
  const parentPermission = permission?.parentCode
    ? catalogByCode.get(permission.parentCode)
    : undefined;

  if (!permission || permission.type !== RBAC_PERMISSION_TYPES.MENU || permission.path === null) {
    throw new Error(`Admin menu route ${id} references an invalid catalog permission.`);
  }

  return {
    id,
    path: permission.path,
    element,
    menuPermission: permission.code,
    requiredPermissions: [permission.code],
    parentPath: parentPermission?.path ?? null,
    order: permission.order,
    icon: permission.icon,
    menuLabel: menuLabel ?? permission.label,
  };
}

function settingsRoute(element: ReactNode) {
  return createElement(
    LazyRouteBoundary,
    null,
    createElement(
      Suspense,
      {
        fallback: createElement(
          "p",
          {
            "aria-live": "polite",
            className: "rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600",
          },
          "正在加载系统设置…",
        ),
      },
      element,
    ),
  );
}

function accountRoute(element: ReactNode) {
  return createElement(
    LazyRouteBoundary,
    null,
    createElement(
      Suspense,
      {
        fallback: createElement(
          "p",
          { "aria-live": "polite", className: "p-8 text-center text-slate-600" },
          "正在加载个人中心…",
        ),
      },
      element,
    ),
  );
}

/**
 * The adapter from serializable shared permission catalog records to React route elements.
 *
 * The adapter keeps shared catalog data serializable while routing each protected Admin view.
 */
export const ADMIN_ROUTE_REGISTRY: readonly AdminRouteDefinition[] = [
  {
    id: "account",
    path: "/account",
    element: accountRoute(createElement(Account)),
    menuPermission: null,
    requiredPermissions: [],
    parentPath: null,
    order: 0,
    icon: null,
    menuLabel: null,
  },
  catalogMenuRoute("dashboard", "stats.view", createElement(Dashboard)),
  catalogMenuRoute("users", "user.view", createElement(UserManagement), "用户列表"),
  catalogMenuRoute(
    "provider-certifications",
    "provider_certification.view",
    createElement(ProviderCertificationList),
  ),
  {
    id: "provider-certification-detail",
    path: "/users/certifications/:id",
    element: createElement(ProviderCertificationDetail),
    menuPermission: null,
    requiredPermissions: ["provider_certification.view"],
    parentPath: "/users/certifications",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  catalogMenuRoute("orders", "order.view", createElement(OrderManagement), "订单管理"),
  catalogMenuRoute("complaints", "dispute.view", createElement(ComplaintWorkQueue)),
  {
    id: "complaint-detail",
    path: "/orders/complaints/:id",
    element: createElement(ComplaintDetail),
    menuPermission: null,
    requiredPermissions: ["dispute.view"],
    parentPath: "/orders/complaints",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  catalogMenuRoute("content", "content.view", createElement(ContentManagement), "悬赏管理"),
  catalogMenuRoute("content-posts", "content.post.view", createElement(ContentPosts)),
  catalogMenuRoute("content-articles", "content.article.view", createElement(ContentArticles)),
  catalogMenuRoute("settings", "system.view", settingsRoute(createElement(Settings)), "系统设置"),
  {
    id: "settings-edit",
    path: "/settings/:domain/edit",
    element: settingsRoute(createElement(SettingsEdit)),
    menuPermission: null,
    requiredPermissions: ["system.view"],
    parentPath: "/settings",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  {
    id: "settings-history",
    path: "/settings/:domain/history/:versionId",
    element: settingsRoute(createElement(SettingsDetail)),
    menuPermission: null,
    requiredPermissions: ["system.view"],
    parentPath: "/settings",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  catalogMenuRoute("rbac", "rbac.view", createElement(Rbac), "角色管理"),
  catalogMenuRoute("rbac-catalog", "rbac.catalog.view", createElement(RbacCatalog), "菜单目录"),
  {
    id: "rbac-new",
    path: "/rbac/new",
    element: createElement(RbacEdit),
    menuPermission: null,
    requiredPermissions: ["rbac.view"],
    parentPath: "/rbac",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  {
    id: "rbac-edit",
    path: "/rbac/:id/edit",
    element: createElement(RbacEdit),
    menuPermission: null,
    requiredPermissions: ["rbac.view"],
    parentPath: "/rbac",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  {
    id: "rbac-detail",
    path: "/rbac/:id",
    element: createElement(RbacDetail),
    menuPermission: null,
    requiredPermissions: ["rbac.view"],
    parentPath: "/rbac",
    order: 0,
    icon: null,
    menuLabel: null,
  },
];

/** Returns catalog-backed menu routes visible to the supplied effective UI permission codes. */
export function getVisibleMenuRoutes(permissionCodes: readonly string[]): AdminRouteDefinition[] {
  const permissions = new Set(permissionCodes);

  return ADMIN_ROUTE_REGISTRY.filter(
    (route) => route.menuPermission !== null && permissions.has(route.menuPermission),
  ).sort((left, right) => left.order - right.order || left.path.localeCompare(right.path));
}

/** Returns visible root menu routes that have no parent menu path. */
export function getVisibleRootMenuRoutes(
  permissionCodes: readonly string[],
): AdminRouteDefinition[] {
  return getVisibleMenuRoutes(permissionCodes).filter((route) => route.parentPath === null);
}

/** Returns visible child menu routes directly belonging to the supplied parent path. */
export function getVisibleChildMenuRoutes(
  parentPath: string,
  permissionCodes: readonly string[],
): AdminRouteDefinition[] {
  return getVisibleMenuRoutes(permissionCodes).filter((route) => route.parentPath === parentPath);
}

const catalogCodes = new Set(RBAC_PERMISSION_CATALOG.map((permission) => permission.code));

for (const route of ADMIN_ROUTE_REGISTRY) {
  if (
    (route.menuPermission && !catalogCodes.has(route.menuPermission)) ||
    route.requiredPermissions.some((permission) => !catalogCodes.has(permission))
  ) {
    throw new Error(
      `Admin route ${route.id} references a permission absent from the shared catalog.`,
    );
  }
}
