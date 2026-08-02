import { describe, expect, it } from "vitest";
import {
  RBAC_PERMISSION_CATALOG,
  RBAC_PERMISSION_TYPES,
  getRbacUiPermissionCodes,
} from "./permission-catalog";

describe("RBAC permission catalog", () => {
  it("keeps permission codes, menu routes, and references internally consistent", () => {
    const byCode = new Map(
      RBAC_PERMISSION_CATALOG.map((permission) => [permission.code, permission]),
    );
    const menuPaths = RBAC_PERMISSION_CATALOG.filter(
      (permission) => permission.type === RBAC_PERMISSION_TYPES.MENU && permission.path !== null,
    ).map((permission) => permission.path);

    expect(byCode.size).toBe(RBAC_PERMISSION_CATALOG.length);
    expect(new Set(menuPaths).size).toBe(menuPaths.length);
    expect(menuPaths).toEqual([
      "/",
      "/users",
      "/users/certifications",
      "/orders",
      "/orders/complaints",
      "/settings",
      "/rbac",
    ]);

    expect(byCode.get("rbac.view")?.impliedApiCodes).toContain("rbac.permission.read");

    for (const permission of RBAC_PERMISSION_CATALOG) {
      if (permission.type === RBAC_PERMISSION_TYPES.MENU) {
        expect(permission.path).not.toBeNull();
        expect(permission.icon).not.toBeNull();
      } else {
        expect(permission.path).toBeNull();
        expect(permission.icon).toBeNull();
      }

      if (permission.parentCode !== null) {
        expect(byCode.get(permission.parentCode)?.type).toBe(RBAC_PERMISSION_TYPES.MENU);
      }

      for (const apiCode of permission.impliedApiCodes) {
        expect(byCode.get(apiCode)?.type).toBe(RBAC_PERMISSION_TYPES.API);
      }
    }
  });

  it("exposes only menu and button permissions as editable UI permissions", () => {
    const uiCodes = getRbacUiPermissionCodes();

    expect(uiCodes).toEqual(
      RBAC_PERMISSION_CATALOG.filter(
        (permission) => permission.type !== RBAC_PERMISSION_TYPES.API,
      ).map((permission) => permission.code),
    );
    expect(uiCodes).not.toContain("rbac.role.read");
  });
});
