import { PERMISSIONS_METADATA_KEY } from "../../auth/permissions.decorator";
import { ConfigService } from "../../config/config.service";
import {
  AdminProviderQualificationController,
  QualificationFeatureGuard,
} from "./provider-qualification.controller";

describe("qualification route boundary", () => {
  it("returns not found while the independent workflow switch is closed", () => {
    const guard = new QualificationFeatureGuard({
      qualificationWorkflowEnabled: false,
    } as ConfigService);

    expect(() => guard.canActivate({} as never)).toThrow(expect.objectContaining({ status: 404 }));
  });

  it("requires a separate permission to read private material", () => {
    const permissions = Reflect.getMetadata(
      PERMISSIONS_METADATA_KEY,
      AdminProviderQualificationController.prototype.material,
    );

    expect(permissions).toEqual(["provider_qualification.material_read"]);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_METADATA_KEY,
        AdminProviderQualificationController.prototype.review,
      ),
    ).toEqual(["provider_qualification.review_action"]);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_METADATA_KEY,
        AdminProviderQualificationController.prototype.revoke,
      ),
    ).toEqual(["provider_qualification.revoke_action"]);
  });
});
