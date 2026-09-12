import type {
  AdminProviderQualificationDetail,
  ProviderQualificationMaterialKind,
  ProviderQualificationStatus,
  ProviderQualificationSummary,
} from "@petcare/shared-types";
import { apiClient } from "./auth";

/** Lists one bounded server-side review queue. */
export async function fetchQualifications(
  status: ProviderQualificationStatus,
): Promise<ProviderQualificationSummary[]> {
  return (
    await apiClient.get<ProviderQualificationSummary[]>("/admin/provider-qualifications", {
      params: { status },
    })
  ).data;
}

/** Loads review provenance without private object coordinates. */
export async function fetchQualification(id: string): Promise<AdminProviderQualificationDetail> {
  return (
    await apiClient.get<AdminProviderQualificationDetail>(
      `/admin/provider-qualifications/${encodeURIComponent(id)}`,
    )
  ).data;
}

/** Returns authorized bytes, never a reusable public URL. */
export async function fetchQualificationMaterial(
  id: string,
  kind: ProviderQualificationMaterialKind,
): Promise<Blob> {
  return (
    await apiClient.get<Blob>(
      `/admin/provider-qualifications/${encodeURIComponent(id)}/materials/${kind}`,
      { responseType: "blob" },
    )
  ).data;
}

/** Records the human review decision and its independent verification reference. */
export async function reviewQualification(
  id: string,
  input: {
    decision: "approve" | "reject";
    reason: string;
    verificationMethod?: string;
    verificationReference?: string;
  },
): Promise<AdminProviderQualificationDetail> {
  return (
    await apiClient.post<AdminProviderQualificationDetail>(
      `/admin/provider-qualifications/${encodeURIComponent(id)}/review`,
      input,
    )
  ).data;
}

/** Revokes the same provider projection read by order eligibility. */
export async function revokeQualification(
  id: string,
  reason: string,
): Promise<AdminProviderQualificationDetail> {
  return (
    await apiClient.post<AdminProviderQualificationDetail>(
      `/admin/provider-qualifications/${encodeURIComponent(id)}/revoke`,
      { reason },
    )
  ).data;
}
