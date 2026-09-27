import { WEBSITE_CONTENT_KEY, type CurrentWebsiteContentKey } from "@petcare/shared-types";

/** Support and legal units shared by the Website and Miniapp public experiences. */
export const SHARED_CONTENT_KEYS = [
  WEBSITE_CONTENT_KEY.CONTACT,
  WEBSITE_CONTENT_KEY.HELP,
  WEBSITE_CONTENT_KEY.PRIVACY,
  WEBSITE_CONTENT_KEY.TERMS,
] as const satisfies readonly CurrentWebsiteContentKey[];

/** Human-readable labels for every managed content unit. */
export const MANAGED_CONTENT_LABELS = {
  site_shell: "全站导航与页脚",
  home: "官网首页",
  about: "关于我们",
  contact: "联系客服",
  help: "帮助中心",
  privacy: "隐私协议",
  terms: "服务条款",
} satisfies Record<CurrentWebsiteContentKey, string>;

/** Returns the overview route that owns one content key in the Admin information architecture. */
export function getContentOverviewPath(_contentKey: CurrentWebsiteContentKey): string {
  return "/shared-content";
}

/** Returns the visible name of the Admin area that owns one content key. */
export function getContentAreaLabel(_contentKey: CurrentWebsiteContentKey): string {
  return "公共内容配置";
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
