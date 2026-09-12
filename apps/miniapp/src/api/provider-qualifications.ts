import { PROVIDER_QUALIFICATION_CONSENT_VERSION } from "@petcare/shared-types";
import type {
  ProviderQualificationMaterialKind,
  ProviderQualificationSummary,
} from "@petcare/shared-types";
import { authorizedRequest, authorizedUpload } from "../state/session";

/** Reads only the authenticated applicant's safe qualification summaries. */
export function getMyQualifications(): Promise<ProviderQualificationSummary[]> {
  return authorizedRequest("/provider-qualifications/mine");
}

/** Creates an idempotent draft; the key is retained for retry by the caller. */
export function createQualificationDraft(
  idempotencyKey: string,
): Promise<ProviderQualificationSummary> {
  return authorizedRequest("/provider-qualifications", {
    method: "POST",
    data: { idempotencyKey },
  });
}

/** Uploads one local image to private storage; no object URL is returned. */
export function uploadQualificationMaterial(
  id: string,
  kind: ProviderQualificationMaterialKind,
  filePath: string,
): Promise<ProviderQualificationSummary> {
  return authorizedUpload(
    `/provider-qualifications/${encodeURIComponent(id)}/materials/${kind}`,
    filePath,
    "file",
  );
}

/** Captures an affirmative consent version with the final submission. */
export function submitQualification(id: string): Promise<ProviderQualificationSummary> {
  return authorizedRequest(`/provider-qualifications/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    data: { consentVersion: PROVIDER_QUALIFICATION_CONSENT_VERSION, accepted: true },
  });
}
