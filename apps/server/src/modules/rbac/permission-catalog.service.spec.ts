import {
  RBAC_PERMISSION_CATALOG,
  RBAC_PERMISSION_TYPES,
  type RbacPermissionDefinition,
} from "@petcare/shared-types";
import { PermissionCatalogService } from "./permission-catalog.service";

describe("PermissionCatalogService", () => {
  it("rejects UI permission codes that are absent from the shared catalog", () => {
    const service = new PermissionCatalogService();

    expect(() => service.validateUiPermissionCodes(["retired.permission"])).toThrow(
      "权限代码不存在于当前目录：retired.permission",
    );
  });

  it("rejects API permissions submitted from the role editing UI", () => {
    const service = new PermissionCatalogService();

    expect(() => service.validateUiPermissionCodes(["system.read"])).toThrow(
      "API 权限不能由角色编辑界面直接授权：system.read",
    );
  });

  it("rejects a catalog button whose parent is not a menu permission", () => {
    const invalidButton: RbacPermissionDefinition = {
      code: "invalid.button",
      type: RBAC_PERMISSION_TYPES.BUTTON,
      label: "Invalid button",
      module: "invalid",
      path: null,
      parentCode: "system.read",
      order: 1,
      icon: null,
      impliedApiCodes: [],
    };

    expect(() => new PermissionCatalogService([...RBAC_PERMISSION_CATALOG, invalidButton])).toThrow(
      "权限目录中的父级关系无效：invalid.button",
    );
  });

  it("rejects a catalog button without a parent menu", () => {
    const parentlessButton: RbacPermissionDefinition = {
      code: "invalid.parentless_button",
      type: RBAC_PERMISSION_TYPES.BUTTON,
      label: "Parentless button",
      module: "invalid",
      path: null,
      parentCode: null,
      order: 1,
      icon: null,
      impliedApiCodes: [],
    };

    expect(
      () => new PermissionCatalogService([...RBAC_PERMISSION_CATALOG, parentlessButton]),
    ).toThrow("权限目录中的父级关系无效：invalid.parentless_button");
  });

  it("rejects an API permission with a parent menu", () => {
    const nestedApi: RbacPermissionDefinition = {
      code: "invalid.nested_api",
      type: RBAC_PERMISSION_TYPES.API,
      label: "Nested API",
      module: "invalid",
      path: null,
      parentCode: "system.view",
      order: 1,
      icon: null,
      impliedApiCodes: [],
    };

    expect(() => new PermissionCatalogService([...RBAC_PERMISSION_CATALOG, nestedApi])).toThrow(
      "权限目录中的父级关系无效：invalid.nested_api",
    );
  });

  it("expands selected UI permissions to a sorted, de-duplicated API closure", () => {
    const service = new PermissionCatalogService();

    expect(
      service.expandToEffectiveCodes(["system.publish", "system.view", "system.publish"]),
    ).toEqual(["system.publish", "system.publish_action", "system.read", "system.view"]);
  });
});
