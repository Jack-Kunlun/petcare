import type { WebsiteContentKey, WebsitePublicContent } from "@petcare/shared-types";
import { rawRequest } from "./request";

export function getPublishedContent(contentKey: WebsiteContentKey): Promise<WebsitePublicContent> {
  return rawRequest<WebsitePublicContent>(`/website-content/${encodeURIComponent(contentKey)}`);
}
