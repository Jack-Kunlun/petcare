import type { WebsiteContentKey, WebsitePublicContent } from "@petcare/shared-types";
import type { WebsitePreviewContent } from "./api";
import { PublishedContentCache } from "./published-content-cache";

/** Read boundary shared by the Website published and preview SSR loaders. */
export interface WebsiteContentReader {
  /** Reads the current public immutable snapshot. */
  getPublished(contentKey: WebsiteContentKey): Promise<WebsitePublicContent>;
  /** Reads one capability-scoped immutable draft snapshot. */
  getPreview(contentKey: WebsiteContentKey, token: string): Promise<WebsitePreviewContent>;
}

/** Minimum code-owned shell used only when published shell content cannot be read or recovered. */
export interface WebsiteShellFallback {
  /** Shell content identity. */
  contentKey: "site_shell";
  /** Safe, code-owned header and footer sections. */
  sections: unknown[];
}

/** Published Website page inputs rendered together by a fixed route. */
export interface PublishedPageContent {
  /** Current or recent public site shell. */
  shell: WebsitePublicContent | WebsiteShellFallback;
  /** Current or recent public route page snapshot. */
  page: WebsitePublicContent;
}

/** Capability-scoped Website page input rendered by a preview route. */
export interface PreviewPageContent {
  /** Fixed-preview route page snapshot. */
  page: WebsitePreviewContent;
}

/** Loads the independent public shell and page snapshots concurrently with bounded fallbacks. */
export async function loadPublishedPageContent({
  api,
  cache,
  contentKey,
  fallbackShell = DEFAULT_SHELL_FALLBACK,
}: {
  api: WebsiteContentReader;
  cache: PublishedContentCache;
  contentKey: Exclude<WebsiteContentKey, "site_shell">;
  fallbackShell?: WebsiteShellFallback;
}): Promise<PublishedPageContent> {
  const [shell, page] = await Promise.all([
    readPublishedWithShellFallback(api, cache, fallbackShell),
    readPublishedWithFallback(api, cache, contentKey),
  ]);

  return { shell, page };
}

/**
 * Loads the token-scoped draft page directly.
 *
 * Preview capabilities are deliberately bound to one content key, so the
 * separate site shell must remain code-owned on the preview route. Draft data
 * is never cached or recovered publicly.
 */
export async function loadPreviewPageContent({
  api,
  contentKey,
  token,
}: {
  api: WebsiteContentReader;
  contentKey: Exclude<WebsiteContentKey, "site_shell">;
  token: string;
}): Promise<PreviewPageContent> {
  const page = await api.getPreview(contentKey, token);

  return { page };
}

async function readPublishedWithShellFallback(
  api: WebsiteContentReader,
  cache: PublishedContentCache,
  fallbackShell: WebsiteShellFallback,
): Promise<WebsitePublicContent | WebsiteShellFallback> {
  try {
    return await readPublishedWithFallback(api, cache, "site_shell");
  } catch {
    return fallbackShell;
  }
}

async function readPublishedWithFallback(
  api: WebsiteContentReader,
  cache: PublishedContentCache,
  contentKey: WebsiteContentKey,
): Promise<WebsitePublicContent> {
  try {
    const snapshot = await api.getPublished(contentKey);

    cache.store(snapshot);

    return snapshot;
  } catch {
    return cache.read(contentKey);
  }
}

const DEFAULT_SHELL_FALLBACK: WebsiteShellFallback = {
  contentKey: "site_shell",
  sections: [],
};
