import { describe, expect, it, vi } from "vitest";
import { WebsiteContentApiError, createWebsiteContentApi } from "./api";

const publishedSnapshot = {
  contentKey: "home",
  businessVersion: 3,
  publishedAt: "2026-08-13T00:00:00.000Z",
  seo: {},
  sections: [],
};

const articleList = {
  list: [
    {
      slug: "pet-first-aid",
      title: "Pet first aid",
      summary: "What to do before help arrives.",
      coverUrl: null,
      author: { displayName: "PetCare team", avatar: null },
      publishedAt: "2026-08-13T00:00:00.000Z",
    },
  ],
  total: 1,
  page: 2,
  pageSize: 12,
};

function successResponse(data: unknown): Response {
  return new Response(
    JSON.stringify({
      code: "SUCCESS",
      message: "ok",
      data,
      meta: { requestId: "request-1", timestamp: "2026-08-13T00:00:00.000Z" },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("createWebsiteContentApi", () => {
  it("unwraps the repository response envelope for a published snapshot", async () => {
    const fetcher = vi.fn().mockResolvedValue(successResponse(publishedSnapshot));
    const api = createWebsiteContentApi({ baseUrl: "http://server:3000", fetcher });

    await expect(api.getPublished("home")).resolves.toEqual(publishedSnapshot);
    expect(fetcher).toHaveBeenCalledWith(
      "http://server:3000/website-content/home",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("maps non-success responses without trusting their presentation message", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "WEBSITE_CONTENT_NOT_FOUND",
          message: "not found",
          data: null,
          meta: { requestId: "request-2", timestamp: "2026-08-13T00:00:00.000Z" },
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );
    const api = createWebsiteContentApi({ baseUrl: "http://server:3000", fetcher });

    await expect(api.getPublished("home")).rejects.toMatchObject({
      name: "WebsiteContentApiError",
      status: 404,
      code: "WEBSITE_CONTENT_NOT_FOUND",
      requestId: "request-2",
    } satisfies Partial<WebsiteContentApiError>);
  });

  it("rejects malformed envelopes instead of rendering untrusted upstream data", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(publishedSnapshot), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const api = createWebsiteContentApi({ baseUrl: "http://server:3000", fetcher });

    await expect(api.getPublished("home")).rejects.toMatchObject({
      code: "WEBSITE_CONTENT_INVALID_RESPONSE",
    } satisfies Partial<WebsiteContentApiError>);
  });

  it("forwards preview capability only in the dedicated server-side header", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        successResponse({ contentKey: "home", revision: 4, seo: {}, sections: [] }),
      );
    const api = createWebsiteContentApi({ baseUrl: "http://server:3000", fetcher });

    await api.getPreview("home", "preview-capability");

    expect(fetcher).toHaveBeenCalledWith(
      "http://server:3000/website-content/previews/home",
      expect.objectContaining({
        headers: { "X-Website-Preview-Token": "preview-capability" },
      }),
    );
  });

  it("reads published article pages through the same response envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(successResponse(articleList));
    const api = createWebsiteContentApi({ baseUrl: "http://server:3000", fetcher });

    await expect(api.getArticles({ page: 2, pageSize: 12 })).resolves.toEqual(articleList);
    expect(fetcher).toHaveBeenCalledWith(
      "http://server:3000/content/articles?page=2&pageSize=12",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("reads one published article with Server-cleaned HTML", async () => {
    const article = { ...articleList.list[0], bodyHtml: "<p>护理正文</p>" };
    const fetcher = vi.fn().mockResolvedValue(successResponse(article));
    const api = createWebsiteContentApi({ baseUrl: "http://server:3000", fetcher });

    await expect(api.getArticle("pet-first-aid")).resolves.toEqual(article);
    expect(fetcher).toHaveBeenCalledWith(
      "http://server:3000/content/articles/pet-first-aid",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("maps a timed-out upstream request to a stable unavailable failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const api = createWebsiteContentApi({ baseUrl: "http://server:3000", fetcher, timeoutMs: 1 });

    await expect(api.getPublished("home")).rejects.toMatchObject({
      name: "WebsiteContentApiError",
      status: 503,
      code: "WEBSITE_CONTENT_UPSTREAM_UNAVAILABLE",
    } satisfies Partial<WebsiteContentApiError>);
  });
});
