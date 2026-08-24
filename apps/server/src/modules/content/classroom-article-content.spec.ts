import type { WebsitePublicMediaAsset } from "@petcare/shared-types";
import type { SanitizedArticleBodyHtml } from "./classroom-article-content";
import {
  ARTICLE_RICH_TEXT_PREFIX,
  decodeArticleBody,
  encodeArticleBody,
  isPublishableArticleBody,
} from "./classroom-article-content";
import {
  classroomArticleConcurrentUpdate,
  classroomArticleInvalidContent,
  classroomArticleNotFound,
  classroomArticleStateConflict,
} from "./classroom-article.errors";

const managedAsset: WebsitePublicMediaAsset = {
  id: "asset-1",
  url: "https://cdn.example.com/article-1.png",
  width: 800,
  height: 600,
  mimeType: "image/png",
};

describe("classroom article rich text", () => {
  it("keeps only allowed markup and a verified managed image", async () => {
    const resolveAssets = jest.fn(async () => new Map([[managedAsset.id, managedAsset]]));

    await expect(
      encodeArticleBody(
        '<h2>护理</h2><script>alert(1)</script><img src="https://cdn.example.com/article-1.png" data-asset-id="asset-1" onerror="x">',
        resolveAssets,
      ),
    ).resolves.toEqual({
      bodyHtml:
        '<h2>护理</h2><img src="https://cdn.example.com/article-1.png" alt="" data-asset-id="asset-1" />',
      storedContent: `${ARTICLE_RICH_TEXT_PREFIX}<h2>护理</h2><img src="https://cdn.example.com/article-1.png" alt="" data-asset-id="asset-1" />`,
    });
  });

  it("always escapes legacy text even when it looks like HTML", async () => {
    await expect(
      decodeArticleBody('<img src=x onerror="alert(1)">\n第二行', jest.fn()),
    ).resolves.toBe("<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p><p>第二行</p>");
  });

  it("rejects legacy content that exceeds the raw or escaped storage limit", async () => {
    await expect(decodeArticleBody("x".repeat(200_001), jest.fn())).rejects.toMatchObject({
      code: "CONTENT_ARTICLE_INVALID_CONTENT",
      status: 400,
    });
    await expect(decodeArticleBody("<".repeat(200_000), jest.fn())).rejects.toMatchObject({
      code: "CONTENT_ARTICLE_INVALID_CONTENT",
      status: 400,
    });
  });

  it("only considers codec-produced safe HTML publishable", async () => {
    const blank = await encodeArticleBody(" \n&nbsp;", jest.fn());
    const dangerous = await encodeArticleBody("<script>alert(1)</script>", jest.fn());
    const visible: SanitizedArticleBodyHtml = await decodeArticleBody("可发布正文", jest.fn());

    expect(isPublishableArticleBody(blank.bodyHtml)).toBe(false);
    expect(isPublishableArticleBody(dangerous.bodyHtml)).toBe(false);
    expect(isPublishableArticleBody(visible)).toBe(true);
  });

  it("enforces the body and image-count limits before publication", async () => {
    const images = Array.from(
      { length: 51 },
      (_, index) =>
        `<img src="https://cdn.example.com/${index}.png" data-asset-id="asset-${index}">`,
    ).join("");

    await expect(encodeArticleBody("x".repeat(200_001), jest.fn())).rejects.toMatchObject({
      code: "CONTENT_ARTICLE_INVALID_CONTENT",
      status: 400,
    });
    await expect(encodeArticleBody(images, jest.fn())).rejects.toMatchObject({
      code: "CONTENT_ARTICLE_INVALID_CONTENT",
      status: 400,
    });
  });

  it("accepts exactly 200000 characters and 50 managed images", async () => {
    await expect(encodeArticleBody("x".repeat(200_000), jest.fn())).resolves.toMatchObject({
      bodyHtml: "x".repeat(200_000),
    });

    const assets = new Map<string, WebsitePublicMediaAsset>(
      Array.from({ length: 50 }, (_, index) => {
        const asset = {
          ...managedAsset,
          id: `asset-${index}`,
          url: `https://cdn.example.com/${index}.png`,
        };

        return [asset.id, asset];
      }),
    );
    const images = Array.from(
      assets.values(),
      (asset) => `<img src="${asset.url}" data-asset-id="${asset.id}">`,
    ).join("");

    const encoded = await encodeArticleBody(
      images,
      jest.fn(async () => assets),
    );

    expect(encoded.bodyHtml).toContain('data-asset-id="asset-49"');
    expect(isPublishableArticleBody(encoded.bodyHtml)).toBe(true);
  });

  it("rejects missing, mismatched, and non-HTTP managed image references", async () => {
    const resolveAssets = jest.fn(async () => new Map([[managedAsset.id, managedAsset]]));

    await expect(
      encodeArticleBody(
        '<img src="https://evil.example.com/article-1.png" data-asset-id="asset-1">',
        resolveAssets,
      ),
    ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_INVALID_CONTENT", status: 400 });
    await expect(
      encodeArticleBody('<img src="https://cdn.example.com/article-1.png">', resolveAssets),
    ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_INVALID_CONTENT", status: 400 });
    await expect(
      encodeArticleBody(
        '<img src="data:image/png;base64,AAAA" data-asset-id="asset-1">',
        resolveAssets,
      ),
    ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_INVALID_CONTENT", status: 400 });
    await expect(
      encodeArticleBody(
        '<img src="https://cdn.example.com/article-1.png" data-asset-id="asset-1">',
        jest.fn(async () => new Map([["asset-1", { ...managedAsset, id: "other-asset" }]])),
      ),
    ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_INVALID_CONTENT", status: 400 });
  });

  it("keeps only absolute allowed links and forces a safe rel value", async () => {
    await expect(
      encodeArticleBody(
        '<p><a href="/relative">站内</a> <a href="https://petcare-home.com/help" target="_blank">帮助</a></p>',
        jest.fn(),
      ),
    ).resolves.toMatchObject({
      bodyHtml:
        '<p>站内 <a href="https://petcare-home.com/help" rel="noopener noreferrer">帮助</a></p>',
    });
  });

  it("re-sanitizes versioned content before it is rendered", async () => {
    await expect(
      decodeArticleBody(
        `${ARTICLE_RICH_TEXT_PREFIX}<p>正文<script>alert(1)</script><a href="https://petcare-home.com/help" onclick="x">帮助</a></p>`,
        jest.fn(),
      ),
    ).resolves.toBe(
      '<p>正文<a href="https://petcare-home.com/help" rel="noopener noreferrer">帮助</a></p>',
    );
    await expect(
      decodeArticleBody(
        `${ARTICLE_RICH_TEXT_PREFIX}<img src="https://evil.example.com/article-1.png" data-asset-id="asset-1">`,
        jest.fn(async () => new Map([[managedAsset.id, managedAsset]])),
      ),
    ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_INVALID_CONTENT", status: 400 });
  });

  it("exposes stable errors for the article write workflow", () => {
    expect(classroomArticleInvalidContent()).toMatchObject({
      code: "CONTENT_ARTICLE_INVALID_CONTENT",
      status: 400,
    });
    expect(classroomArticleNotFound()).toMatchObject({
      code: "CONTENT_ARTICLE_NOT_FOUND",
      status: 404,
    });
    expect(classroomArticleStateConflict()).toMatchObject({
      code: "CONTENT_ARTICLE_STATE_CONFLICT",
      status: 409,
    });
    expect(classroomArticleConcurrentUpdate()).toMatchObject({
      code: "CONTENT_ARTICLE_CONCURRENT_UPDATE",
      status: 409,
    });
  });
});
