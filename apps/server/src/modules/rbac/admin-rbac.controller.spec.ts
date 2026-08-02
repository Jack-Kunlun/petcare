import { GUARDS_METADATA } from "@nestjs/common/constants";
import { SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { PermissionGuard } from "../../auth/permission.guard";
import { PERMISSIONS_METADATA_KEY } from "../../auth/permissions.decorator";
import { AdminRbacController } from "./admin-rbac.controller";
import { RbacService } from "./rbac.service";
import { RoleService } from "./role.service";

describe("AdminRbacController", () => {
  it("uses the access-token and permission guards with the required route permissions", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminRbacController) as unknown[];
    const permissions = (method: keyof AdminRbacController) =>
      Reflect.getMetadata(PERMISSIONS_METADATA_KEY, AdminRbacController.prototype[method]);

    expect(Reflect.getMetadata("path", AdminRbacController)).toBe("admin/rbac");
    expect(guards).toEqual([AccessTokenGuard, PermissionGuard]);
    expect(permissions("getCatalog")).toEqual(["rbac.permission.read"]);
    expect(permissions("listRoles")).toEqual(["rbac.view"]);
    expect(permissions("getRole")).toEqual(["rbac.view"]);
    expect(permissions("createRole")).toEqual(["rbac.role.create"]);
    expect(permissions("updateRole")).toEqual(["rbac.role.update"]);
    expect(permissions("deleteRole")).toEqual(["rbac.role.delete"]);
    expect(permissions("replacePermissions")).toEqual(["rbac.role.update"]);
    expect(permissions("getRoleUsers")).toEqual(["rbac.assign_role"]);
    expect(permissions("replaceRoleUsers")).toEqual(["rbac.assign_role"]);
  });

  it("documents every RBAC route with success schemas and standard errors", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminRbacController],
      providers: [
        { provide: RbacService, useValue: {} },
        { provide: RoleService, useValue: {} },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = moduleRef.createNestApplication();

    await app.init();
    const document = SwaggerModule.createDocument(app, {
      openapi: "3.0.0",
      info: { title: "test", version: "1" },
    });

    const operations = Object.values(document.paths).flatMap((path) =>
      Object.values(path ?? {}).filter(
        (operation) => operation && typeof operation === "object" && "responses" in operation,
      ),
    );

    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/admin/rbac/catalog",
        "/admin/rbac/roles",
        "/admin/rbac/roles/{id}",
        "/admin/rbac/roles/{id}/permissions",
        "/admin/rbac/roles/{id}/users",
      ]),
    );
    expect(operations).toHaveLength(9);

    for (const operation of operations) {
      expect(
        Object.prototype.hasOwnProperty.call(operation.responses, "200") ||
          Object.prototype.hasOwnProperty.call(operation.responses, "201"),
      ).toBe(true);
      expect(operation.responses).toHaveProperty("401");
      expect(operation.responses).toHaveProperty("403");
      expect(operation.responses).toHaveProperty("500");
      expect(operation.responses["200"] ?? operation.responses["201"]).toHaveProperty(
        "content.application/json.schema",
      );
    }

    expect(document.paths["/admin/rbac/roles"]?.post?.responses).toEqual(
      expect.objectContaining({ 400: expect.anything(), 409: expect.anything() }),
    );

    for (const path of [
      "/admin/rbac/roles/{id}",
      "/admin/rbac/roles/{id}/permissions",
      "/admin/rbac/roles/{id}/users",
    ]) {
      for (const operation of Object.values(document.paths[path] ?? {})) {
        if (operation && typeof operation === "object" && "responses" in operation) {
          expect(operation.responses).toHaveProperty("400");
          expect(operation.responses).toHaveProperty("404");
        }
      }
    }

    for (const operation of [
      document.paths["/admin/rbac/roles/{id}"]?.patch,
      document.paths["/admin/rbac/roles/{id}"]?.delete,
      document.paths["/admin/rbac/roles/{id}/permissions"]?.put,
      document.paths["/admin/rbac/roles/{id}/users"]?.put,
    ]) {
      expect(operation?.responses).toHaveProperty("409");
    }

    expect(document.paths["/admin/rbac/roles"]?.get?.responses?.["200"]).toHaveProperty(
      "content.application/json.schema.allOf.1.properties.data.$ref",
      "#/components/schemas/RbacRoleListResponseDto",
    );

    await app.close();
  });
});
