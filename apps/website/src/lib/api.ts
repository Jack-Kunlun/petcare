import type {
  PublicClassroomArticleDetail,
  PublicClassroomArticleListQuery,
  PublicClassroomArticleListResponse,
  WebsiteContentKey,
  WebsitePublicContent,
} from "@petcare/shared-types";

/** Public-safe draft snapshot returned only after a valid preview capability exchange. */
export type WebsitePreviewContent = Omit<
  WebsitePublicContent,
  "businessVersion" | "publishedAt"
> & {
  /** Immutable draft revision fixed when the preview capability was created. */
  revision: number;
};

/** Error raised when the Website cannot safely read a content snapshot from Nest. */
export class WebsiteContentApiError extends Error {
  constructor(
    /** HTTP status supplied by the upstream service or the Website gateway. */
    readonly status: number,
    /** Stable upstream error code or Website transport failure code. */
    readonly code: string,
    /** Server request identifier when one was available. */
    readonly requestId?: string,
  ) {
    super(`Website Content API request failed: ${code}`);
    this.name = "WebsiteContentApiError";
  }
}

/** Server-only Nest public-content client configuration. */
export interface WebsiteContentApiOptions {
  /** Private Nest API base URL. */
  baseUrl: string;
  /** Fetch seam for SSR tests. */
  fetcher?: typeof fetch;
  /** Maximum upstream read duration in milliseconds. */
  timeoutMs?: number;
}

/** Server-only client for published Website Content and capability-scoped previews. */
export interface WebsiteContentApi {
  /** Reads the currently published immutable snapshot. */
  getPublished(contentKey: WebsiteContentKey): Promise<WebsitePublicContent>;
  /** Reads a fixed draft snapshot with a preview capability header. */
  getPreview(contentKey: WebsiteContentKey, token: string): Promise<WebsitePreviewContent>;
  /** Reads one public page of published classroom article summaries. */
  getArticles(query: PublicClassroomArticleListQuery): Promise<PublicClassroomArticleListResponse>;
  /** Reads one published classroom article by its stable public route value. */
  getArticle(slug: string): Promise<PublicClassroomArticleDetail>;
}

interface WebsiteApiEnvelope<T> {
  code: string;
  message: string;
  data: T;
  meta: { requestId: string; timestamp: string };
}

const DEFAULT_TIMEOUT_MS = 5_000;

/** Creates a private SSR client that always unwraps the repository's response envelope. */
export function createWebsiteContentApi({
  baseUrl,
  fetcher = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: WebsiteContentApiOptions): WebsiteContentApi {
  const normalizedBaseUrl = baseUrl.replace(/\/$/u, "");

  return {
    getPublished(contentKey) {
      return request<WebsitePublicContent>(
        fetcher,
        `${normalizedBaseUrl}/website-content/${encodeURIComponent(contentKey)}`,
        timeoutMs,
      );
    },
    getPreview(contentKey, token) {
      return request<WebsitePreviewContent>(
        fetcher,
        `${normalizedBaseUrl}/website-content/previews/${encodeURIComponent(contentKey)}`,
        timeoutMs,
        { "X-Website-Preview-Token": token },
      );
    },
    getArticles({ page, pageSize }) {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });

      return request<PublicClassroomArticleListResponse>(
        fetcher,
        `${normalizedBaseUrl}/content/articles?${query.toString()}`,
        timeoutMs,
      );
    },
    getArticle(slug) {
      return request<PublicClassroomArticleDetail>(
        fetcher,
        `${normalizedBaseUrl}/content/articles/${encodeURIComponent(slug)}`,
        timeoutMs,
      );
    },
  };
}

async function request<T>(
  fetcher: typeof fetch,
  url: string,
  timeoutMs: number,
  headers?: HeadersInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetcher(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new WebsiteContentApiError(503, "WEBSITE_CONTENT_UPSTREAM_UNAVAILABLE");
  }

  const envelope = await readEnvelope<T>(response);

  if (!response.ok) {
    throw new WebsiteContentApiError(response.status, envelope.code, envelope.meta.requestId);
  }

  if (envelope.code !== "SUCCESS") {
    throw new WebsiteContentApiError(response.status, envelope.code, envelope.meta.requestId);
  }

  return envelope.data;
}

async function readEnvelope<T>(response: Response): Promise<WebsiteApiEnvelope<T>> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new WebsiteContentApiError(response.status, "WEBSITE_CONTENT_INVALID_RESPONSE");
  }

  if (!isEnvelope(payload)) {
    throw new WebsiteContentApiError(response.status, "WEBSITE_CONTENT_INVALID_RESPONSE");
  }

  return payload as WebsiteApiEnvelope<T>;
}

function isEnvelope(value: unknown): value is WebsiteApiEnvelope<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WebsiteApiEnvelope<unknown>>;

  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    "data" in candidate &&
    typeof candidate.meta?.requestId === "string" &&
    typeof candidate.meta.timestamp === "string"
  );
}
