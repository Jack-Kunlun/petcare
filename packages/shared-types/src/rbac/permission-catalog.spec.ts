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
      "/content",
      "/content/posts",
      "/content/articles",
      "/website-content",
      "/settings",
      "/rbac",
      "/rbac/catalog",
    ]);

    expect(byCode.get("rbac.view")?.impliedApiCodes).toContain("rbac.permission.read");
    expect(byCode.get("rbac.view")?.parentCode).toBeNull();
    expect(byCode.get("rbac.catalog.view")).toMatchObject({
      type: RBAC_PERMISSION_TYPES.MENU,
      path: "/rbac/catalog",
      parentCode: "rbac.view",
      impliedApiCodes: ["rbac.permission.read"],
    });

    expect(byCode.get("content.view")).toMatchObject({
      type: RBAC_PERMISSION_TYPES.MENU,
      path: "/content",
      parentCode: null,
      impliedApiCodes: ["content.reward.read"],
    });
    expect(byCode.get("content.post.view")).toMatchObject({
      type: RBAC_PERMISSION_TYPES.MENU,
      path: "/content/posts",
      parentCode: "content.view",
      impliedApiCodes: ["content.post.read"],
    });
    expect(byCode.get("content.article.view")).toMatchObject({
      type: RBAC_PERMISSION_TYPES.MENU,
      path: "/content/articles",
      parentCode: "content.view",
      impliedApiCodes: ["content.article.read"],
    });
    expect(byCode.get("content.article.write")).toMatchObject({
      type: RBAC_PERMISSION_TYPES.BUTTON,
      parentCode: "content.article.view",
      impliedApiCodes: ["content.article.read", "content.article.write_action"],
    });
    expect(byCode.get("content.article.publish")).toMatchObject({
      type: RBAC_PERMISSION_TYPES.BUTTON,
      parentCode: "content.article.view",
      impliedApiCodes: ["content.article.read", "content.article.publish_action"],
    });
    expect(byCode.get("content.article.write_action")?.type).toBe(RBAC_PERMISSION_TYPES.API);
    expect(byCode.get("content.article.publish_action")?.type).toBe(RBAC_PERMISSION_TYPES.API);

    expect(byCode.get("website.view")).toMatchObject({
      type: RBAC_PERMISSION_TYPES.MENU,
      label: "官网设置",
      path: "/website-content",
      parentCode: null,
      impliedApiCodes: ["website.read"],
    });
    expect(byCode.get("website.edit")).toMatchObject({
      type: RBAC_PERMISSION_TYPES.BUTTON,
      parentCode: "website.view",
      impliedApiCodes: ["website.read", "website.edit_action"],
    });
    expect(byCode.get("website.publish")).toMatchObject({
      type: RBAC_PERMISSION_TYPES.BUTTON,
      parentCode: "website.view",
      impliedApiCodes: ["website.read", "website.publish_action"],
    });

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
