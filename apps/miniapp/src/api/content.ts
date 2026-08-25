import type { WebsiteContentKey, WebsitePublicContent } from "@petcare/shared-types";
import { rawRequest } from "./request";

/** Reads the currently published public snapshot for one managed content key. */
export function getPublishedContent(contentKey: WebsiteContentKey): Promise<WebsitePublicContent> {
  return rawRequest<WebsitePublicContent>(`/website-content/${encodeURIComponent(contentKey)}`);
}
