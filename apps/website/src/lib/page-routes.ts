import { WEBSITE_CONTENT_KEY, type WebsiteContentKey } from "@petcare/shared-types";

/** Fixed public routes; content publishing never changes navigation ownership. */
export const PAGE_CONTENT_BY_PATH = {
  "/": WEBSITE_CONTENT_KEY.HOME,
  "/about": WEBSITE_CONTENT_KEY.ABOUT,
  "/contact": WEBSITE_CONTENT_KEY.CONTACT,
  "/privacy": WEBSITE_CONTENT_KEY.PRIVACY,
  "/terms": WEBSITE_CONTENT_KEY.TERMS,
} as const satisfies Record<string, WebsiteContentKey>;
