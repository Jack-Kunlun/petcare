/** Qualification workflow states; only reviewed applications grant eligibility. */
export const PROVIDER_QUALIFICATION_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  REVOKED: "revoked",
  EXPIRED: "expired",
  WITHDRAWN: "withdrawn",
} as const;

/** A qualification workflow state. */
export type ProviderQualificationStatus =
  (typeof PROVIDER_QUALIFICATION_STATUS)[keyof typeof PROVIDER_QUALIFICATION_STATUS];

/** Material kinds required before submitting an application. */
export const PROVIDER_QUALIFICATION_MATERIAL_KIND = {
  ID_FRONT: "id-front",
  ID_BACK: "id-back",
  TRAINING: "training",
} as const;

/** One private qualification material category. */
export type ProviderQualificationMaterialKind =
  (typeof PROVIDER_QUALIFICATION_MATERIAL_KIND)[keyof typeof PROVIDER_QUALIFICATION_MATERIAL_KIND];

/** Current published consent text version shown to applicants. */
export const PROVIDER_QUALIFICATION_CONSENT_VERSION = "2026-09-12";

/** Safe application summary; never includes storage keys or identity images. */
export interface ProviderQualificationSummary {
  /** Opaque application identifier. */
  id: string;
  /** Applicant's own account identifier. */
  applicantId: string;
  /** Current server-side workflow state. */
  status: ProviderQualificationStatus;
  /** Material categories present in the private store. */
  materialKinds: ProviderQualificationMaterialKind[];
  /** Time the user accepted the published material-processing notice. */
  consentedAt: string | null;
  /** Review or revocation explanation visible to the applicant. */
  decisionReason: string | null;
  /** Time the application was created. */
  createdAt: string;
  /** Time of the latest change. */
  updatedAt: string;
}

/** A review event without sensitive material coordinates. */
export interface ProviderQualificationAuditEvent {
  /** Event identifier. */
  id: string;
  /** Operator or applicant account identifier. */
  actorId: string;
  /** Recorded transition action. */
  action: string;
  /** Previous workflow state, absent for creation. */
  fromStatus: ProviderQualificationStatus | null;
  /** State after the action. */
  toStatus: ProviderQualificationStatus;
  /** Human explanation when the action requires one. */
  reason: string | null;
  /** Event timestamp. */
  createdAt: string;
}

/** Review detail visible only to authorized qualification reviewers. */
export interface AdminProviderQualificationDetail extends ProviderQualificationSummary {
  /** Applicant display name, not a verified legal name. */
  applicantNickname: string;
  /** Applicant phone number used to establish account completeness. */
  applicantPhone: string | null;
  /** Account identifier that made the review decision, if any. */
  reviewedById: string | null;
  /** Review timestamp, if any. */
  reviewedAt: string | null;
  /** Recorded independent verification method, if approved. */
  verificationMethod: string | null;
  /** Reference in the reviewer's verification system, if approved. */
  verificationReference: string | null;
  /** Append-only transition history. */
  events: ProviderQualificationAuditEvent[];
}
