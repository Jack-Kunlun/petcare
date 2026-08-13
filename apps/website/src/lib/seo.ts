import { PAGE_CONTENT_BY_PATH } from "./page-routes";

/** Minimal published-content reader required to build a current public sitemap. */
export interface WebsiteSitemapReader {
  /** Verifies that a code-owned public page currently has a published snapshot. */
  getPublished(contentKey: (typeof PAGE_CONTENT_BY_PATH)[keyof typeof PAGE_CONTENT_BY_PATH]): Promise<unknown>;
  /** Reads a bounded public page of already-published classroom articles. */
  getArticles(query: { page: number; pageSize: number }): Promise<{
    list: Array<{ slug: string }>;
    total: number;
    pageSize: number;
  }>;
}

const SITEMAP_ARTICLE_PAGE_SIZE = 100;

/** Returns an XML sitemap document for already canonicalized public paths. */
export function createSitemapXml(publicUrl: string, paths: readonly string[]): string {
  const entries = paths
    .map((path) => `<url><loc>${escapeXml(new URL(path, publicUrl).toString())}</loc></url>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>\n`;
}

/** Returns the crawler policy for the public Website surface. */
export function createRobotsText(publicUrl: string): string {
  return `User-agent: *\nDisallow: /preview\nSitemap: ${new URL("/sitemap.xml", publicUrl).toString()}\n`;
}

/** Reads every current published fixed page and article route for one sitemap response. */
export async function loadPublishedSitemapPaths(reader: WebsiteSitemapReader): Promise<string[]> {
  const fixedRoutes = Object.entries(PAGE_CONTENT_BY_PATH).map(async ([path, contentKey]) => {
    try {
      await reader.getPublished(contentKey);

      return path;
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  });
  const publishedPagePaths = (await Promise.all(fixedRoutes)).filter(
    (path): path is string => path !== null,
  );
  const firstPage = await reader.getArticles({ page: 1, pageSize: SITEMAP_ARTICLE_PAGE_SIZE });
  const remainingPageCount = Math.max(0, Math.ceil(firstPage.total / firstPage.pageSize) - 1);
  const remainingPages = await Promise.all(
    Array.from({ length: remainingPageCount }, (_, index) =>
      reader.getArticles({ page: index + 2, pageSize: SITEMAP_ARTICLE_PAGE_SIZE }),
    ),
  );
  const articlePaths = [firstPage, ...remainingPages].flatMap((page) =>
    page.list.map((article) => `/articles/${encodeURIComponent(article.slug)}`),
  );

  return [...publishedPagePaths, "/articles", ...articlePaths];
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&apos;",
      }[character] ?? character
    );
  });
}

function isNotFound(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}
