import { RBAC_PERMISSION_CATALOG, RBAC_PERMISSION_TYPES } from "@petcare/shared-types";
import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import { createElement, lazy, Suspense } from "react";
import { LazyRouteBoundary } from "../components/LazyRouteBoundary";

const Account = lazy(() => import("../pages/Account"));
const ContentManagement = lazy(() => import("../pages/ContentManagement"));
const ContentArticles = lazy(() => import("../pages/ContentManagement/Articles"));
const ContentArticleEdit = lazy(() => import("../pages/ContentManagement/Articles/Edit"));
const ContentPosts = lazy(() => import("../pages/ContentManagement/Posts"));
const ContentPostDetail = lazy(() => import("../pages/ContentManagement/Posts/Detail"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Rbac = lazy(() => import("../pages/Rbac"));
const RbacDetail = lazy(() => import("../pages/Rbac/Detail"));
const RbacEdit = lazy(() => import("../pages/Rbac/Edit"));
const RbacCatalog = lazy(() => import("../pages/Rbac/Catalog"));
const SharedContent = lazy(() => import("../pages/SharedContent"));
const UserManagement = lazy(() => import("../pages/UserManagement"));
const WebsiteContent = lazy(() => import("../pages/WebsiteContent"));
const WebsiteContentEdit = lazy(() => import("../pages/WebsiteContent/Edit"));
const WebsiteContentDetail = lazy(() => import("../pages/WebsiteContent/Detail"));

type LazyRouteComponent = LazyExoticComponent<ComponentType>;

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
  component: LazyRouteComponent,
  menuLabel?: string,
): AdminRouteDefinition {
  const permission = catalogByCode.get(permissionCode);
  const parentPermission = permission?.parentCode
    ? catalogByCode.get(permission.parentCode)
    : undefined;

  if (!permission || permission.type !== RBAC_PERMISSION_TYPES.MENU || permission.path === null) {
    throw new Error(`Admin menu route ${id} references an invalid catalog permission.`);
  }

  const label = menuLabel ?? permission.label;

  return {
    id,
    path: permission.path,
    element: lazyRoute(component, label),
    menuPermission: permission.code,
    requiredPermissions: [permission.code],
    parentPath: parentPermission?.path ?? null,
    order: permission.order,
    icon: permission.icon,
    menuLabel: label,
  };
}

function lazyRoute(component: LazyRouteComponent, label: string): ReactNode {
  return createElement(LazyRouteBoundary, {
    label,
    children: createElement(
      Suspense,
      {
        fallback: createElement(
          "p",
          {
            "aria-live": "polite",
            "aria-label": `正在加载${label}`,
            className: "rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600",
          },
          `正在加载${label}…`,
        ),
      },
      createElement(component),
    ),
  });
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
    element: lazyRoute(Account, "个人中心"),
    menuPermission: null,
    requiredPermissions: [],
    parentPath: null,
    order: 0,
    icon: null,
    menuLabel: null,
  },
  catalogMenuRoute("dashboard", "stats.view", Dashboard),
  catalogMenuRoute("users", "user.view", UserManagement, "用户列表"),
  catalogMenuRoute("content", "content.view", ContentManagement, "内容概览"),
  catalogMenuRoute("content-posts", "content.post.view", ContentPosts),
  {
    id: "content-post-detail",
    path: "/content/posts/:id",
    element: lazyRoute(ContentPostDetail, "帖子详情"),
    menuPermission: null,
    requiredPermissions: ["content.post.view"],
    parentPath: "/content/posts",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  catalogMenuRoute("content-articles", "content.article.view", ContentArticles),
  {
    id: "content-articles-new",
    path: "/content/articles/new",
    element: lazyRoute(ContentArticleEdit, "文章编辑"),
    menuPermission: null,
    requiredPermissions: ["content.article.write"],
    parentPath: "/content/articles",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  {
    id: "content-articles-edit",
    path: "/content/articles/:id/edit",
    element: lazyRoute(ContentArticleEdit, "文章编辑"),
    menuPermission: null,
    requiredPermissions: ["content.article.write"],
    parentPath: "/content/articles",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  catalogMenuRoute("website-content", "website.view", WebsiteContent, "官网管理"),
  {
    id: "website-content-edit",
    path: "/website-content/:contentKey/edit",
    element: lazyRoute(WebsiteContentEdit, "官网内容编辑"),
    menuPermission: null,
    requiredPermissions: ["website.view"],
    parentPath: "/website-content",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  {
    id: "website-content-history",
    path: "/website-content/:contentKey/history/:versionId",
    element: lazyRoute(WebsiteContentDetail, "官网内容历史"),
    menuPermission: null,
    requiredPermissions: ["website.view"],
    parentPath: "/website-content",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  {
    id: "shared-content",
    path: "/shared-content",
    element: lazyRoute(SharedContent, "公共内容配置"),
    menuPermission: "website.view",
    requiredPermissions: ["website.view"],
    parentPath: null,
    order: 55,
    icon: "Settings2",
    menuLabel: "公共内容配置",
  },
  {
    id: "shared-content-edit",
    path: "/shared-content/:contentKey/edit",
    element: lazyRoute(WebsiteContentEdit, "公共内容编辑"),
    menuPermission: null,
    requiredPermissions: ["website.view"],
    parentPath: "/shared-content",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  {
    id: "shared-content-history",
    path: "/shared-content/:contentKey/history/:versionId",
    element: lazyRoute(WebsiteContentDetail, "公共内容历史"),
    menuPermission: null,
    requiredPermissions: ["website.view"],
    parentPath: "/shared-content",
    order: 0,
    icon: null,
    menuLabel: null,
  },
  catalogMenuRoute("rbac", "rbac.view", Rbac, "角色管理"),
  catalogMenuRoute("rbac-catalog", "rbac.catalog.view", RbacCatalog, "菜单目录"),
  {
    id: "rbac-new",
    path: "/rbac/new",
    element: lazyRoute(RbacEdit, "角色编辑"),
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
    element: lazyRoute(RbacEdit, "角色编辑"),
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
    element: lazyRoute(RbacDetail, "角色详情"),
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
