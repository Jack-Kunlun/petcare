import { RBAC_PERMISSION_CATALOG, RBAC_PERMISSION_TYPES } from "@petcare/shared-types";
import { describe, expect, it } from "vitest";
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
    ).toEqual(["/settings"]);
    expect(
      getVisibleChildMenuRoutes("/settings", ["system.view", "rbac.view", "rbac.catalog.view"]).map(
        (route) => route.path,
      ),
    ).toEqual(["/rbac", "/rbac/catalog"]);
  });

  it("registers the menu catalog page behind its shared menu permission", () => {
    expect(ADMIN_ROUTE_REGISTRY.find((route) => route.path === "/rbac/catalog")).toMatchObject({
      menuPermission: "rbac.catalog.view",
      requiredPermissions: ["rbac.catalog.view"],
      parentPath: "/settings",
    });
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
