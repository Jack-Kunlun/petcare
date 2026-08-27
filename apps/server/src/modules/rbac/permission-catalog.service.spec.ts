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

    expect(() => service.validateUiPermissionCodes(["website.read"])).toThrow(
      "API 权限不能由角色编辑界面直接授权：website.read",
    );
  });

  it("rejects a catalog button whose parent is not a menu permission", () => {
    const invalidButton: RbacPermissionDefinition = {
      code: "invalid.button",
      type: RBAC_PERMISSION_TYPES.BUTTON,
      label: "Invalid button",
      module: "invalid",
      path: null,
      parentCode: "website.read",
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
      parentCode: "website.view",
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
      service.expandToEffectiveCodes(["website.publish", "website.view", "website.publish"]),
    ).toEqual(["website.publish", "website.publish_action", "website.read", "website.view"]);
  });

  it("expands the RBAC menu permission to the catalog API needed to read its directory", () => {
    const service = new PermissionCatalogService();

    expect(service.expandToEffectiveCodes(["rbac.view"])).toEqual([
      "rbac.permission.read",
      "rbac.role.read",
      "rbac.view",
    ]);
  });

  it("warns with the catalog version when persisted permission codes are orphaned", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { permissionCode: "website.view" },
        { permissionCode: "system.view" },
        { permissionCode: "retired.permission" },
        { permissionCode: "retired.permission" },
      ]);
    const write = jest.fn();
    const service = new PermissionCatalogService(
      RBAC_PERMISSION_CATALOG,
      {
        permission: { findMany },
      } as never,
      { write } as never,
    );

    await service.onModuleInit();

    expect(findMany).toHaveBeenCalledWith({ select: { permissionCode: true } });
    expect(write).toHaveBeenCalledWith("warn", "rbac.permission_catalog_orphans", {
      catalogVersion: service.getVersion(),
      permissionCodes: ["retired.permission", "system.view"],
    });
  });
});
