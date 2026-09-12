/** True only in builds that explicitly expose the already-verified commercial flow. */
export const commercialServicesEnabled =
  import.meta.env.VITE_COMMERCIAL_SERVICES_ENABLED?.trim().toLowerCase() === "true";

/** Independent, default-closed qualification application entry. */
export const qualificationWorkflowEnabled =
  import.meta.env.VITE_QUALIFICATION_WORKFLOW_ENABLED?.trim().toLowerCase() === "true";
