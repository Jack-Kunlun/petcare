import type { WebsiteContentKey, WebsitePublicContent } from "@petcare/shared-types";

/** Signals that the Website has no safe published snapshot to render. */
export class PublishedContentUnavailableError extends Error {
  constructor(contentKey: WebsiteContentKey) {
    super(`No recent published Website Content is available for ${contentKey}`);
    this.name = "PublishedContentUnavailableError";
  }
}

/** Dependencies for the bounded, process-local published-content fallback. */
export interface PublishedContentCacheOptions {
  /** Maximum allowed snapshot age in milliseconds. */
  ttlMilliseconds: number;
  /** Clock seam for deterministic fallback tests. */
  now?: () => number;
}

interface CachedPublishedContent {
  snapshot: WebsitePublicContent;
  storedAt: number;
}

/**
 * Holds only recent, successfully retrieved public snapshots in one SSR process.
 *
 * It deliberately has no timer, cross-process coordination, or promise cache: a
 * published pointer remains authoritative and each request chooses its own result.
 */
export class PublishedContentCache {
  private readonly entries = new Map<WebsiteContentKey, CachedPublishedContent>();
  private readonly now: () => number;

  constructor(private readonly options: PublishedContentCacheOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Stores a verified published snapshot after a successful public API response. */
  store(snapshot: WebsitePublicContent): void {
    if (!isPublishedSnapshot(snapshot)) {
      throw new TypeError("PublishedContentCache accepts only published snapshots");
    }

    this.entries.set(snapshot.contentKey, { snapshot, storedAt: this.now() });
  }

  /** Reads one still-fresh published snapshot or signals that SSR must render a 503 page. */
  read(contentKey: WebsiteContentKey): WebsitePublicContent {
    const entry = this.entries.get(contentKey);

    if (!entry || this.now() - entry.storedAt > this.options.ttlMilliseconds) {
      throw new PublishedContentUnavailableError(contentKey);
    }

    return entry.snapshot;
  }
}

function isPublishedSnapshot(snapshot: unknown): snapshot is WebsitePublicContent {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  const candidate = snapshot as Partial<WebsitePublicContent>;

  return (
    typeof candidate.contentKey === "string" &&
    typeof candidate.businessVersion === "number" &&
    typeof candidate.publishedAt === "string" &&
    Array.isArray(candidate.sections)
  );
}
