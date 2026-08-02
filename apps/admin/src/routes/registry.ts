import { RBAC_PERMISSION_CATALOG } from "@petcare/shared-types";
import type { ReactNode } from "react";
import { createElement, lazy, Suspense } from "react";
import { LazyRouteBoundary } from "../components/LazyRouteBoundary";
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

/**
 * The adapter from serializable shared permission catalog records to React route elements.
 *
 * The adapter keeps shared catalog data serializable while routing each protected Admin view.
 */
export const ADMIN_ROUTE_REGISTRY: readonly AdminRouteDefinition[] = [
  {
    id: "dashboard",
    path: "/",
    element: createElement(Dashboard),
    menuPermission: "stats.view",
    requiredPermissions: ["stats.view"],
    parentPath: null,
    order: 10,
    icon: "House",
  },
  {
    id: "users",
    path: "/users",
    element: createElement(UserManagement),
    menuPermission: "user.view",
    requiredPermissions: ["user.view"],
    parentPath: null,
    order: 20,
    icon: "Users",
  },
  {
    id: "provider-certifications",
    path: "/users/certifications",
    element: createElement(ProviderCertificationList),
    menuPermission: "provider_certification.view",
    requiredPermissions: ["provider_certification.view"],
    parentPath: "/users",
    order: 30,
    icon: "BadgeCheck",
  },
  {
    id: "provider-certification-detail",
    path: "/users/certifications/:id",
    element: createElement(ProviderCertificationDetail),
    menuPermission: null,
    requiredPermissions: ["provider_certification.view"],
    parentPath: "/users/certifications",
    order: 0,
    icon: null,
  },
  {
    id: "orders",
    path: "/orders",
    element: createElement(OrderManagement),
    menuPermission: "order.view",
    requiredPermissions: ["order.view"],
    parentPath: null,
    order: 30,
    icon: "ShoppingBag",
  },
  {
    id: "complaints",
    path: "/orders/complaints",
    element: createElement(ComplaintWorkQueue),
    menuPermission: "dispute.view",
    requiredPermissions: ["dispute.view"],
    parentPath: "/orders",
    order: 30,
    icon: "MessageSquareWarning",
  },
  {
    id: "complaint-detail",
    path: "/orders/complaints/:id",
    element: createElement(ComplaintDetail),
    menuPermission: null,
    requiredPermissions: ["dispute.view"],
    parentPath: "/orders/complaints",
    order: 0,
    icon: null,
  },
  {
    id: "settings",
    path: "/settings",
    element: settingsRoute(createElement(Settings)),
    menuPermission: "system.view",
    requiredPermissions: ["system.view"],
    parentPath: null,
    order: 60,
    icon: "Settings",
  },
  {
    id: "settings-edit",
    path: "/settings/:domain/edit",
    element: settingsRoute(createElement(SettingsEdit)),
    menuPermission: null,
    requiredPermissions: ["system.view"],
    parentPath: "/settings",
    order: 0,
    icon: null,
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
  },
  {
    id: "rbac",
    path: "/rbac",
    element: createElement(Rbac),
    menuPermission: "rbac.view",
    requiredPermissions: ["rbac.view"],
    parentPath: "/settings",
    order: 60,
    icon: "ShieldCheck",
  },
  {
    id: "rbac-new",
    path: "/rbac/new",
    element: createElement(RbacEdit),
    menuPermission: null,
    requiredPermissions: ["rbac.view"],
    parentPath: "/rbac",
    order: 0,
    icon: null,
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
  },
];

/** Returns catalog-backed menu routes visible to the supplied effective UI permission codes. */
export function getVisibleMenuRoutes(permissionCodes: readonly string[]): AdminRouteDefinition[] {
  const permissions = new Set(permissionCodes);

  return ADMIN_ROUTE_REGISTRY.filter(
    (route) => route.menuPermission !== null && permissions.has(route.menuPermission),
  ).sort((left, right) => left.order - right.order || left.path.localeCompare(right.path));
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
