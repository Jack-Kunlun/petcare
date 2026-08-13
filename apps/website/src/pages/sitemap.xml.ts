import type { APIRoute } from "astro";
import { createWebsiteContentApi } from "../lib/api";
import { getWebsiteRuntimeConfig } from "../lib/runtime-config";
import { createSitemapXml, loadPublishedSitemapPaths } from "../lib/seo";

/** Sitemap entries depend on currently published server-side content, never build-time paths. */
export const prerender = false;

/** Produces the public Website sitemap without publishing preview or draft routes. */
export const GET: APIRoute = async () => {
  const runtimeConfig = getWebsiteRuntimeConfig();
  const api = createWebsiteContentApi({ baseUrl: runtimeConfig.contentApiBaseUrl });

  try {
    const paths = await loadPublishedSitemapPaths(api);

    return new Response(createSitemapXml(runtimeConfig.publicUrl, paths), {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  } catch {
    return new Response("Service temporarily unavailable", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
};
