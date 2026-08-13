import type { APIRoute } from "astro";
import { getWebsiteRuntimeConfig } from "../lib/runtime-config";
import { createRobotsText } from "../lib/seo";

/** Keeps preview capabilities out of all public crawler discovery. */
export const GET: APIRoute = () => {
  const runtimeConfig = getWebsiteRuntimeConfig();

  return new Response(createRobotsText(runtimeConfig.publicUrl), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
