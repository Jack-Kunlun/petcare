import type { WebsitePublicMediaAsset } from "@petcare/shared-types";
import sanitizeHtml from "sanitize-html";
import { classroomArticleInvalidContent } from "./classroom-article.errors";

/** Prefix that distinguishes v1 sanitized classroom rich text from legacy plain text. */
export const ARTICLE_RICH_TEXT_PREFIX = "PETCARE_CLASSROOM_RICH_TEXT_V1\n";

const MAX_BODY_LENGTH = 200_000;
const MAX_IMAGES = 50;

declare const sanitizedArticleBodyHtmlBrand: unique symbol;

/**
 * Safe HTML emitted after this codec sanitizes rich text or escapes legacy plain text.
 * Any image in it has matched a managed asset, and the opaque brand blocks normal request strings
 * from reaching publishing checks.
 */
export type SanitizedArticleBodyHtml = string & {
  /** Compile-time marker that is created only by the private codec helper. */
  readonly [sanitizedArticleBodyHtmlBrand]: true;
};

/** Normalized article HTML and its version-prefixed storage representation. */
export interface EncodedArticleBody {
  /** Sanitized rich-text HTML safe for the website renderer. */
  bodyHtml: SanitizedArticleBodyHtml;
  /** Version-prefixed content persisted in the existing classroom article column. */
  storedContent: string;
}

type ResolveAssets = (
  assetIds: readonly string[],
) => Promise<ReadonlyMap<string, WebsitePublicMediaAsset>>;

type ArticleImage = { assetId: string; src: string };

/** Brands HTML only after a codec path has completed its safety checks. */
function toSanitizedArticleBodyHtml(bodyHtml: string): SanitizedArticleBodyHtml {
  return bodyHtml as SanitizedArticleBodyHtml;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowedLinkUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

function sanitizeArticleHtml(bodyHtml: string, images: ArticleImage[]): string {
  return sanitizeHtml(bodyHtml, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "strong",
      "em",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "br",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "rel"],
      img: ["src", "alt", "data-asset-id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    selfClosing: ["img", "br", "hr"],
    transformTags: {
      a: (_tagName, attributes) => {
        const href = attributes.href ?? "";

        return isAllowedLinkUrl(href)
          ? { tagName: "a", attribs: { href, rel: "noopener noreferrer" } }
          : { tagName: "a", attribs: {} };
      },
      img: (_tagName, attributes) => {
        const assetId = attributes["data-asset-id"] ?? "";
        const src = attributes.src ?? "";

        images.push({ assetId, src });

        return {
          tagName: "img",
          attribs: { src, alt: attributes.alt ?? "", "data-asset-id": assetId },
        };
      },
    },
    exclusiveFilter: (frame) => (frame.tag === "a" && !frame.attribs.href ? "excludeTag" : false),
  });
}

/** Sanitizes, verifies, and prefixes an administrator-provided classroom article body. */
export async function encodeArticleBody(
  bodyHtml: string,
  resolveAssets: ResolveAssets,
): Promise<EncodedArticleBody> {
  if (bodyHtml.length > MAX_BODY_LENGTH) {
    throw classroomArticleInvalidContent("文章正文过长");
  }

  const images: ArticleImage[] = [];
  const cleaned = sanitizeArticleHtml(bodyHtml, images);

  if (cleaned.length > MAX_BODY_LENGTH || images.length > MAX_IMAGES) {
    throw classroomArticleInvalidContent("文章正文超出允许范围");
  }

  if (images.some((image) => !image.assetId || !isHttpUrl(image.src))) {
    throw classroomArticleInvalidContent("正文图片地址无效");
  }

  const assetIds = [...new Set(images.map((image) => image.assetId))];
  const assets = assetIds.length > 0 ? await resolveAssets(assetIds) : new Map();

  if (
    images.some((image) => {
      const asset = assets.get(image.assetId);

      return asset?.id !== image.assetId || asset.url !== image.src;
    })
  ) {
    throw classroomArticleInvalidContent("正文图片地址无效");
  }

  return {
    bodyHtml: toSanitizedArticleBodyHtml(cleaned),
    storedContent: `${ARTICLE_RICH_TEXT_PREFIX}${cleaned}`,
  };
}

/** Decodes stored classroom article content into safe HTML, escaping every legacy line. */
export async function decodeArticleBody(
  content: string,
  resolveAssets: ResolveAssets,
): Promise<SanitizedArticleBodyHtml> {
  if (content.startsWith(ARTICLE_RICH_TEXT_PREFIX)) {
    return (await encodeArticleBody(content.slice(ARTICLE_RICH_TEXT_PREFIX.length), resolveAssets))
      .bodyHtml;
  }

  if (content.length > MAX_BODY_LENGTH) {
    throw classroomArticleInvalidContent("文章正文过长");
  }

  const legacyBodyHtml = content
    .split(/\r?\n/u)
    .map((line) => (line.length > 0 ? `<p>${escapeHtml(line)}</p>` : "<p><br /></p>"))
    .join("");

  if (legacyBodyHtml.length > MAX_BODY_LENGTH) {
    throw classroomArticleInvalidContent("文章正文过长");
  }

  return toSanitizedArticleBodyHtml(legacyBodyHtml);
}

/** Returns whether codec-produced safe HTML contains visible text or a verified managed image. */
export function isPublishableArticleBody(bodyHtml: SanitizedArticleBodyHtml): boolean {
  const visibleText = sanitizeHtml(bodyHtml, { allowedTags: [], allowedAttributes: {} })
    .replace(/(?:&nbsp;|&#160;|\u00a0)/giu, "")
    .trim();

  return visibleText.length > 0 || /<img\b/iu.test(bodyHtml);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(String.fromCharCode(34), "&quot;")
    .replaceAll("'", "&#39;");
}
