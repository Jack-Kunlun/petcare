import { RBAC_PERMISSION_CATALOG, RBAC_PERMISSION_TYPES } from "@petcare/shared-types";
import { isValidElement, Suspense, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { LazyRouteBoundary } from "../components/LazyRouteBoundary";
import {
  ADMIN_ROUTE_REGISTRY,
  getVisibleChildMenuRoutes,
  getVisibleMenuRoutes,
  getVisibleRootMenuRoutes,
} from "./registry";

describe("ADMIN_ROUTE_REGISTRY", () => {
  const menuPermissions = RBAC_PERMISSION_CATALOG.filter(
    (permission) => permission.type === RBAC_PERMISSION_TYPES.MENU,
  );

  it("registers every catalog menu path exactly once with its catalog permission", () => {
    const catalogByCode = new Map(
      RBAC_PERMISSION_CATALOG.map((permission) => [permission.code, permission]),
    );

    for (const permission of menuPermissions) {
      const routes = ADMIN_ROUTE_REGISTRY.filter((route) => route.path === permission.path);
      const parentPath = permission.parentCode
        ? (catalogByCode.get(permission.parentCode)?.path ?? null)
        : null;

      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        path: permission.path,
        menuPermission: permission.code,
        requiredPermissions: [permission.code],
        parentPath,
        order: permission.order,
        icon: permission.icon,
      });
    }
  });

  it("only references permissions defined by the shared catalog", () => {
    const catalogCodes = new Set(RBAC_PERMISSION_CATALOG.map((permission) => permission.code));

    for (const route of ADMIN_ROUTE_REGISTRY) {
      if (route.menuPermission) {
        expect(catalogCodes).toContain(route.menuPermission);
      }

      for (const permission of route.requiredPermissions) {
        expect(catalogCodes).toContain(permission);
      }
    }
  });

  it("wraps every protected business page in a recoverable lazy route boundary", () => {
    for (const route of ADMIN_ROUTE_REGISTRY) {
      const boundary = requireElement(route.element);
      const suspense = requireElement(boundary.props.children);

      expect(boundary.type).toBe(LazyRouteBoundary);
      expect(boundary.props.label).toEqual(expect.any(String));
      expect(suspense.type).toBe(Suspense);
    }
  });

  it("registers account as a protected, menu-less route available without business permissions", () => {
    expect(ADMIN_ROUTE_REGISTRY.find((route) => route.path === "/account")).toMatchObject({
      id: "account",
      menuPermission: null,
      requiredPermissions: [],
      parentPath: null,
      menuLabel: null,
    });

    expect(getVisibleMenuRoutes([])).not.toContainEqual(
      expect.objectContaining({ path: "/account" }),
    );
    expect(getVisibleRootMenuRoutes([])).not.toContainEqual(
      expect.objectContaining({ path: "/account" }),
    );
  });

  it("returns only menu routes allowed by the current permission codes in catalog order", () => {
    expect(
      getVisibleMenuRoutes(["stats.view", "dispute.view", "system.view"]).map(
        (route) => route.path,
      ),
    ).toEqual(["/", "/orders/complaints", "/settings"]);
  });

  it("returns root and child menu routes in catalog order", () => {
    expect(
      getVisibleRootMenuRoutes(["system.view", "rbac.view", "rbac.catalog.view"]).map(
        (route) => route.path,
      ),
    ).toEqual(["/rbac", "/settings"]);
    expect(
      getVisibleChildMenuRoutes("/rbac", ["system.view", "rbac.view", "rbac.catalog.view"]).map(
        (route) => route.path,
      ),
    ).toEqual(["/rbac/catalog"]);
  });

  it("registers the menu catalog page behind its shared menu permission", () => {
    expect(ADMIN_ROUTE_REGISTRY.find((route) => route.path === "/rbac/catalog")).toMatchObject({
      menuPermission: "rbac.catalog.view",
      requiredPermissions: ["rbac.catalog.view"],
      parentPath: "/rbac",
    });
  });

  it("registers Website Content overview, edit, and history behind website.view", () => {
    expect(
      ADMIN_ROUTE_REGISTRY.filter((route) => route.path.startsWith("/website-content")).map(
        (route) => ({
          path: route.path,
          menuPermission: route.menuPermission,
          requiredPermissions: route.requiredPermissions,
          parentPath: route.parentPath,
        }),
      ),
    ).toEqual([
      {
        path: "/website-content",
        menuPermission: "website.view",
        requiredPermissions: ["website.view"],
        parentPath: null,
      },
      {
        path: "/website-content/:contentKey/edit",
        menuPermission: null,
        requiredPermissions: ["website.view"],
        parentPath: "/website-content",
      },
      {
        path: "/website-content/:contentKey/history/:versionId",
        menuPermission: null,
        requiredPermissions: ["website.view"],
        parentPath: "/website-content",
      },
    ]);
  });

  it("registers content management with three child pages", () => {
    expect(
      ADMIN_ROUTE_REGISTRY.filter(
        (route) => route.path.startsWith("/content") && route.menuPermission !== null,
      ).map((route) => ({
        path: route.path,
        menuPermission: route.menuPermission,
        parentPath: route.parentPath,
        menuLabel: route.menuLabel,
      })),
    ).toEqual([
      {
        path: "/content",
        menuPermission: "content.view",
        parentPath: null,
        menuLabel: "悬赏管理",
      },
      {
        path: "/content/posts",
        menuPermission: "content.post.view",
        parentPath: "/content",
        menuLabel: "帖子管理",
      },
      {
        path: "/content/articles",
        menuPermission: "content.article.view",
        parentPath: "/content",
        menuLabel: "文章管理",
      },
    ]);

    const permissions = ["content.view", "content.post.view", "content.article.view"];

    expect(getVisibleRootMenuRoutes(permissions).map((route) => route.path)).toContain("/content");
    expect(getVisibleChildMenuRoutes("/content", permissions).map((route) => route.path)).toEqual([
      "/content/posts",
      "/content/articles",
    ]);
  });

  it("registers article create and edit routes with write permission", () => {
    expect(ADMIN_ROUTE_REGISTRY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/content/articles/new",
          requiredPermissions: ["content.article.write"],
          parentPath: "/content/articles",
          menuPermission: null,
        }),
        expect.objectContaining({
          path: "/content/articles/:id/edit",
          requiredPermissions: ["content.article.write"],
          parentPath: "/content/articles",
          menuPermission: null,
        }),
      ]),
    );
  });

  it("registers the post detail route with read-only page permission", () => {
    expect(ADMIN_ROUTE_REGISTRY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/content/posts/:id",
          requiredPermissions: ["content.post.view"],
          parentPath: "/content/posts",
          menuPermission: null,
        }),
      ]),
    );
  });

  it("registers the RBAC list, create, edit, and detail views behind the single menu entry", () => {
    expect(
      ADMIN_ROUTE_REGISTRY.filter((route) => route.path.startsWith("/rbac")).map((route) => ({
        path: route.path,
        menuPermission: route.menuPermission,
        requiredPermissions: route.requiredPermissions,
      })),
    ).toEqual([
      {
        path: "/rbac",
        menuPermission: "rbac.view",
        requiredPermissions: ["rbac.view"],
      },
      {
        path: "/rbac/catalog",
        menuPermission: "rbac.catalog.view",
        requiredPermissions: ["rbac.catalog.view"],
      },
      {
        path: "/rbac/new",
        menuPermission: null,
        requiredPermissions: ["rbac.view"],
      },
      {
        path: "/rbac/:id/edit",
        menuPermission: null,
        requiredPermissions: ["rbac.view"],
      },
      {
        path: "/rbac/:id",
        menuPermission: null,
        requiredPermissions: ["rbac.view"],
      },
    ]);
  });
});

function requireElement(node: ReactNode): ReactElement<{ children?: ReactNode; label?: string }> {
  if (!isValidElement(node)) {
    throw new Error("Expected route metadata to contain a React element");
  }

  return node as ReactElement<{ children?: ReactNode; label?: string }>;
}
