import { RBAC_PERMISSION_CATALOG, RBAC_PERMISSION_TYPES } from "@petcare/shared-types";
import { describe, expect, it } from "vitest";
import { ADMIN_ROUTE_REGISTRY, getVisibleMenuRoutes } from "./registry";

describe("ADMIN_ROUTE_REGISTRY", () => {
  const menuPermissions = RBAC_PERMISSION_CATALOG.filter(
    (permission) => permission.type === RBAC_PERMISSION_TYPES.MENU,
  );

  it("registers every catalog menu path exactly once with its catalog permission", () => {
    for (const permission of menuPermissions) {
      const routes = ADMIN_ROUTE_REGISTRY.filter((route) => route.path === permission.path);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        menuPermission: permission.code,
        requiredPermissions: [permission.code],
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
});
