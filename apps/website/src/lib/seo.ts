import { STATIC_MARKETING_PATHS } from "./page-routes";

/** Minimal published-content reader required to build a current public sitemap. */
export interface WebsiteSitemapReader {
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

/** Reads code-owned marketing paths and any currently published article routes for the sitemap. */
export async function loadPublishedSitemapPaths(reader: WebsiteSitemapReader): Promise<string[]> {
  let firstPage: Awaited<ReturnType<WebsiteSitemapReader["getArticles"]>>;

  try {
    firstPage = await reader.getArticles({ page: 1, pageSize: SITEMAP_ARTICLE_PAGE_SIZE });
  } catch {
    return [...STATIC_MARKETING_PATHS, "/articles"];
  }

  const remainingPageCount = Math.max(0, Math.ceil(firstPage.total / firstPage.pageSize) - 1);
  const remainingPages = await Promise.all(
    Array.from({ length: remainingPageCount }, (_, index) =>
      reader.getArticles({ page: index + 2, pageSize: SITEMAP_ARTICLE_PAGE_SIZE }),
    ),
  );
  const articlePaths = [firstPage, ...remainingPages].flatMap((page) =>
    page.list.map((article) => `/articles/${encodeURIComponent(article.slug)}`),
  );

  return [...STATIC_MARKETING_PATHS, "/articles", ...articlePaths];
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      }[character] ?? character
    );
  });
}
