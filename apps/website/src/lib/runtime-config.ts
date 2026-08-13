/** Runtime configuration used exclusively by Website server modules. */
export interface WebsiteRuntimeConfig {
  /** Canonical public Website origin without a trailing slash. */
  publicUrl: string;
  /** Internal Nest public-content API origin without a trailing slash. */
  contentApiBaseUrl: string;
  /** Maximum age allowed for a last successful published snapshot. */
  lastSuccessTtlMilliseconds: number;
}

type WebsiteRuntimeEnvironment = Record<string, string | undefined>;

const DEFAULT_PUBLIC_URL = "http://localhost:8080";
const DEFAULT_CONTENT_API_BASE_URL = "http://localhost:3000";
const DEFAULT_LAST_SUCCESS_TTL_SECONDS = 300;

/**
 * Validates the Website's private runtime environment in one server-only boundary.
 */
export function getWebsiteRuntimeConfig(
  environment: WebsiteRuntimeEnvironment = process.env,
): WebsiteRuntimeConfig {
  return {
    publicUrl: normalizeAbsoluteHttpUrl(
      "WEBSITE_PUBLIC_URL",
      environment.WEBSITE_PUBLIC_URL ?? DEFAULT_PUBLIC_URL,
    ),
    contentApiBaseUrl: normalizeAbsoluteHttpUrl(
      "WEBSITE_CONTENT_API_BASE_URL",
      environment.WEBSITE_CONTENT_API_BASE_URL ?? DEFAULT_CONTENT_API_BASE_URL,
    ),
    lastSuccessTtlMilliseconds:
      parsePositiveInteger(
        "WEBSITE_LAST_SUCCESS_TTL_SECONDS",
        environment.WEBSITE_LAST_SUCCESS_TTL_SECONDS,
        DEFAULT_LAST_SUCCESS_TTL_SECONDS,
      ) * 1000,
  };
}

function normalizeAbsoluteHttpUrl(name: string, value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }

  return url.toString().replace(/\/$/u, "");
}

function parsePositiveInteger(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  if (!/^\d+$/u.test(value) || Number(value) <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return Number(value);
}
