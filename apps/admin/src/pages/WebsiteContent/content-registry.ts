import { WEBSITE_CONTENT_KEY, type CurrentWebsiteContentKey } from "@petcare/shared-types";

/** Support and legal units kept for the Miniapp public experience. */
export const SHARED_CONTENT_KEYS = [
  WEBSITE_CONTENT_KEY.CONTACT,
  WEBSITE_CONTENT_KEY.HELP,
  WEBSITE_CONTENT_KEY.PRIVACY,
  WEBSITE_CONTENT_KEY.TERMS,
] as const satisfies readonly CurrentWebsiteContentKey[];

/** Human-readable labels for every managed content unit. */
export const MANAGED_CONTENT_LABELS = {
  site_shell: "历史公共壳层（不再驱动官网）",
  home: "历史首页内容（不再驱动官网）",
  about: "历史关于内容（不再驱动官网）",
  contact: "小程序联系客服",
  help: "小程序帮助中心",
  privacy: "小程序隐私协议",
  terms: "小程序服务条款",
} satisfies Record<CurrentWebsiteContentKey, string>;

/** Returns the overview route that owns one content key in the Admin information architecture. */
export function getContentOverviewPath(_contentKey: CurrentWebsiteContentKey): string {
  return "/shared-content";
}

/** Returns the visible name of the Admin area that owns one content key. */
export function getContentAreaLabel(_contentKey: CurrentWebsiteContentKey): string {
  return "客服与协议";
}

/** Returns the editor route for one managed content key. */
export function getContentEditPath(contentKey: CurrentWebsiteContentKey): string {
  return `${getContentOverviewPath(contentKey)}/${contentKey}/edit`;
}

/** Returns the immutable history route for one managed content version. */
export function getContentHistoryPath(
  contentKey: CurrentWebsiteContentKey,
  versionId: string,
): string {
  return `${getContentOverviewPath(contentKey)}/${contentKey}/history/${versionId}`;
}
