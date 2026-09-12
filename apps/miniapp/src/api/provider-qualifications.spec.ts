import { PROVIDER_QUALIFICATION_CONSENT_VERSION } from "@petcare/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedRequest, authorizedUpload } from "../state/session";
import {
  createQualificationDraft,
  getMyQualifications,
  submitQualification,
  uploadQualificationMaterial,
} from "./provider-qualifications";

vi.mock("../state/session", () => ({ authorizedRequest: vi.fn(), authorizedUpload: vi.fn() }));

describe("qualification API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses only authenticated private endpoints and sends explicit consent", async () => {
    await getMyQualifications();
    await createQualificationDraft("idempotency-key");
    await uploadQualificationMaterial("application-id", "id-front", "local-private-image");
    await submitQualification("application-id");

    expect(authorizedRequest).toHaveBeenCalledWith("/provider-qualifications/mine");
    expect(authorizedRequest).toHaveBeenCalledWith("/provider-qualifications", {
      method: "POST",
      data: { idempotencyKey: "idempotency-key" },
    });
    expect(authorizedUpload).toHaveBeenCalledWith(
      "/provider-qualifications/application-id/materials/id-front",
      "local-private-image",
      "file",
    );
    expect(authorizedRequest).toHaveBeenCalledWith(
      "/provider-qualifications/application-id/submit",
      {
        method: "POST",
        data: { consentVersion: PROVIDER_QUALIFICATION_CONSENT_VERSION, accepted: true },
      },
    );
  });
});
