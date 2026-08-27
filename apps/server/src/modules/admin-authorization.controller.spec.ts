import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AccessTokenGuard } from "../auth/access-token.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { PERMISSIONS_METADATA_KEY } from "../auth/permissions.decorator";
import { AdminUserController } from "./user/admin-user.controller";

describe("current administration controller authorization", () => {
  it("uses access-token then permission guards and the precise user read permission", () => {
    const permissions = <T>(controller: object, method: T) =>
      Reflect.getMetadata(PERMISSIONS_METADATA_KEY, controller[method as keyof typeof controller]);

    expect(Reflect.getMetadata(GUARDS_METADATA, AdminUserController)).toEqual([
      AccessTokenGuard,
      PermissionGuard,
    ]);
    expect(permissions(AdminUserController.prototype, "findAll")).toEqual(["user.read"]);
  });
});
