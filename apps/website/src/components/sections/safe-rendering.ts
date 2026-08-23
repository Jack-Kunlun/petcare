import type { WebsitePublicMediaAsset } from "@petcare/shared-types";

/** Approved bundled media used only when a public managed image is unavailable. */
const FALLBACK_IMAGES = {
  hero: {
    src: "/brand/hero-trusted-care-desktop-v1.webp",
    width: 1920,
    height: 720,
  },
  placeholder: {
    src: "/brand/petcare-placeholder-light.svg",
    width: 1600,
    height: 900,
  },
  professionalCare: {
    src: "/brand/hero-professional-care-desktop-v1.webp",
    width: 1920,
    height: 720,
  },
  communityCompanion: {
    src: "/brand/hero-community-companion-desktop-v1.webp",
    width: 1920,
    height: 720,
  },
} as const;

/** A safe image source and intrinsic dimensions for layout-stable Astro output. */
export interface PublicImage {
  /** Public HTTPS or app-local image source. */
  src: string;
  /** Intrinsic image width. */
  width: number;
  /** Intrinsic image height. */
  height: number;
}

/** Checks that public image metadata is usable directly in an Astro image element. */
export function hasPublicImage(
  asset:
    | WebsitePublicMediaAsset
    | null
    | undefined
    | { url?: unknown; width?: unknown; height?: unknown },
): asset is WebsitePublicMediaAsset {
  if (!asset) {
    return false;
  }

  return (
    typeof asset.url === "string" &&
    asset.url.startsWith("https://") &&
    Number.isInteger(asset.width) &&
    typeof asset.width === "number" &&
    asset.width > 0 &&
    Number.isInteger(asset.height) &&
    typeof asset.height === "number" &&
    asset.height > 0
  );
}

/** Returns only the bounded link protocols accepted by the Website Content contract. */
export function getSafeWebsiteHref(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !hasControlCharacter(value)
  ) {
    return value;
  }

  try {
    const url = new URL(value);

    return ["https:", "mailto:", "tel:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);

    return code <= 31 || code === 127;
  });
}

/** Resolves public media when it is valid, otherwise returns an immutable approved fallback. */
export function getPublicImage(
  asset:
    | WebsitePublicMediaAsset
    | null
    | undefined
    | { url?: unknown; width?: unknown; height?: unknown },
  fallback: keyof typeof FALLBACK_IMAGES,
): PublicImage {
  if (hasPublicImage(asset)) {
    return { src: asset.url, width: asset.width, height: asset.height };
  }

  return FALLBACK_IMAGES[fallback];
}
