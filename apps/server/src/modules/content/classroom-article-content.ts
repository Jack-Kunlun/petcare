import type { WebsitePublicMediaAsset } from "@petcare/shared-types";
import sanitizeHtml from "sanitize-html";
import { classroomArticleInvalidContent } from "./classroom-article.errors";

/** Prefix that distinguishes v1 sanitized classroom rich text from legacy plain text. */
export const ARTICLE_RICH_TEXT_PREFIX = "PETCARE_CLASSROOM_RICH_TEXT_V1\n";

const MAX_BODY_LENGTH = 200_000;
const MAX_IMAGES = 50;

/** Normalized article HTML and its version-prefixed storage representation. */
export interface EncodedArticleBody {
  /** Sanitized rich-text HTML safe for the website renderer. */
  bodyHtml: string;
  /** Version-prefixed content persisted in the existing classroom article column. */
  storedContent: string;
}

type ResolveAssets = (
  assetIds: readonly string[],
) => Promise<ReadonlyMap<string, WebsitePublicMediaAsset>>;

type ArticleImage = { assetId: string; src: string };

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
    bodyHtml: cleaned,
    storedContent: `${ARTICLE_RICH_TEXT_PREFIX}${cleaned}`,
  };
}

/** Decodes stored classroom article content into safe HTML, escaping every legacy line. */
export async function decodeArticleBody(
  content: string,
  resolveAssets: ResolveAssets,
): Promise<string> {
  if (content.startsWith(ARTICLE_RICH_TEXT_PREFIX)) {
    return (await encodeArticleBody(content.slice(ARTICLE_RICH_TEXT_PREFIX.length), resolveAssets))
      .bodyHtml;
  }

  return content
    .split(/\r?\n/u)
    .map((line) => (line.length > 0 ? `<p>${escapeHtml(line)}</p>` : "<p><br /></p>"))
    .join("");
}

/** Returns whether HTML contains safe visible text or a syntactically valid managed-image reference. */
export function isPublishableArticleBody(bodyHtml: string): boolean {
  if (bodyHtml.length > MAX_BODY_LENGTH) {
    return false;
  }

  const images: ArticleImage[] = [];
  const cleaned = sanitizeArticleHtml(bodyHtml, images);

  if (cleaned.length > MAX_BODY_LENGTH || images.length > MAX_IMAGES) {
    return false;
  }

  const visibleText = sanitizeHtml(cleaned, { allowedTags: [], allowedAttributes: {} })
    .replace(/(?:&nbsp;|&#160;|\u00a0)/giu, "")
    .trim();

  return (
    visibleText.length > 0 || images.some((image) => Boolean(image.assetId) && isHttpUrl(image.src))
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(String.fromCharCode(34), "&quot;")
    .replaceAll("'", "&#39;");
}
