/** Internal lifecycle states retained for managed pet-photo cleanup. */
export const PET_MEDIA_STATUS = {
  /** The object is bound to one owner-controlled pet. */
  ACTIVE: "active",
  /** The database reference is gone and object deletion may be retried. */
  DISCARDED: "discarded",
} as const;
