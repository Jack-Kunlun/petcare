import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AccessTokenGuard } from "../auth/access-token.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { PERMISSIONS_METADATA_KEY } from "../auth/permissions.decorator";
import { AdminComplaintController } from "./complaint-dispute/admin-complaint.controller";
import { AdminOrderController } from "./order/admin-order.controller";
import { AdminProviderCertificationController } from "./provider-certification/admin-provider-certification.controller";
import { AdminUserController } from "./user/admin-user.controller";

describe("existing administration controller authorization", () => {
  it("uses access-token then permission guards and precise read or mutation permissions", () => {
    const permissions = <T>(controller: object, method: T) =>
      Reflect.getMetadata(PERMISSIONS_METADATA_KEY, controller[method as keyof typeof controller]);

    expect(Reflect.getMetadata(GUARDS_METADATA, AdminUserController)).toEqual([
      AccessTokenGuard,
      PermissionGuard,
    ]);
    expect(permissions(AdminUserController.prototype, "findAll")).toEqual(["user.read"]);

    expect(Reflect.getMetadata(GUARDS_METADATA, AdminOrderController)).toEqual([
      AccessTokenGuard,
      PermissionGuard,
    ]);
    expect(permissions(AdminOrderController.prototype, "findAll")).toEqual(["order.read"]);

    expect(Reflect.getMetadata(GUARDS_METADATA, AdminProviderCertificationController)).toEqual([
      AccessTokenGuard,
      PermissionGuard,
    ]);
    expect(permissions(AdminProviderCertificationController.prototype, "findAll")).toEqual([
      "provider_certification.read",
    ]);
    expect(permissions(AdminProviderCertificationController.prototype, "findOne")).toEqual([
      "provider_certification.read",
    ]);
    expect(permissions(AdminProviderCertificationController.prototype, "approve")).toEqual([
      "user.approve_provider",
    ]);
    expect(permissions(AdminProviderCertificationController.prototype, "reject")).toEqual([
      "user.reject_provider",
    ]);

    expect(Reflect.getMetadata(GUARDS_METADATA, AdminComplaintController)).toEqual(
      expect.arrayContaining([AccessTokenGuard, PermissionGuard]),
    );

    for (const method of ["findAll", "findOne", "findExecutionTasks"] as const) {
      expect(permissions(AdminComplaintController.prototype, method)).toEqual(["dispute.read"]);
    }

    for (const method of [
      "claim",
      "transfer",
      "decideInitial",
      "decideFinal",
      "retryExecutionTask",
    ] as const) {
      expect(permissions(AdminComplaintController.prototype, method)).toEqual(["dispute.resolve"]);
    }
  });
});
