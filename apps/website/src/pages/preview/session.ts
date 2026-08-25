import { WEBSITE_CONTENT_KEY, type WebsiteContentKey } from "@petcare/shared-types";
import type { APIContext } from "astro";
import { createWebsiteContentApi, type WebsitePreviewContent } from "../../lib/api";
import { getWebsiteRuntimeConfig } from "../../lib/runtime-config";

/** Name of the HttpOnly capability cookie scoped to one fixed preview page. */
export const WEBSITE_PREVIEW_COOKIE = "petcare_website_preview";

type PreviewableContentKey = Exclude<WebsiteContentKey, typeof WEBSITE_CONTENT_KEY.SITE_SHELL>;

const PREVIEWABLE_CONTENT_KEYS = new Set<PreviewableContentKey>(
  Object.values(WEBSITE_CONTENT_KEY).filter(
    (contentKey): contentKey is PreviewableContentKey =>
      contentKey !== WEBSITE_CONTENT_KEY.SITE_SHELL,
  ),
);

/** Minimal verification boundary used when exchanging a browser fragment for an HttpOnly cookie. */
export interface PreviewSessionApi {
  /** Validates the capability at Nest and proves its content-key scope before setting a cookie. */
  getPreview(contentKey: PreviewableContentKey, token: string): Promise<WebsitePreviewContent>;
}

/** Creates the same-origin POST handler that exchanges a fragment token for an HttpOnly session cookie. */
export function createPreviewSessionHandler(api: PreviewSessionApi) {
  return async ({
    request,
    cookies,
  }: Pick<APIContext, "request" | "cookies">): Promise<Response> => {
    const exchange = await readExchangeRequest(request);

    if (!exchange) {
      return sessionFailure(400);
    }

    try {
      await api.getPreview(exchange.contentKey, exchange.token);
    } catch {
      return sessionFailure(401);
    }

    cookies.set(WEBSITE_PREVIEW_COOKIE, exchange.token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/preview",
      maxAge: 600,
    });

    return Response.json(
      { path: `/preview/${exchange.contentKey}` },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  };
}

/** Astro endpoint for the fragment-token exchange guide. */
export const POST = createPreviewSessionHandler(
  createWebsiteContentApi({ baseUrl: getWebsiteRuntimeConfig().contentApiBaseUrl }),
);

async function readExchangeRequest(
  request: Request,
): Promise<{ contentKey: PreviewableContentKey; token: string } | null> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as { contentKey?: unknown; token?: unknown };

  if (
    typeof candidate.contentKey !== "string" ||
    !PREVIEWABLE_CONTENT_KEYS.has(candidate.contentKey as PreviewableContentKey) ||
    typeof candidate.token !== "string" ||
    candidate.token.length === 0
  ) {
    return null;
  }

  return { contentKey: candidate.contentKey as PreviewableContentKey, token: candidate.token };
}

function sessionFailure(status: number): Response {
  return Response.json(
    { code: "WEBSITE_PREVIEW_SESSION_INVALID" },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
