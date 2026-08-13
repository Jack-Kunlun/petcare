import type { APIRoute } from "astro";

/** Verifies that the Astro process can serve requests without disclosing runtime configuration. */
export const GET: APIRoute = () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
