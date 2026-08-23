# 课堂文章图文发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许获授权管理员新建和编辑图文草稿、发布、下线及重新发布课堂文章，并让官网只渲染 Server 清洗后的已发布富文本。

**Architecture:** 新建聚焦的 `ClassroomArticleService` 接管文章读写与状态机，保留现有 Prisma 模型并复用 Website Content 的 COS 媒体服务。Admin 使用 Tiptap v3 输出 HTML；Server 将清洗并验证过的 HTML 加内部 v1 前缀写入现有 `content` 字段，旧内容始终按纯文本转义。

**Tech Stack:** React 19、Tiptap 3.30.2、React Query 5、NestJS 11、Prisma 7、sanitize-html 2.17.7、腾讯 COS、Astro 7、Vitest、Jest、Testing Library

**Spec:** `docs/superpowers/specs/2026-08-23-admin-auth-and-classroom-publishing-design.md`

## Global Constraints

- 状态转换仅允许 `create -> draft`、`draft -> published`、`published -> offline`、`offline -> published`。
- `draft` 和 `offline` 可编辑；`published` 必须先下线才能编辑。
- 更新、发布和下线必须提交 `expectedUpdatedAt`；不匹配返回 409。
- 标题去除首尾空白后为 1 至 120 个字符；摘要为 1 至 500 个字符。
- 草稿正文可为空；发布正文必须包含非空白文本或至少一张有效图片。
- `bodyHtml` 上限 200,000 字符、50 张图片。
- 数据库只将精确前缀 `PETCARE_CLASSROOM_RICH_TEXT_V1\n` 后的内容解释为 HTML；无前缀历史值永远先转义。
- HTML 只允许 `p`、`h2`、`h3`、`strong`、`em`、`s`、`ul`、`ol`、`li`、`blockquote`、`a`、`img`、`br`、`hr`。
- 图片必须含活动素材 `data-asset-id`，且 `src` 必须等于 Server 从该素材解析出的公开 URL。
- 图片仅接受 JPEG、PNG、WebP，沿用现有 10 MiB、字节探测、尺寸、校验和与 COS 规则。
- 按钮权限 `content.article.write` 隐含 `content.article.write_action`；按钮权限 `content.article.publish` 隐含 `content.article.publish_action`。
- `super_admin` 自动获得目录全部权限；其他角色必须显式授权。
- 官网公开查询仅返回 `published`；草稿、下线和不存在统一 404。
- 不增加审核流、定时发布、文章版本、协同编辑、外部 CMS、第二套素材表或 Prisma 字段。
- Tiptap StarterKit v3 已内置 Link；只额外安装 Image，不重复注册同名 Link 扩展。

---

### Task 1: 依赖、共享契约与 RBAC 目录

**Files:**

- Modify: `apps/admin/package.json`
- Modify: `apps/server/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/shared-types/src/api/content.ts`
- Modify: `packages/shared-types/src/api/content.spec.ts`
- Modify: `packages/shared-types/src/rbac/permission-catalog.ts`
- Modify: `packages/shared-types/src/rbac/permission-catalog.spec.ts`

**Interfaces:**

- Produces: `AdminClassroomArticleDetail`
- Produces: `CreateAdminClassroomArticleRequest`
- Produces: `UpdateAdminClassroomArticleRequest`
- Produces: `AdminClassroomArticleStateRequest`
- Produces: `UploadAdminClassroomArticleMediaResponse`
- Changes: `PublicClassroomArticleDetail.body` to `bodyHtml`
- Adds: `AdminClassroomArticleListItem.publicUrl`

- [ ] **Step 1: Install the exact editor and sanitizer dependencies**

Run:

```powershell
pnpm --filter @petcare/admin add @tiptap/react@3.30.2 @tiptap/pm@3.30.2 @tiptap/starter-kit@3.30.2 @tiptap/extension-image@3.30.2
pnpm --filter @petcare/server add sanitize-html@2.17.7
pnpm --filter @petcare/server add -D @types/sanitize-html@2.16.1
```

Expected: package manifests and `pnpm-lock.yaml` change; no Link package is added because StarterKit v3 includes it.

- [ ] **Step 2: Write failing shared contract tests**

```ts
// packages/shared-types/src/api/content.spec.ts
it("defines editable classroom article requests and safe public HTML", () => {
  const detail: AdminClassroomArticleDetail = {
    id: "article-1",
    title: "幼犬喂养课堂",
    summary: "基础喂养知识",
    coverUrl: null,
    status: "draft",
    author: null,
    publishedAt: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    publicUrl: "https://petcare-home.com/articles/article-1",
    bodyHtml: "<p>正文</p>",
  };
  const create: CreateAdminClassroomArticleRequest = {
    title: "幼犬喂养课堂",
    summary: "基础喂养知识",
    bodyHtml: "<p>正文</p>",
    coverAssetId: null,
  };
  const update: UpdateAdminClassroomArticleRequest = {
    ...create,
    expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
  };
  const state: AdminClassroomArticleStateRequest = {
    expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
  };
  const publicDetail: PublicClassroomArticleDetail = {
    slug: "article-1",
    title: "幼犬喂养课堂",
    summary: "基础喂养知识",
    coverUrl: null,
    author: null,
    publishedAt: "2026-08-24T00:00:00.000Z",
    bodyHtml: "<p>正文</p>",
  };

  expect({ detail, update, state, publicDetail, create }).toBeDefined();
});
```

In the existing “keeps official website article contracts limited to public fields” case, replace `body` with `bodyHtml: "<p>Plain text</p>"`.

- [ ] **Step 3: Write failing RBAC closure tests**

```ts
// packages/shared-types/src/rbac/permission-catalog.spec.ts
it("separates article writing and publishing actions", () => {
  const byCode = new Map(RBAC_PERMISSION_CATALOG.map((item) => [item.code, item]));

  expect(byCode.get("content.article.write")).toMatchObject({
    type: "button",
    parentCode: "content.article.view",
    impliedApiCodes: ["content.article.read", "content.article.write_action"],
  });
  expect(byCode.get("content.article.publish")).toMatchObject({
    type: "button",
    parentCode: "content.article.view",
    impliedApiCodes: ["content.article.read", "content.article.publish_action"],
  });
  expect(byCode.get("content.article.write_action")?.type).toBe("api");
  expect(byCode.get("content.article.publish_action")?.type).toBe("api");
});
```

- [ ] **Step 4: Run shared tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/shared-types exec vitest run src/api/content.spec.ts src/rbac/permission-catalog.spec.ts
```

Expected: FAIL because the write contracts and permission entries do not exist.

- [ ] **Step 5: Add the shared article contracts with complete JSDoc**

```ts
// packages/shared-types/src/api/content.ts
export interface AdminClassroomArticleDetail extends AdminClassroomArticleListItem {
  /** Server-cleaned HTML loaded into the article editor. */
  bodyHtml: string;
}

export interface CreateAdminClassroomArticleRequest {
  /** Trimmed article title, from 1 through 120 characters. */
  title: string;
  /** Trimmed article summary, from 1 through 500 characters. */
  summary: string;
  /** Untrusted editor HTML; Server cleans and validates it before persistence. */
  bodyHtml: string;
  /** Active managed cover asset, or null for no cover. */
  coverAssetId?: string | null;
}

export interface UpdateAdminClassroomArticleRequest extends Omit<
  CreateAdminClassroomArticleRequest,
  "coverAssetId"
> {
  /** Omit to retain the cover, use null to clear it, or provide an active asset to replace it. */
  coverAssetId?: string | null;
  /** Last observed article update timestamp used for optimistic concurrency. */
  expectedUpdatedAt: string;
}

export interface AdminClassroomArticleStateRequest {
  /** Last observed article update timestamp used for optimistic concurrency. */
  expectedUpdatedAt: string;
}

export type UploadAdminClassroomArticleMediaResponse = WebsitePublicMediaAsset;
```

Insert `publicUrl` into `AdminClassroomArticleListItem`, replace the old public `body` field with `bodyHtml`, and import `WebsitePublicMediaAsset` from the existing website-content contract instead of duplicating media fields:

```ts
/** Server-generated official website URL for this article. */
publicUrl: string;

export interface PublicClassroomArticleDetail extends PublicClassroomArticleListItem {
  /** Server-cleaned article HTML safe for the official website renderer. */
  bodyHtml: string;
}
```

No API barrel edit is needed: `packages/shared-types/src/api/index.ts` already exports `./content`.

- [ ] **Step 6: Add the four RBAC entries**

```ts
{
  code: "content.article.write",
  type: "button",
  label: "编辑课堂文章",
  module: "content",
  path: null,
  parentCode: "content.article.view",
  order: 10,
  icon: null,
  impliedApiCodes: ["content.article.read", "content.article.write_action"],
},
{
  code: "content.article.write_action",
  type: "api",
  label: "编辑课堂文章接口",
  module: "content",
  path: null,
  parentCode: null,
  order: 40,
  icon: null,
  impliedApiCodes: [],
},
{
  code: "content.article.publish",
  type: "button",
  label: "发布课堂文章",
  module: "content",
  path: null,
  parentCode: "content.article.view",
  order: 20,
  icon: null,
  impliedApiCodes: ["content.article.read", "content.article.publish_action"],
},
{
  code: "content.article.publish_action",
  type: "api",
  label: "发布课堂文章接口",
  module: "content",
  path: null,
  parentCode: null,
  order: 50,
  icon: null,
  impliedApiCodes: [],
},
```

- [ ] **Step 7: Run shared tests and typecheck**

Run:

```powershell
pnpm --filter @petcare/shared-types exec vitest run src/api/content.spec.ts src/rbac/permission-catalog.spec.ts
pnpm --filter @petcare/shared-types typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```powershell
git add -- apps/admin/package.json apps/server/package.json pnpm-lock.yaml packages/shared-types/src/api/content.ts packages/shared-types/src/api/content.spec.ts packages/shared-types/src/rbac/permission-catalog.ts packages/shared-types/src/rbac/permission-catalog.spec.ts
git commit -m "feat(content): 定义课堂文章写入契约"
```

### Task 2: 富文本格式、安全清洗与历史兼容

**Files:**

- Create: `apps/server/src/modules/content/classroom-article.errors.ts`
- Create: `apps/server/src/modules/content/classroom-article-content.ts`
- Create: `apps/server/src/modules/content/classroom-article-content.spec.ts`

**Interfaces:**

- Produces: `ARTICLE_RICH_TEXT_PREFIX`
- Produces: `encodeArticleBody(bodyHtml, resolveAssets): Promise<EncodedArticleBody>`
- Produces: `decodeArticleBody(content, resolveAssets): Promise<string>`
- Produces: `isPublishableArticleBody(bodyHtml): boolean`
- Consumes: existing batch resolver `(assetIds) => Promise<ReadonlyMap<string, WebsitePublicMediaAsset>>`

- [ ] **Step 1: Write failing sanitizer and legacy tests**

```ts
it("keeps the exact allowlist and validates managed images", async () => {
  const result = await encodeArticleBody(
    '<h2>护理</h2><script>alert(1)</script><img src="https://cdn/a.png" data-asset-id="asset-1" onerror="x">',
    async () =>
      new Map([
        [
          "asset-1",
          {
            id: "asset-1",
            url: "https://cdn/a.png",
            width: 800,
            height: 600,
            mimeType: "image/png" as const,
          },
        ],
      ]),
  );

  expect(result.storedContent).toBe(
    `${ARTICLE_RICH_TEXT_PREFIX}<h2>护理</h2><img src="https://cdn/a.png" alt="" data-asset-id="asset-1" />`,
  );
  expect(result.storedContent).not.toContain("script");
  expect(result.storedContent).not.toContain("onerror");
});

it("rejects an image whose id and URL do not match", async () => {
  await expect(
    encodeArticleBody(
      '<img src="https://evil.example/a.png" data-asset-id="asset-1">',
      async () => new Map([["asset-1", { id: "asset-1", url: "https://cdn/a.png" } as never]]),
    ),
  ).rejects.toMatchObject({ code: "CONTENT_ARTICLE_INVALID_CONTENT", status: 400 });
});

it("always escapes legacy text even when it looks like HTML", async () => {
  await expect(decodeArticleBody('<img src=x onerror="alert(1)">\n第二行', vi.fn())).resolves.toBe(
    "<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p><p>第二行</p>",
  );
});

it("enforces 200000 characters and 50 images", async () => {
  await expect(encodeArticleBody("x".repeat(200_001), vi.fn())).rejects.toMatchObject({
    code: "CONTENT_ARTICLE_INVALID_CONTENT",
  });
  const images = Array.from(
    { length: 51 },
    (_, index) => `<img src="https://cdn/${index}.png" data-asset-id="asset-${index}">`,
  ).join("");
  await expect(encodeArticleBody(images, vi.fn())).rejects.toMatchObject({
    code: "CONTENT_ARTICLE_INVALID_CONTENT",
  });
});
```

- [ ] **Step 2: Run the sanitizer test and verify it fails**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/modules/content/classroom-article-content.spec.ts --runInBand
```

Expected: FAIL because the codec does not exist.

- [ ] **Step 3: Add stable content errors**

```ts
// apps/server/src/modules/content/classroom-article.errors.ts
import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";

export const classroomArticleInvalidContent = (message = "文章正文格式无效") =>
  new ApiException("CONTENT_ARTICLE_INVALID_CONTENT", message, HttpStatus.BAD_REQUEST);

export const classroomArticleNotFound = () =>
  new ApiException("CONTENT_ARTICLE_NOT_FOUND", "课堂文章不存在", HttpStatus.NOT_FOUND);

export const classroomArticleStateConflict = () =>
  new ApiException(
    "CONTENT_ARTICLE_STATE_CONFLICT",
    "文章状态已变化，请刷新后重试",
    HttpStatus.CONFLICT,
  );

export const classroomArticleConcurrentUpdate = () =>
  new ApiException(
    "CONTENT_ARTICLE_CONCURRENT_UPDATE",
    "文章已被其他管理员修改，请刷新后重试",
    HttpStatus.CONFLICT,
  );
```

- [ ] **Step 4: Implement the v1 codec and strict allowlist**

```ts
// apps/server/src/modules/content/classroom-article-content.ts
import sanitizeHtml from "sanitize-html";
import type { WebsitePublicMediaAsset } from "@petcare/shared-types";
import { classroomArticleInvalidContent } from "./classroom-article.errors";

export const ARTICLE_RICH_TEXT_PREFIX = "PETCARE_CLASSROOM_RICH_TEXT_V1\n";
const MAX_BODY_LENGTH = 200_000;
const MAX_IMAGES = 50;

export interface EncodedArticleBody {
  bodyHtml: string;
  storedContent: string;
}

type ResolveAssets = (
  assetIds: readonly string[],
) => Promise<ReadonlyMap<string, WebsitePublicMediaAsset>>;

async function cleanAndVerify(
  bodyHtml: string,
  resolveAssets: ResolveAssets,
): Promise<EncodedArticleBody> {
  if (bodyHtml.length > MAX_BODY_LENGTH) throw classroomArticleInvalidContent("文章正文过长");
  const images: Array<{ assetId: string; src: string }> = [];
  const cleaned = sanitizeHtml(bodyHtml, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "strong",
      "em",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "br",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "rel"],
      img: ["src", "alt", "data-asset-id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => {
        const href = attributes.href ?? "";
        return /^(https?:|mailto:)/iu.test(href)
          ? { tagName: "a", attribs: { href, rel: "noopener noreferrer" } }
          : { tagName: "span", attribs: {} };
      },
      img: (_tagName, attributes) => {
        const assetId = attributes["data-asset-id"] ?? "";
        const src = attributes.src ?? "";
        images.push({ assetId, src });
        return {
          tagName: "img",
          attribs: { src, alt: attributes.alt ?? "", "data-asset-id": assetId },
        };
      },
    },
  });

  if (cleaned.length > MAX_BODY_LENGTH || images.length > MAX_IMAGES) {
    throw classroomArticleInvalidContent("文章正文超出允许范围");
  }

  if (images.some((image) => !image.assetId)) {
    throw classroomArticleInvalidContent("正文图片缺少素材标识");
  }
  const assetIds = [...new Set(images.map((image) => image.assetId))];
  const assets =
    assetIds.length > 0
      ? await resolveAssets(assetIds)
      : new Map<string, WebsitePublicMediaAsset>();
  for (const image of images) {
    if (assets.get(image.assetId)?.url !== image.src) {
      throw classroomArticleInvalidContent("正文图片地址无效");
    }
  }

  return { bodyHtml: cleaned, storedContent: `${ARTICLE_RICH_TEXT_PREFIX}${cleaned}` };
}

export function encodeArticleBody(bodyHtml: string, resolveAssets: ResolveAssets) {
  return cleanAndVerify(bodyHtml, resolveAssets);
}

export async function decodeArticleBody(
  content: string,
  resolveAssets: ResolveAssets,
): Promise<string> {
  if (content.startsWith(ARTICLE_RICH_TEXT_PREFIX)) {
    return (await cleanAndVerify(content.slice(ARTICLE_RICH_TEXT_PREFIX.length), resolveAssets))
      .bodyHtml;
  }

  return content
    .split(/\r?\n/u)
    .map((line) => (line.length > 0 ? `<p>${escapeHtml(line)}</p>` : "<p><br /></p>"))
    .join("");
}

export function isPublishableArticleBody(bodyHtml: string): boolean {
  if (/<img\b/iu.test(bodyHtml)) return true;

  return (
    sanitizeHtml(bodyHtml, { allowedTags: [], allowedAttributes: {} })
      .replace(/(?:&nbsp;|&#160;|\u00a0)/giu, "")
      .trim().length > 0
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(String.fromCharCode(34), "&quot;")
    .replaceAll("'", "&#39;");
}
```

- [ ] **Step 5: Run sanitizer tests and verify they pass**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/modules/content/classroom-article-content.spec.ts --runInBand
```

Expected: PASS, including this link assertion:

```ts
await expect(
  encodeArticleBody(
    '<p><a href="/relative">站内</a> <a href="https://petcare-home.com/help">帮助</a></p>',
    vi.fn(),
  ),
).resolves.toMatchObject({
  bodyHtml:
    '<p>站内 <a href="https://petcare-home.com/help" rel="noopener noreferrer">帮助</a></p>',
});
```

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- apps/server/src/modules/content/classroom-article.errors.ts apps/server/src/modules/content/classroom-article-content.ts apps/server/src/modules/content/classroom-article-content.spec.ts
git commit -m "feat(content): 建立课堂文章富文本安全边界"
```

### Task 3: 复用媒体服务并保护文章引用

**Files:**

- Modify: `apps/server/src/modules/website-content/website-content.module.ts`
- Modify: `apps/server/src/modules/website-content/website-media.service.ts`
- Modify: `apps/server/src/modules/website-content/website-media.service.spec.ts`
- Modify: `apps/server/src/modules/website-content/admin-website-content.controller.ts`

**Interfaces:**

- Produces: exported `WebsiteMediaService`
- Changes: `WebsiteMediaService.upload(...): Promise<WebsiteMediaAsset>`
- Preserves: existing Website Content draft/published reference protection
- Adds: classroom article cover and body reference protection

- [ ] **Step 1: Write failing media return-shape and article-reference tests**

```ts
it("returns a complete managed asset after upload", async () => {
  const record = {
    id: "asset-1",
    storageKey: "media/a.png",
    originalName: "a.png",
    mimeType: "image/png",
    sizeBytes: 4,
    width: 32,
    height: 32,
    checksum: "hash",
    status: "active",
    createdAt: new Date("2026-08-24T00:00:00.000Z"),
    createdBy: { id: "admin-1", nickname: "管理员", username: "admin" },
  };
  const prisma = { websiteMediaAsset: { create: jest.fn().mockResolvedValue(record) } };
  const storage = {
    put: jest.fn().mockResolvedValue({ storageKey: "media/a.png" }),
    delete: jest.fn(),
    resolvePublicUrl: jest.fn(() => "https://cdn/a.png"),
  };
  const service = new WebsiteMediaService(prisma as never, storage as never);

  await expect(
    service.upload(
      {
        buffer: Buffer.from("file"),
        originalName: "a.png",
        mimeType: "image/png",
        operatorId: "admin-1",
      },
      {
        mimeType: "image/png",
        extension: "png",
        sizeBytes: 4,
        width: 32,
        height: 32,
        checksum: "hash",
      },
    ),
  ).resolves.toMatchObject({
    id: "asset-1",
    publicAsset: { id: "asset-1", url: "https://cdn/a.png" },
  });
});

it("refuses to archive an asset referenced by any classroom article", async () => {
  const prisma = {
    websiteMediaAsset: {
      findUnique: jest.fn().mockResolvedValue({ storageKey: "media/a.png" }),
      update: jest.fn(),
    },
    websiteContentSection: { findMany: jest.fn().mockResolvedValue([]) },
    classroomArticle: { findMany: jest.fn().mockResolvedValue([{ id: "article-1" }]) },
  };
  const storage = { resolvePublicUrl: jest.fn(() => "https://cdn/a.png") };
  const service = new WebsiteMediaService(prisma as never, storage as never);

  await expect(service.archive("asset-1")).rejects.toMatchObject({
    code: "WEBSITE_CONTENT_INVALID_MEDIA",
  });
  expect(prisma.websiteMediaAsset.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the media test and verify it fails**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/modules/website-content/website-media.service.spec.ts --runInBand
```

Expected: FAIL because upload returns a raw Prisma record and article references are not queried.

- [ ] **Step 3: Return the existing public media contract from upload**

Use the existing mapper as the single upload response boundary:

```ts
async upload(
  file: WebsiteMediaUploadFile,
  valid: ValidatedWebsiteMediaFile,
): Promise<WebsiteMediaAsset> {
  const stored = await this.storage.put({
    body: file.buffer,
    mimeType: valid.mimeType,
    extension: valid.extension,
  });

  try {
    const record = await this.prisma.websiteMediaAsset.create({
      data: {
        storageKey: stored.storageKey,
        originalName: file.originalName,
        mimeType: valid.mimeType,
        sizeBytes: valid.sizeBytes,
        width: valid.width,
        height: valid.height,
        checksum: valid.checksum,
        status: WEBSITE_MEDIA_STATUS.ACTIVE,
        createdById: file.operatorId,
      },
      include: { createdBy: { select: { id: true, nickname: true, username: true } } },
    });

    return this.toAsset(record);
  } catch (error) {
    await this.storage.delete(stored.storageKey).catch(() => undefined);
    throw error;
  }
}
```

In `AdminWebsiteContentController.uploadMedia`, return `this.media.upload(...)` directly and remove `as Promise<WebsiteMediaAsset>`.

- [ ] **Step 4: Include article covers and `data-asset-id` values in archive checks**

```ts
private async findReferences(assetId: string): Promise<string[]> {
  const [asset, sections] = await Promise.all([
    this.prisma.websiteMediaAsset.findUnique({
      where: { id: assetId },
      select: { storageKey: true },
    }),
    this.prisma.websiteContentSection.findMany({
      where: { version: { OR: [{ currentDraftFor: { isNot: null } }, { publishedFor: { isNot: null } }] } },
      select: { versionId: true, content: true },
    }),
  ]);
  const publicUrl = asset ? this.storage.resolvePublicUrl(asset.storageKey) : "";
  const articles = await this.prisma.classroomArticle.findMany({
    where: {
      OR: [
        { coverUrl: publicUrl },
        { content: { contains: `data-asset-id="${assetId}"` } },
      ],
    },
    select: { id: true },
  });

  return [
    ...sections.filter((section) => JSON.stringify(section.content).includes(assetId)).map((section) => section.versionId),
    ...articles.map((article) => `article:${article.id}`),
  ];
}
```

All article statuses are intentionally included; no status filter is allowed.

- [ ] **Step 5: Export the service and run tests**

Add `exports: [WebsiteMediaService]` to `WebsiteContentModule`.

Run:

```powershell
pnpm --filter @petcare/server exec jest src/modules/website-content/website-media.service.spec.ts src/modules/website-content/admin-website-content.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- apps/server/src/modules/website-content/website-content.module.ts apps/server/src/modules/website-content/website-media.service.ts apps/server/src/modules/website-content/website-media.service.spec.ts apps/server/src/modules/website-content/admin-website-content.controller.ts
git commit -m "feat(content): 复用并保护课堂文章素材"
```

### Task 4: ClassroomArticleService 状态机与持久化

**Files:**

- Create: `apps/server/src/modules/content/classroom-article.service.ts`
- Create: `apps/server/src/modules/content/classroom-article.service.spec.ts`
- Modify: `apps/server/src/modules/content/content.service.ts`
- Modify: `apps/server/src/modules/content/content.service.spec.ts`

**Interfaces:**

- Produces: `findArticlePage(query)`
- Produces: `findAdminArticle(id)`
- Produces: `createDraft(operatorId, request)`
- Produces: `updateEditable(id, request)`
- Produces: `publish(id, request)`
- Produces: `offline(id, request)`
- Produces: `findPublishedArticlePage(query)`
- Produces: `findPublishedArticleBySlug(slug)`

- [ ] **Step 1: Move the four existing article read cases to the new service test**

Move these exact tests from `content.service.spec.ts` to `classroom-article.service.spec.ts`: “returns classroom article metadata with nullable publication time”, “returns only published classroom articles through the public page seam”, “reads a published article by its stable id slug and returns escaped plain text”, and “does not reveal draft, offline, or missing articles through the public detail seam”. Construct `ClassroomArticleService` with mocked `PrismaService`, `WebsiteMediaService`, and `{ websitePublicUrl: "https://petcare-home.com" } as ConfigService`. Update the assertions to require `publicUrl: "https://petcare-home.com/articles/article-1"` and legacy detail `bodyHtml: "<p>护理正文</p>"`. Leave only the reward and post tests in `ContentService`.

Add these failing state cases:

```ts
const observedAt = new Date("2026-08-24T00:00:00.000Z");
const prefixedBody = `${ARTICLE_RICH_TEXT_PREFIX}<p>正文</p>`;
const article = {
  id: "article-1",
  title: "幼犬喂养课堂",
  summary: "基础知识",
  coverUrl: null,
  content: prefixedBody,
  status: "draft",
  authorId: "admin-1",
  publishedAt: null,
  createdAt: observedAt,
  updatedAt: observedAt,
  author: null,
};
const savedDraft = { ...article };
const updateRequest = {
  title: "幼犬喂养课堂",
  summary: "更新后的基础知识",
  bodyHtml: "<p>正文</p>",
  expectedUpdatedAt: observedAt.toISOString(),
};
const stateRequest = { expectedUpdatedAt: observedAt.toISOString() };

it("creates a draft with the current administrator and v1 content", async () => {
  prisma.classroomArticle.create.mockResolvedValue(savedDraft);

  await service.createDraft("admin-1", {
    title: " 幼犬喂养课堂 ",
    summary: " 基础知识 ",
    bodyHtml: "<p>正文</p>",
    coverAssetId: null,
  });

  expect(prisma.classroomArticle.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        title: "幼犬喂养课堂",
        summary: "基础知识",
        status: "draft",
        authorId: "admin-1",
        content: expect.stringMatching(/^PETCARE_CLASSROOM_RICH_TEXT_V1\n/u),
      }),
    }),
  );
});

it("rejects editing a published article", async () => {
  prisma.classroomArticle.findUnique.mockResolvedValue({ ...article, status: "published" });
  await expect(service.updateEditable("article-1", updateRequest)).rejects.toMatchObject({
    code: "CONTENT_ARTICLE_STATE_CONFLICT",
    status: 409,
  });
});

it("returns a concurrent update conflict when updatedAt no longer matches", async () => {
  prisma.classroomArticle.findUnique.mockResolvedValue({ ...article, status: "draft" });
  prisma.classroomArticle.updateMany.mockResolvedValue({ count: 0 });
  await expect(service.updateEditable("article-1", updateRequest)).rejects.toMatchObject({
    code: "CONTENT_ARTICLE_CONCURRENT_UPDATE",
  });
});

it("publishes a non-empty draft", async () => {
  prisma.classroomArticle.findUnique.mockResolvedValue({
    ...article,
    status: "draft",
    content: prefixedBody,
  });
  prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });
  await service.publish("article-1", stateRequest);
  expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "published", publishedAt: expect.any(Date) }),
    }),
  );
});

it("offlines a published article without changing its publication timestamp", async () => {
  prisma.classroomArticle.findUnique.mockResolvedValue({
    ...article,
    status: "published",
    publishedAt: new Date("2026-08-24T01:00:00.000Z"),
  });
  prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });

  await service.offline("article-1", stateRequest);

  expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ status: "published", updatedAt: observedAt }),
      data: { status: "offline" },
    }),
  );
});

it("sets a fresh publication timestamp when republishing an offline article", async () => {
  prisma.classroomArticle.findUnique.mockResolvedValue({ ...article, status: "offline" });
  prisma.classroomArticle.updateMany.mockResolvedValue({ count: 1 });

  await service.publish("article-1", stateRequest);

  expect(prisma.classroomArticle.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { status: "published", publishedAt: expect.any(Date) },
    }),
  );
});

it("rejects publishing an empty cleaned body", async () => {
  prisma.classroomArticle.findUnique.mockResolvedValue({
    ...article,
    content: `${ARTICLE_RICH_TEXT_PREFIX}<p><br /></p>`,
  });

  await expect(service.publish("article-1", stateRequest)).rejects.toMatchObject({
    code: "CONTENT_ARTICLE_INVALID_CONTENT",
    status: 400,
  });
  expect(prisma.classroomArticle.updateMany).not.toHaveBeenCalled();
});

it.each([
  ["publish", "published"],
  ["offline", "draft"],
] as const)("rejects %s from %s", async (action, status) => {
  prisma.classroomArticle.findUnique.mockResolvedValue({ ...article, status });
  await expect(service[action]("article-1", stateRequest)).rejects.toMatchObject({
    code: "CONTENT_ARTICLE_STATE_CONFLICT",
    status: 409,
  });
});
```

- [ ] **Step 2: Run the new service test and verify it fails**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/modules/content/classroom-article.service.spec.ts src/modules/content/content.service.spec.ts --runInBand
```

Expected: FAIL because `ClassroomArticleService` does not exist.

- [ ] **Step 3: Implement article mapping and public URL generation**

Construct the service with `PrismaService`, `WebsiteMediaService`, and `ConfigService`. Move the existing article selects/mappers from `ContentService`; keep reward/post helpers there.

```ts
import type { Prisma } from "../../generated/prisma/client";

const adminArticleListSelect = {
  id: true,
  title: true,
  summary: true,
  coverUrl: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: { id: true, phone: true, username: true, nickname: true, avatar: true },
  },
} as const;
const adminArticleDetailSelect = { ...adminArticleListSelect, content: true } as const;

type AdminArticleDetailRecord = Prisma.ClassroomArticleGetPayload<{
  select: typeof adminArticleDetailSelect;
}>;

private publicUrl(id: string): string {
  return new URL(
    `/articles/${encodeURIComponent(id)}`,
    this.config.websitePublicUrl,
  ).toString();
}

private resolveAssets = (assetIds: readonly string[]) => this.media.resolvePublicAssets(assetIds);

private toAdminListItem(article: Prisma.ClassroomArticleGetPayload<{
  select: typeof adminArticleListSelect;
}>): AdminClassroomArticleListItem {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    coverUrl: article.coverUrl,
    publicUrl: this.publicUrl(article.id),
    status: article.status as AdminClassroomArticleStatus,
    author: article.author,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}
```

Every admin list/detail item includes `publicUrl`. `findAdminArticle` returns decoded `bodyHtml`; public detail decodes the same content but queries with `status: "published"`.

Use one async mapper for every admin detail response:

```ts
private async toAdminDetail(article: AdminArticleDetailRecord): Promise<AdminClassroomArticleDetail> {
  return {
    ...this.toAdminListItem(article),
    bodyHtml: await decodeArticleBody(article.content, this.resolveAssets),
  };
}

async findAdminArticle(id: string): Promise<AdminClassroomArticleDetail> {
  const article = await this.prisma.classroomArticle.findUnique({
    where: { id },
    select: adminArticleDetailSelect,
  });
  if (!article) throw classroomArticleNotFound();
  return this.toAdminDetail(article);
}

private async requireArticle(id: string) {
  const article = await this.prisma.classroomArticle.findUnique({
    where: { id },
    select: { id: true, status: true, content: true, coverUrl: true },
  });
  if (!article) throw classroomArticleNotFound();
  return article;
}
```

- [ ] **Step 4: Implement create and editable update**

```ts
async createDraft(operatorId: string, request: CreateAdminClassroomArticleRequest) {
  const body = await encodeArticleBody(request.bodyHtml, this.resolveAssets);
  const cover = request.coverAssetId ? await this.media.resolvePublicAsset(request.coverAssetId) : null;
  const created = await this.prisma.classroomArticle.create({
    data: {
      title: request.title.trim(),
      summary: request.summary.trim(),
      coverUrl: cover?.url ?? null,
      content: body.storedContent,
      status: "draft",
      authorId: operatorId,
    },
    select: adminArticleDetailSelect,
  });

  return this.toAdminDetail(created);
}
```

Implement the cover tri-state and optimistic update without adding another persistence abstraction:

```ts
async updateEditable(id: string, request: UpdateAdminClassroomArticleRequest) {
  const current = await this.requireArticle(id);
  if (current.status !== "draft" && current.status !== "offline") {
    throw classroomArticleStateConflict();
  }

  const body = await encodeArticleBody(request.bodyHtml, this.resolveAssets);
  let coverUrl = current.coverUrl;
  if (request.coverAssetId !== undefined) {
    coverUrl = request.coverAssetId
      ? (await this.media.resolvePublicAsset(request.coverAssetId)).url
      : null;
  }

  const result = await this.prisma.classroomArticle.updateMany({
    where: {
      id,
      status: { in: ["draft", "offline"] },
      updatedAt: new Date(request.expectedUpdatedAt),
    },
    data: {
      title: request.title.trim(),
      summary: request.summary.trim(),
      coverUrl,
      content: body.storedContent,
    },
  });
  if (result.count === 0) throw classroomArticleConcurrentUpdate();
  return this.findAdminArticle(id);
}
```

- [ ] **Step 5: Implement publish and offline transitions**

```ts
async publish(id: string, request: AdminClassroomArticleStateRequest) {
  const current = await this.requireArticle(id);
  if (current.status !== "draft" && current.status !== "offline") {
    throw classroomArticleStateConflict();
  }
  const bodyHtml = await decodeArticleBody(current.content, this.resolveAssets);
  if (!isPublishableArticleBody(bodyHtml)) {
    throw classroomArticleInvalidContent("发布前必须填写正文或插入图片");
  }
  const result = await this.prisma.classroomArticle.updateMany({
    where: {
      id,
      status: { in: ["draft", "offline"] },
      updatedAt: new Date(request.expectedUpdatedAt),
    },
    data: { status: "published", publishedAt: new Date() },
  });
  if (result.count === 0) throw classroomArticleConcurrentUpdate();
  return this.findAdminArticle(id);
}
```

Implement `offline` with no write to `publishedAt`:

```ts
async offline(id: string, request: AdminClassroomArticleStateRequest) {
  const current = await this.requireArticle(id);
  if (current.status !== "published") throw classroomArticleStateConflict();

  const result = await this.prisma.classroomArticle.updateMany({
    where: {
      id,
      status: "published",
      updatedAt: new Date(request.expectedUpdatedAt),
    },
    data: { status: "offline" },
  });
  if (result.count === 0) throw classroomArticleConcurrentUpdate();
  return this.findAdminArticle(id);
}
```

- [ ] **Step 6: Remove article methods from ContentService and run tests**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/modules/content/classroom-article.service.spec.ts src/modules/content/content.service.spec.ts --runInBand
```

Expected: PASS for create, edit, conflict, publish, offline, list, legacy public body and published-only lookup.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- apps/server/src/modules/content/classroom-article.service.ts apps/server/src/modules/content/classroom-article.service.spec.ts apps/server/src/modules/content/content.service.ts apps/server/src/modules/content/content.service.spec.ts
git commit -m "feat(content): 实现课堂文章发布状态机"
```

### Task 5: Admin/Public Controller、DTO 与媒体上传

**Files:**

- Create: `apps/server/src/modules/content/dto/admin-classroom-article.dto.ts`
- Create: `apps/server/src/modules/content/dto/admin-classroom-article.dto.spec.ts`
- Modify: `apps/server/src/modules/content/dto/content-response.dto.ts`
- Modify: `apps/server/src/modules/content/admin-content.controller.ts`
- Modify: `apps/server/src/modules/content/admin-content.controller.spec.ts`
- Modify: `apps/server/src/modules/content/public-content.controller.ts`
- Modify: `apps/server/src/modules/content/public-content.controller.spec.ts`
- Modify: `apps/server/src/modules/content/content.module.ts`
- Modify: `apps/server/src/common/http/api-exception.filter.ts`
- Modify: `apps/server/src/common/http/api-exception.filter.spec.ts`

**Interfaces:**

- Consumes: every `ClassroomArticleService` method from Task 4
- Produces: the six Admin routes and two unchanged public routes from the spec

- [ ] **Step 1: Write failing route, permission and delegation tests**

```ts
expect(permissions("findArticle")).toEqual(["content.article.write_action"]);
expect(permissions("createArticle")).toEqual(["content.article.write_action"]);
expect(permissions("updateArticle")).toEqual(["content.article.write_action"]);
expect(permissions("uploadArticleMedia")).toEqual(["content.article.write_action"]);
expect(permissions("publishArticle")).toEqual(["content.article.publish_action"]);
expect(permissions("offlineArticle")).toEqual(["content.article.publish_action"]);

await expect(controller.createArticle(createDto, request)).resolves.toEqual(articleDetail);
expect(articleService.createDraft).toHaveBeenCalledWith("admin-1", createDto);
await controller.updateArticle("article-1", updateDto);
expect(articleService.updateEditable).toHaveBeenCalledWith("article-1", updateDto);

await expect(controller.uploadArticleMedia(undefined, request)).rejects.toMatchObject({
  code: "WEBSITE_CONTENT_INVALID_MEDIA",
  status: 400,
});
```

Extend the Swagger path assertion with:

```ts
expect(document.paths).toHaveProperty("/admin/content/articles/{id}");
expect(document.paths).toHaveProperty("/admin/content/articles/{id}/publish");
expect(document.paths).toHaveProperty("/admin/content/articles/{id}/offline");
expect(document.paths).toHaveProperty("/admin/content/articles/media-assets");
```

Add a DTO boundary test:

```ts
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

const valid = plainToInstance(UpdateAdminClassroomArticleDto, {
  title: "  幼犬喂养课堂  ",
  summary: "  基础知识  ",
  bodyHtml: "<p>正文</p>",
  coverAssetId: null,
  expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
});
expect(await validate(valid)).toHaveLength(0);
expect(valid.title).toBe("幼犬喂养课堂");
expect(valid.summary).toBe("基础知识");

const invalid = plainToInstance(UpdateAdminClassroomArticleDto, {
  title: " ",
  summary: "摘要",
  bodyHtml: "x".repeat(200_001),
  coverAssetId: "https://external.example/cover.png",
  expectedUpdatedAt: "yesterday",
});
expect(await validate(invalid)).not.toHaveLength(0);
```

Add a file-limit mapping case so the 10 MiB article endpoint never returns the existing avatar-specific 2 MB message:

```ts
request.url = "/api/admin/content/articles/media-assets";
filter.catch(new MulterError("LIMIT_FILE_SIZE"), host);
expect(response.json).toHaveBeenCalledWith(
  expect.objectContaining({
    code: "CONTENT_ARTICLE_MEDIA_TOO_LARGE",
    message: "文章图片不能超过 10 MiB",
  }),
);
```

Reset `request.url = "/resource"` in `beforeEach`. Pass the already-computed request path into `mapException` and keep the avatar response as the fallback:

```ts
const requestPath = request.path || request.url.split("?", 1)[0];
const mapped = this.mapException(exception, status, requestPath);

private mapException(exception: unknown, status: number, requestPath: string): MappedException {
  if (exception instanceof MulterError && exception.code === "LIMIT_FILE_SIZE") {
    return requestPath.includes("/admin/content/articles/media-assets")
      ? { code: "CONTENT_ARTICLE_MEDIA_TOO_LARGE", message: "文章图片不能超过 10 MiB" }
      : { code: "AVATAR_FILE_TOO_LARGE", message: "头像文件不能超过 2MB" };
  }
  if (exception instanceof ApiException) {
    return { code: exception.code, message: exception.clientMessage };
  }
  if (status === 400) return { code: "VALIDATION_FAILED", message: "请求参数校验失败" };
  if (status === 401) return { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" };
  if (status === 403) return { code: "FORBIDDEN", message: "无权执行此操作" };
  if (status === 404) return { code: "RESOURCE_NOT_FOUND", message: "资源不存在" };
  if (status === 429) return { code: "RATE_LIMIT_EXCEEDED", message: "请求过于频繁" };
  return { code: "INTERNAL_SERVER_ERROR", message: "服务内部错误" };
}
```

- [ ] **Step 2: Run controller tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/modules/content/dto/admin-classroom-article.dto.spec.ts src/modules/content/admin-content.controller.spec.ts src/modules/content/public-content.controller.spec.ts src/common/http/api-exception.filter.spec.ts --runInBand
```

Expected: FAIL because the routes and injected article service do not exist.

- [ ] **Step 3: Implement strict request DTOs**

```ts
export class CreateAdminClassroomArticleDto implements CreateAdminClassroomArticleRequest {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  title: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  summary: string;

  @IsString()
  @MaxLength(200_000)
  bodyHtml: string;

  @IsOptional()
  @IsUUID()
  coverAssetId?: string | null;
}

export class UpdateAdminClassroomArticleDto extends CreateAdminClassroomArticleDto {
  @IsISO8601({ strict: true })
  expectedUpdatedAt: string;
}

export class AdminClassroomArticleStateDto implements AdminClassroomArticleStateRequest {
  @IsISO8601({ strict: true })
  expectedUpdatedAt: string;
}
```

Add `@ApiProperty`/`@ApiPropertyOptional` to each request field. Add `publicUrl` to `AdminClassroomArticleListItemDto`, and define the detail response with the existing list DTO:

```ts
export class AdminClassroomArticleDetailDto
  extends AdminClassroomArticleListItemDto
  implements AdminClassroomArticleDetail
{
  @ApiProperty({ description: "Server-cleaned editor HTML." })
  bodyHtml: string;
}

export class PublicClassroomArticleDetailDto
  extends PublicClassroomArticleListItemDto
  implements PublicClassroomArticleDetail
{
  @ApiProperty({ description: "Server-cleaned article HTML." })
  bodyHtml: string;
}
```

For upload Swagger, reuse `WebsitePublicMediaAssetDto` from the Website Content media DTO instead of adding another media response class.

- [ ] **Step 4: Register fixed media route before parameter routes**

```ts
type AuthRequest = Request & { user: AccessTokenPayload };
type MultipartFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

@Post("articles/media-assets")
@RequirePermissions("content.article.write_action")
@UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
async uploadArticleMedia(
  @UploadedFile() file: MultipartFile | undefined,
  @Req() request: AuthRequest,
): Promise<UploadAdminClassroomArticleMediaResponse> {
  if (!file) throw websiteContentInvalidMedia("请选择要上传的图片");
  const valid = await validateWebsiteMediaFile(file.buffer, file.originalname, file.mimetype);
  const asset = await this.media.upload(
    {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      operatorId: request.user.sub,
    },
    valid,
  );

  return asset.publicAsset;
}
```

Decorate upload with `@ApiConsumes("multipart/form-data")`, the fixed `file` binary body schema, `@ApiSuccessResponse(WebsitePublicMediaAssetDto)`, and `@ApiStandardErrors(400, 401, 403, 413, 503)`. Declare it before `@Get("articles/:id")`, then add the remaining methods:

```ts
@Get("articles/:id")
@RequirePermissions("content.article.write_action")
@ApiSuccessResponse(AdminClassroomArticleDetailDto)
@ApiStandardErrors(401, 403, 404, 500)
findArticle(@Param("id") id: string): Promise<AdminClassroomArticleDetail> {
  return this.articleService.findAdminArticle(id);
}

@Post("articles")
@RequirePermissions("content.article.write_action")
@ApiSuccessResponse(AdminClassroomArticleDetailDto)
@ApiStandardErrors(400, 401, 403, 500)
createArticle(
  @Body() dto: CreateAdminClassroomArticleDto,
  @Req() request: AuthRequest,
): Promise<AdminClassroomArticleDetail> {
  return this.articleService.createDraft(request.user.sub, dto);
}

@Put("articles/:id")
@RequirePermissions("content.article.write_action")
@ApiSuccessResponse(AdminClassroomArticleDetailDto)
@ApiStandardErrors(400, 401, 403, 404, 409, 500)
updateArticle(
  @Param("id") id: string,
  @Body() dto: UpdateAdminClassroomArticleDto,
): Promise<AdminClassroomArticleDetail> {
  return this.articleService.updateEditable(id, dto);
}

@Post("articles/:id/publish")
@HttpCode(HttpStatus.OK)
@RequirePermissions("content.article.publish_action")
@ApiSuccessResponse(AdminClassroomArticleDetailDto)
@ApiStandardErrors(400, 401, 403, 404, 409, 500)
publishArticle(
  @Param("id") id: string,
  @Body() dto: AdminClassroomArticleStateDto,
): Promise<AdminClassroomArticleDetail> {
  return this.articleService.publish(id, dto);
}

@Post("articles/:id/offline")
@HttpCode(HttpStatus.OK)
@RequirePermissions("content.article.publish_action")
@ApiSuccessResponse(AdminClassroomArticleDetailDto)
@ApiStandardErrors(401, 403, 404, 409, 500)
offlineArticle(
  @Param("id") id: string,
  @Body() dto: AdminClassroomArticleStateDto,
): Promise<AdminClassroomArticleDetail> {
  return this.articleService.offline(id, dto);
}
```

- [ ] **Step 5: Route article calls through ClassroomArticleService and register providers**

Inject `ClassroomArticleService` into public and admin controllers for article methods. Keep `ContentService` for rewards/posts. Wire the module without adding a second media provider:

```ts
// AdminContentController
findArticles(
  @Query() query: AdminClassroomArticleListQueryDto,
): Promise<AdminClassroomArticleListResponse> {
  return this.articleService.findArticlePage(query);
}

// PublicContentController
findArticles(
  @Query() query: PublicClassroomArticleListQueryDto,
): Promise<PublicClassroomArticleListResponse> {
  return this.articleService.findPublishedArticlePage(query);
}

findArticle(@Param("slug") slug: string): Promise<PublicClassroomArticleDetail> {
  return this.articleService.findPublishedArticleBySlug(slug);
}

@Module({
  imports: [AuthModule, WebsiteContentModule],
  controllers: [AdminContentController, PublicContentController],
  providers: [ContentService, ClassroomArticleService],
})
export class ContentModule {}
```

- [ ] **Step 6: Run controller and service tests**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/modules/content src/modules/website-content/website-media.service.spec.ts src/common/http/api-exception.filter.spec.ts --runInBand
```

Expected: PASS, and Swagger documents 400/401/403/404/409/503 where applicable.

- [ ] **Step 7: Commit Task 5**

```powershell
git add -- apps/server/src/modules/content/dto/admin-classroom-article.dto.ts apps/server/src/modules/content/dto/admin-classroom-article.dto.spec.ts apps/server/src/modules/content/dto/content-response.dto.ts apps/server/src/modules/content/admin-content.controller.ts apps/server/src/modules/content/admin-content.controller.spec.ts apps/server/src/modules/content/public-content.controller.ts apps/server/src/modules/content/public-content.controller.spec.ts apps/server/src/modules/content/content.module.ts apps/server/src/common/http/api-exception.filter.ts apps/server/src/common/http/api-exception.filter.spec.ts
git commit -m "feat(content): 暴露课堂文章管理接口"
```

### Task 6: Admin 文章 API 客户端

**Files:**

- Modify: `apps/admin/src/api/content/articles.ts`
- Modify: `apps/admin/src/api/content/content-api.test.ts`

**Interfaces:**

- Produces: `articleQueryKeys`
- Produces: `fetchAdminClassroomArticle(id)`
- Produces: `createAdminClassroomArticle(request)`
- Produces: `updateAdminClassroomArticle(id, request)`
- Produces: `publishAdminClassroomArticle(id, request)`
- Produces: `offlineAdminClassroomArticle(id, request)`
- Produces: `uploadAdminClassroomArticleMedia(file)`

- [ ] **Step 1: Write failing API path and FormData tests**

Extend the existing Axios mock once:

```ts
vi.mock("../auth", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));
```

```ts
const articleDetail: AdminClassroomArticleDetail = {
  id: "article-1",
  title: "幼犬喂养课堂",
  summary: "基础知识",
  coverUrl: null,
  publicUrl: "https://petcare-home.com/articles/article-1",
  bodyHtml: "<p>正文</p>",
  status: "draft",
  author: null,
  publishedAt: null,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};
const createRequest: CreateAdminClassroomArticleRequest = {
  title: articleDetail.title,
  summary: articleDetail.summary,
  bodyHtml: articleDetail.bodyHtml,
};
const updateRequest: UpdateAdminClassroomArticleRequest = {
  ...createRequest,
  expectedUpdatedAt: articleDetail.updatedAt,
};
const stateRequest = { expectedUpdatedAt: articleDetail.updatedAt };
const publicAsset: UploadAdminClassroomArticleMediaResponse = {
  id: "asset-1",
  url: "https://cdn/care.png",
  width: 800,
  height: 600,
  mimeType: "image/png",
};

it("calls every classroom article management endpoint", async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: articleDetail });
  vi.mocked(apiClient.post).mockResolvedValue({ data: articleDetail });
  vi.mocked(apiClient.put).mockResolvedValue({ data: articleDetail });

  await fetchAdminClassroomArticle("article-1");
  await createAdminClassroomArticle(createRequest);
  await updateAdminClassroomArticle("article-1", updateRequest);
  await publishAdminClassroomArticle("article-1", stateRequest);
  await offlineAdminClassroomArticle("article-1", stateRequest);

  expect(apiClient.get).toHaveBeenCalledWith("/admin/content/articles/article-1");
  expect(apiClient.post).toHaveBeenCalledWith("/admin/content/articles", createRequest);
  expect(apiClient.put).toHaveBeenCalledWith("/admin/content/articles/article-1", updateRequest);
  expect(apiClient.post).toHaveBeenCalledWith(
    "/admin/content/articles/article-1/publish",
    stateRequest,
  );
  expect(apiClient.post).toHaveBeenCalledWith(
    "/admin/content/articles/article-1/offline",
    stateRequest,
  );
});

it("uploads article media in the fixed multipart field", async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: publicAsset });
  await uploadAdminClassroomArticleMedia(new File(["png"], "care.png", { type: "image/png" }));
  const body = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;

  expect(apiClient.post).toHaveBeenCalledWith(
    "/admin/content/articles/media-assets",
    expect.any(FormData),
  );
  expect(body.get("file")).toBeInstanceOf(File);
});
```

- [ ] **Step 2: Run the API test and verify it fails**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/content/content-api.test.ts --pool=forks --maxWorkers=1
```

Expected: FAIL because only list fetching exists.

- [ ] **Step 3: Implement the thin API functions and keys**

```ts
export const articleQueryKeys = {
  all: ["admin-content-articles"] as const,
  detail: (id: string) => ["admin-content-articles", "detail", id] as const,
};

export async function publishAdminClassroomArticle(
  id: string,
  request: AdminClassroomArticleStateRequest,
): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.post<AdminClassroomArticleDetail>(
    `/admin/content/articles/${id}/publish`,
    request,
  );
  return response.data;
}

export async function fetchAdminClassroomArticle(id: string): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.get<AdminClassroomArticleDetail>(
    `/admin/content/articles/${id}`,
  );
  return response.data;
}

export async function createAdminClassroomArticle(
  request: CreateAdminClassroomArticleRequest,
): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.post<AdminClassroomArticleDetail>(
    "/admin/content/articles",
    request,
  );
  return response.data;
}

export async function updateAdminClassroomArticle(
  id: string,
  request: UpdateAdminClassroomArticleRequest,
): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.put<AdminClassroomArticleDetail>(
    `/admin/content/articles/${id}`,
    request,
  );
  return response.data;
}

export async function offlineAdminClassroomArticle(
  id: string,
  request: AdminClassroomArticleStateRequest,
): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.post<AdminClassroomArticleDetail>(
    `/admin/content/articles/${id}/offline`,
    request,
  );
  return response.data;
}

export async function uploadAdminClassroomArticleMedia(
  file: File,
): Promise<UploadAdminClassroomArticleMediaResponse> {
  const form = new FormData();
  form.set("file", file);
  const response = await apiClient.post<UploadAdminClassroomArticleMediaResponse>(
    "/admin/content/articles/media-assets",
    form,
  );
  return response.data;
}
```

The existing `apps/admin/src/api/content/index.ts` already exports `./articles`, so it requires no edit.

- [ ] **Step 4: Run the API test and verify it passes**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/content/content-api.test.ts --pool=forks --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```powershell
git add -- apps/admin/src/api/content/articles.ts apps/admin/src/api/content/content-api.test.ts
git commit -m "feat(admin): 接入课堂文章管理接口"
```

### Task 7: Tiptap 图文编辑器

**Files:**

- Create: `apps/admin/src/pages/ContentManagement/Articles/RichTextEditor.tsx`
- Create: `apps/admin/src/pages/ContentManagement/Articles/RichTextEditor.test.tsx`

**Interfaces:**

- Produces: `RichTextEditor({ value, disabled, onChange, onUpload })`
- Consumes: `onUpload(file: File): Promise<UploadAdminClassroomArticleMediaResponse>`

- [ ] **Step 1: Write failing formatting and managed-image tests**

```tsx
it("emits HTML for typed and bold content", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<RichTextEditor value="" onChange={onChange} onUpload={vi.fn()} />);

  await user.type(screen.getByRole("textbox", { name: "文章正文" }), "护理知识");
  await user.keyboard("{Control>}a{/Control}");
  await user.click(screen.getByRole("button", { name: "粗体" }));

  expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("<strong>护理知识</strong>"));
});

it("uploads and inserts only a managed image node", async () => {
  const onChange = vi.fn();
  const onUpload = vi.fn().mockResolvedValue({
    id: "asset-1",
    url: "https://cdn/care.png",
    width: 800,
    height: 600,
    mimeType: "image/png",
  });
  const { container } = render(<RichTextEditor value="" onChange={onChange} onUpload={onUpload} />);
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [new File(["png"], "care.png", { type: "image/png" })] },
  });

  await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
  expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('data-asset-id="asset-1"'));
});
```

- [ ] **Step 2: Run editor tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/ContentManagement/Articles/RichTextEditor.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because the editor does not exist.

- [ ] **Step 3: Define the managed Image extension and editor configuration**

```tsx
const ManagedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: { default: "" },
      "data-asset-id": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset-id"),
        renderHTML: (attributes) =>
          attributes["data-asset-id"] ? { "data-asset-id": attributes["data-asset-id"] } : {},
      },
    };
  },
});

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false, autolink: false, defaultProtocol: "https" },
    }),
    ManagedImage.configure({ allowBase64: false, inline: false }),
  ],
  content: value,
  editable: !disabled,
  editorProps: { attributes: { "aria-label": "文章正文" } },
  onUpdate: ({ editor: nextEditor }) => onChange(nextEditor.getHTML()),
});
```

Synchronize controlled values without feeding `onUpdate` back into the parent:

```tsx
useEffect(() => {
  if (editor && editor.getHTML() !== value) {
    editor.commands.setContent(value, { emitUpdate: false });
  }
}, [editor, value]);

useEffect(() => {
  editor?.setEditable(!disabled);
}, [disabled, editor]);

<EditorContent
  editor={editor}
  className="min-h-64 rounded-b-lg border border-t-0 border-slate-300 p-4 [&_.tiptap]:min-h-56 [&_.tiptap]:outline-none [&_.tiptap_a]:text-blue-700 [&_.tiptap_a]:underline [&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-slate-300 [&_.tiptap_blockquote]:pl-4 [&_.tiptap_h2]:mt-6 [&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:mt-5 [&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-semibold [&_.tiptap_img]:my-4 [&_.tiptap_img]:max-w-full [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-6 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-6"
/>;
```

- [ ] **Step 4: Implement the exact toolbar and image insertion**

Render the toolbar from these concrete controls so every state uses the same native `disabled` and `aria-pressed` contract:

```tsx
const controls = [
  {
    label: "段落",
    toggle: true,
    active: editor.isActive("paragraph"),
    run: () => editor.chain().focus().setParagraph().run(),
  },
  {
    label: "二级标题",
    toggle: true,
    active: editor.isActive("heading", { level: 2 }),
    run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "三级标题",
    toggle: true,
    active: editor.isActive("heading", { level: 3 }),
    run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "粗体",
    toggle: true,
    active: editor.isActive("bold"),
    run: () => editor.chain().focus().toggleBold().run(),
  },
  {
    label: "斜体",
    toggle: true,
    active: editor.isActive("italic"),
    run: () => editor.chain().focus().toggleItalic().run(),
  },
  {
    label: "删除线",
    toggle: true,
    active: editor.isActive("strike"),
    run: () => editor.chain().focus().toggleStrike().run(),
  },
  {
    label: "有序列表",
    toggle: true,
    active: editor.isActive("orderedList"),
    run: () => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "无序列表",
    toggle: true,
    active: editor.isActive("bulletList"),
    run: () => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: "引用",
    toggle: true,
    active: editor.isActive("blockquote"),
    run: () => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    label: "撤销",
    toggle: false,
    active: false,
    disabled: !editor.can().undo(),
    run: () => editor.chain().focus().undo().run(),
  },
  {
    label: "重做",
    toggle: false,
    active: false,
    disabled: !editor.can().redo(),
    run: () => editor.chain().focus().redo().run(),
  },
] as const;

function editLink(): void {
  const href = window.prompt("请输入 http、https 或 mailto 链接");
  if (href === null) return;
  if (href === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  if (!/^(https?:|mailto:)/iu.test(href)) return;
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

<div role="toolbar" aria-label="文章格式">
  {controls.map((control) => (
    <button
      key={control.label}
      type="button"
      aria-label={control.label}
      aria-pressed={control.toggle ? control.active : undefined}
      disabled={disabled || uploading || ("disabled" in control && control.disabled)}
      onClick={control.run}
      className="min-h-10 cursor-pointer rounded-md border border-slate-300 px-3 text-sm aria-pressed:border-blue-700 aria-pressed:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    >
      {control.label}
    </button>
  ))}
  <button
    type="button"
    aria-label="链接"
    aria-pressed={editor.isActive("link")}
    disabled={disabled || uploading}
    onClick={editLink}
    className="min-h-10 cursor-pointer rounded-md border border-slate-300 px-3 text-sm aria-pressed:border-blue-700 aria-pressed:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
  >
    链接
  </button>
</div>;
```

```ts
async function insertImage(file: File): Promise<void> {
  setUploading(true);
  try {
    const asset = await onUpload(file);
    editor?.chain().focus().insertContent({
      type: "image",
      attrs: {
        src: asset.url,
        alt: file.name,
        "data-asset-id": asset.id,
      },
    }).run();
  } catch (error) {
    showApiError(error);
  } finally {
    setUploading(false);
  }
}

<label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-slate-300 px-3 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-slate-100">
  插入图片
  <input
    type="file"
    aria-label="插入正文图片"
    accept="image/jpeg,image/png,image/webp"
    disabled={disabled || uploading}
    className="sr-only"
    onChange={(event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void insertImage(file);
    }}
  />
</label>
```

The file input accepts `image/jpeg,image/png,image/webp`, uses `aria-label="插入正文图片"`, and is disabled with the toolbar while `disabled || uploading`. Add this direct-failure assertion; do not render a second inline API error:

```tsx
const globalErrors = vi.hoisted(() => ({ showApiError: vi.fn() }));
vi.mock("../../../lib/global-error", () => globalErrors);

it("reports a failed image upload through the global message", async () => {
  const failure = { response: { data: { message: "图片上传失败" } } };
  const user = userEvent.setup();
  render(
    <RichTextEditor value="" onChange={vi.fn()} onUpload={vi.fn().mockRejectedValue(failure)} />,
  );

  await user.upload(
    screen.getByLabelText("插入正文图片"),
    new File(["png"], "care.png", { type: "image/png" }),
  );

  await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(failure));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Run editor tests and verify they pass**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/ContentManagement/Articles/RichTextEditor.test.tsx --pool=forks --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```powershell
git add -- apps/admin/src/pages/ContentManagement/Articles/RichTextEditor.tsx apps/admin/src/pages/ContentManagement/Articles/RichTextEditor.test.tsx
git commit -m "feat(admin): 增加课堂文章图文编辑器"
```

### Task 8: 新建与编辑草稿页面

**Files:**

- Create: `apps/admin/src/pages/ContentManagement/Articles/Edit.tsx`
- Create: `apps/admin/src/pages/ContentManagement/Articles/Edit.test.tsx`
- Modify: `apps/admin/src/routes/registry.ts`
- Modify: `apps/admin/src/routes/registry.test.ts`
- Modify: `apps/admin/src/App.test.tsx`

**Interfaces:**

- Consumes: API functions and query keys from Task 6
- Consumes: `RichTextEditor` from Task 7
- Produces: `/content/articles/new` and `/content/articles/:id/edit`

- [ ] **Step 1: Write failing route and create-form tests**

```tsx
it("registers article create and edit routes with write permission", () => {
  expect(ADMIN_ROUTE_REGISTRY).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: "/content/articles/new",
        requiredPermissions: ["content.article.write"],
      }),
      expect.objectContaining({
        path: "/content/articles/:id/edit",
        requiredPermissions: ["content.article.write"],
      }),
    ]),
  );
});

it("creates a draft without publishing it", async () => {
  const user = userEvent.setup();
  renderEdit("/content/articles/new");
  await user.type(screen.getByLabelText("标题"), "幼犬喂养课堂");
  await user.type(screen.getByLabelText("摘要"), "基础喂养知识");
  fireEvent.change(screen.getByLabelText("文章正文"), { target: { value: "<p>正文</p>" } });
  await user.click(screen.getByRole("button", { name: "保存草稿" }));

  expect(createAdminClassroomArticle).toHaveBeenCalledWith({
    title: "幼犬喂养课堂",
    summary: "基础喂养知识",
    bodyHtml: "<p>正文</p>",
    coverAssetId: undefined,
  });
  expect(publishAdminClassroomArticle).not.toHaveBeenCalled();
});
```

Mock `RichTextEditor` in the page test as a labeled textarea that passes its value to `onChange`.

- [ ] **Step 2: Run route and edit tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/ContentManagement/Articles/Edit.test.tsx src/routes/registry.test.ts src/App.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because the page and routes do not exist.

- [ ] **Step 3: Add the two protected routes**

Import `ContentArticleEdit` directly and add these non-menu definitions:

```tsx
{
  id: "content-articles-new",
  path: "/content/articles/new",
  element: createElement(ContentArticleEdit),
  menuPermission: null,
  requiredPermissions: ["content.article.write"],
  parentPath: "/content/articles",
  order: 0,
  icon: null,
  menuLabel: null,
},
{
  id: "content-articles-edit",
  path: "/content/articles/:id/edit",
  element: createElement(ContentArticleEdit),
  menuPermission: null,
  requiredPermissions: ["content.article.write"],
  parentPath: "/content/articles",
  order: 0,
  icon: null,
  menuLabel: null,
},
```

Add this route assertion to `App.test.tsx`:

```tsx
vi.mock("./pages/ContentManagement/Articles/Edit", () => ({
  default: () => "课堂文章编辑路由",
}));

it.each(["/content/articles/new", "/content/articles/article-1/edit"])(
  "registers the article editor route %s",
  async (path) => {
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(await screen.findByText("课堂文章编辑路由")).toBeInTheDocument();
  },
);
```

- [ ] **Step 4: Implement form state, detail loading and optimistic update**

```tsx
const articleQuery = useQuery({
  queryKey: articleQueryKeys.detail(articleId ?? "new"),
  queryFn: () => fetchAdminClassroomArticle(articleId!),
  enabled: Boolean(articleId),
});

const saveMutation = useMutation({
  mutationFn: async () => {
    if (!articleId) {
      return createAdminClassroomArticle({
        title: title.trim(),
        summary: summary.trim(),
        bodyHtml,
        coverAssetId,
      });
    }
    return updateAdminClassroomArticle(articleId, {
      title: title.trim(),
      summary: summary.trim(),
      bodyHtml,
      coverAssetId,
      expectedUpdatedAt: articleQuery.data!.updatedAt,
    });
  },
  onSuccess: (saved) => {
    queryClient.setQueryData(articleQueryKeys.detail(saved.id), saved);
    if (!articleId) navigate(`/content/articles/${saved.id}/edit`, { replace: true });
  },
});
```

Initialize title, summary, `bodyHtml`, `coverUrl`, and `coverAssetId=undefined` exactly once when detail data arrives. Server errors remain owned by the global mutation cache.

```tsx
const initializedId = useRef<string | null>(null);

useEffect(() => {
  const article = articleQuery.data;
  if (!article || initializedId.current === article.id) return;
  initializedId.current = article.id;
  setTitle(article.title);
  setSummary(article.summary);
  setBodyHtml(article.bodyHtml);
  setCoverUrl(article.coverUrl);
  setCoverAssetId(undefined);
}, [articleQuery.data]);

if (articleQuery.data?.status === "published") {
  return (
    <div role="alert">
      已发布文章需先下线后编辑。
      <Link to="/content/articles">返回文章列表</Link>
    </div>
  );
}
```

- [ ] **Step 5: Implement cover and inline image upload paths**

Use the direct-error seam from the global-error plan for cover uploads; `RichTextEditor` owns the same seam for inline upload failures:

```tsx
const [mediaUploading, setMediaUploading] = useState(false);

async function uploadMedia(file: File): Promise<UploadAdminClassroomArticleMediaResponse> {
  setMediaUploading(true);
  try {
    return await uploadAdminClassroomArticleMedia(file);
  } finally {
    setMediaUploading(false);
  }
}

async function uploadCover(file: File): Promise<void> {
  try {
    const asset = await uploadMedia(file);
    setCoverAssetId(asset.id);
    setCoverUrl(asset.url);
  } catch (error) {
    showApiError(error);
  }
}

function submitForm(event: FormEvent<HTMLFormElement>): void {
  event.preventDefault();
  if (!title.trim() || !summary.trim()) {
    setFormError("标题和摘要不能为空");
    return;
  }
  setFormError(null);
  saveMutation.mutate();
}

<form onSubmit={submitForm}>
  <label>
    标题
    <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
  </label>
  <label>
    摘要
    <textarea
      value={summary}
      maxLength={500}
      onChange={(event) => setSummary(event.target.value)}
    />
  </label>
  <label>
    上传封面
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      disabled={saveMutation.isPending || mediaUploading}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void uploadCover(file);
      }}
    />
  </label>
  {coverUrl ? <img src={coverUrl} alt="文章封面预览" /> : null}
  {coverUrl ? (
    <button
      type="button"
      onClick={() => {
        setCoverAssetId(null);
        setCoverUrl(null);
      }}
    >
      移除封面
    </button>
  ) : null}
  <RichTextEditor
    value={bodyHtml}
    disabled={saveMutation.isPending || mediaUploading}
    onChange={setBodyHtml}
    onUpload={uploadMedia}
  />
  {formError ? <p role="alert">{formError}</p> : null}
  <button type="submit" disabled={saveMutation.isPending || mediaUploading}>
    {articleId ? "保存修改" : "保存草稿"}
  </button>
</form>;
```

Before mutating, trim and require title/summary locally and render those field errors inline. Do not add an implicit publish call.

- [ ] **Step 6: Add edit and cover semantics tests**

```tsx
it("updates an offline article with its observed timestamp and retains an omitted cover", async () => {
  fetchAdminClassroomArticle.mockResolvedValue({
    ...articleDetail,
    status: "offline",
    coverUrl: "https://cdn/old.png",
  });
  const user = userEvent.setup();
  renderEdit("/content/articles/article-1/edit");
  await screen.findByDisplayValue("幼犬喂养课堂");
  await user.click(screen.getByRole("button", { name: "保存修改" }));

  expect(updateAdminClassroomArticle).toHaveBeenCalledWith(
    "article-1",
    expect.objectContaining({
      coverAssetId: undefined,
      expectedUpdatedAt: articleDetail.updatedAt,
    }),
  );
});
```

Add these independent cover and published-state cases:

```tsx
it("saves a selected managed cover id", async () => {
  uploadAdminClassroomArticleMedia.mockResolvedValue(publicAsset);
  const user = userEvent.setup();
  renderEdit("/content/articles/article-1/edit");
  await screen.findByDisplayValue("幼犬喂养课堂");

  await user.upload(
    screen.getByLabelText("上传封面"),
    new File(["png"], "cover.png", { type: "image/png" }),
  );
  await screen.findByRole("img", { name: "文章封面预览" });
  await user.click(screen.getByRole("button", { name: "保存修改" }));

  expect(updateAdminClassroomArticle).toHaveBeenCalledWith(
    "article-1",
    expect.objectContaining({ coverAssetId: publicAsset.id }),
  );
});

it("sends null after removing an existing cover", async () => {
  fetchAdminClassroomArticle.mockResolvedValue({
    ...articleDetail,
    status: "offline",
    coverUrl: "https://cdn/old.png",
  });
  const user = userEvent.setup();
  renderEdit("/content/articles/article-1/edit");
  await screen.findByRole("img", { name: "文章封面预览" });

  await user.click(screen.getByRole("button", { name: "移除封面" }));
  await user.click(screen.getByRole("button", { name: "保存修改" }));

  expect(updateAdminClassroomArticle).toHaveBeenCalledWith(
    "article-1",
    expect.objectContaining({ coverAssetId: null }),
  );
});

it("does not expose an edit form for a published article", async () => {
  fetchAdminClassroomArticle.mockResolvedValue({ ...articleDetail, status: "published" });
  renderEdit("/content/articles/article-1/edit");

  expect(await screen.findByRole("alert")).toHaveTextContent("已发布文章需先下线后编辑");
  expect(screen.queryByRole("button", { name: "保存修改" })).not.toBeInTheDocument();
});
```

- [ ] **Step 7: Run page and route tests**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/ContentManagement/Articles/Edit.test.tsx src/routes/registry.test.ts src/App.test.tsx --pool=forks --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 8: Commit Task 8**

```powershell
git add -- apps/admin/src/pages/ContentManagement/Articles/Edit.tsx apps/admin/src/pages/ContentManagement/Articles/Edit.test.tsx apps/admin/src/routes/registry.ts apps/admin/src/routes/registry.test.ts apps/admin/src/App.test.tsx
git commit -m "feat(admin): 支持新建和编辑课堂文章草稿"
```

### Task 9: 列表发布、下线与权限动作

**Files:**

- Modify: `apps/admin/src/pages/ContentManagement/Articles/index.tsx`
- Modify: `apps/admin/src/pages/ContentManagement/Articles/index.test.tsx`

**Interfaces:**

- Consumes: `content.article.write` and `content.article.publish` UI permissions
- Consumes: publish/offline API functions from Task 6
- Produces: state-specific list actions

- [ ] **Step 1: Write failing permission and state-action tests**

```tsx
const permissionMocks = vi.hoisted(() => ({ has: vi.fn() }));
vi.mock("../../../auth/permissions", () => ({ usePermissions: () => permissionMocks }));

const draftArticle: AdminClassroomArticleListItem = {
  id: "article-1",
  title: "幼犬喂养课堂",
  summary: "基础知识",
  coverUrl: null,
  publicUrl: "https://petcare-home.com/articles/article-1",
  status: "draft",
  author: null,
  publishedAt: null,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};
const publishedArticle: AdminClassroomArticleListItem = {
  ...draftArticle,
  id: "article-2",
  title: "已发布文章",
  publicUrl: "https://petcare-home.com/articles/article-2",
  status: "published",
  publishedAt: "2026-08-24T01:00:00.000Z",
};
const offlineArticle: AdminClassroomArticleListItem = {
  ...draftArticle,
  id: "article-3",
  title: "已下线文章",
  publicUrl: "https://petcare-home.com/articles/article-3",
  status: "offline",
};

it("shows only actions allowed by article state and operator permissions", async () => {
  permissionMocks.has.mockImplementation((code) =>
    ["content.article.write", "content.article.publish"].includes(code),
  );
  fetchAdminClassroomArticles.mockResolvedValue({
    list: [draftArticle, publishedArticle, offlineArticle],
    total: 3,
    page: 1,
    pageSize: 20,
  });
  renderPage();

  expect(await screen.findByRole("link", { name: "新建文章" })).toHaveAttribute(
    "href",
    "/content/articles/new",
  );
  expect(screen.getAllByRole("link", { name: "编辑" })).toHaveLength(2);
  expect(screen.getByRole("button", { name: "发布 幼犬喂养课堂" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "下线 已发布文章" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重新发布 已下线文章" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "查看官网 已发布文章" })).toHaveAttribute(
    "href",
    publishedArticle.publicUrl,
  );
});
```

- [ ] **Step 2: Run list tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/ContentManagement/Articles/index.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because rows have no action column.

- [ ] **Step 3: Implement the controlled confirmation dialog**

```tsx
interface ArticleStateDialogProps {
  article: AdminClassroomArticleListItem | null;
  action: "publish" | "offline";
  pending: boolean;
  onConfirm(): void;
  onOpenChange(open: boolean): void;
}

function ArticleStateDialog({
  article,
  action,
  pending,
  onConfirm,
  onOpenChange,
}: ArticleStateDialogProps) {
  const publishing = action === "publish";

  return (
    <Dialog.Root open={article !== null} onOpenChange={(open) => !pending && onOpenChange(open)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-slate-950">
            {publishing ? "确认发布文章" : "确认下线文章"}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-slate-600">
            {publishing
              ? `发布后官网将立即展示《${article?.title ?? ""}》。`
              : `下线后官网将不再展示《${article?.title ?? ""}》。`}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={pending}
                className="min-h-11 rounded-lg border px-4 disabled:cursor-not-allowed"
              >
                取消
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className="min-h-11 cursor-pointer rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {pending ? "处理中…" : publishing ? "确认发布" : "确认下线"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Add state-specific row actions and mutations**

```tsx
const [dialog, setDialog] = useState<{
  article: AdminClassroomArticleListItem;
  action: "publish" | "offline";
} | null>(null);

const publishMutation = useMutation({
  mutationFn: (article: AdminClassroomArticleListItem) =>
    publishAdminClassroomArticle(article.id, { expectedUpdatedAt: article.updatedAt }),
  onSuccess: async () => {
    setDialog(null);
    await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all });
  },
});

const offlineMutation = useMutation({
  mutationFn: (article: AdminClassroomArticleListItem) =>
    offlineAdminClassroomArticle(article.id, { expectedUpdatedAt: article.updatedAt }),
  onSuccess: async () => {
    setDialog(null);
    await queryClient.invalidateQueries({ queryKey: articleQueryKeys.all });
  },
});

const dialogPending =
  dialog?.action === "publish" ? publishMutation.isPending : offlineMutation.isPending;

<ArticleStateDialog
  article={dialog?.article ?? null}
  action={dialog?.action ?? "publish"}
  pending={dialogPending}
  onOpenChange={(open) => {
    if (!open) setDialog(null);
  }}
  onConfirm={() => {
    if (!dialog) return;
    if (dialog.action === "publish") publishMutation.mutate(dialog.article);
    else offlineMutation.mutate(dialog.article);
  }}
/>;
```

Use `usePermissions()` once in the page and derive `canWrite`/`canPublish`. Pass callbacks into `ArticleRow`; set `{ article, action }` as dialog state. Hide every write/publish control when its UI permission is absent instead of rendering a disabled substitute. Add an “操作” header/cell only once; the published website link remains visible to read-only users.

```tsx
{
  canWrite && article.status !== "published" ? (
    <Link to={`/content/articles/${article.id}/edit`}>编辑</Link>
  ) : null;
}
{
  article.status === "published" ? (
    <a
      href={article.publicUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`查看官网 ${article.title}`}
    >
      查看官网
    </a>
  ) : null;
}
{
  canPublish ? (
    article.status === "published" ? (
      <button
        type="button"
        aria-label={`下线 ${article.title}`}
        onClick={() => onStateChange(article, "offline")}
      >
        下线
      </button>
    ) : (
      <button
        type="button"
        aria-label={`${article.status === "offline" ? "重新发布" : "发布"} ${article.title}`}
        onClick={() => onStateChange(article, "publish")}
      >
        {article.status === "offline" ? "重新发布" : "发布"}
      </button>
    )
  ) : null;
}
```

- [ ] **Step 5: Verify explicit confirmation and refreshed timestamps**

```tsx
await user.click(screen.getByRole("button", { name: "发布 幼犬喂养课堂" }));
expect(screen.getByRole("dialog", { name: "确认发布文章" })).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "确认发布" }));
expect(publishAdminClassroomArticle).toHaveBeenCalledWith("article-1", {
  expectedUpdatedAt: draftArticle.updatedAt,
});
await waitFor(() => expect(fetchAdminClassroomArticles).toHaveBeenCalledTimes(2));
```

Add a read-only permission case:

```tsx
permissionMocks.has.mockReturnValue(false);
renderPage();
await screen.findByText("幼犬喂养课堂");
expect(screen.queryByRole("link", { name: "新建文章" })).not.toBeInTheDocument();
expect(screen.queryByRole("link", { name: "编辑" })).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: /发布|下线/u })).not.toBeInTheDocument();
expect(screen.getByRole("link", { name: "查看官网 已发布文章" })).toBeInTheDocument();
```

- [ ] **Step 6: Run list tests and verify they pass**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/ContentManagement/Articles/index.test.tsx --pool=forks --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 7: Commit Task 9**

```powershell
git add -- apps/admin/src/pages/ContentManagement/Articles/index.tsx apps/admin/src/pages/ContentManagement/Articles/index.test.tsx
git commit -m "feat(admin): 支持发布和下线课堂文章"
```

### Task 10: 官网安全富文本渲染

**Files:**

- Modify: `apps/website/src/lib/api.test.ts`
- Modify: `apps/website/src/pages/articles/[slug].astro`
- Modify: `apps/website/src/routes/article-route-contract.test.ts`
- Modify: `apps/website/src/styles/global.css`
- Modify: `apps/server/src/modules/content/classroom-article.service.spec.ts`

**Interfaces:**

- Consumes: public `bodyHtml` from Task 1 and Server-safe output from Task 4
- Produces: responsive article rich-text rendering

- [ ] **Step 1: Change Website tests to the safe HTML contract**

```ts
// apps/website/src/lib/api.test.ts
it("reads one published article with Server-cleaned HTML", async () => {
  const article = { ...articleList.list[0], bodyHtml: "<p>护理正文</p>" };
  const fetcher = vi.fn().mockResolvedValue(successResponse(article));
  const api = createWebsiteContentApi({ baseUrl: "http://server:3000", fetcher });

  await expect(api.getArticle("pet-first-aid")).resolves.toEqual(article);
});

// apps/website/src/routes/article-route-contract.test.ts
expect(detailSource).toContain("set:html={article.bodyHtml}");
expect(detailSource).not.toContain("set:html={article.body}");
```

- [ ] **Step 2: Run Website tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/website exec vitest run src/lib/api.test.ts src/routes/article-route-contract.test.ts
```

Expected: FAIL because the page still renders `article.body` as text.

- [ ] **Step 3: Render only the Server-owned HTML field**

```astro
<div class="article-detail__body" set:html={article.bodyHtml} />
```

Do not call `set:html` for any other response field and do not add browser-side sanitization as a substitute for Server validation.

- [ ] **Step 4: Add bounded rich-text styles**

```css
.article-detail__body {
  max-width: 52rem;
  margin-top: 3rem;
  color: #475467;
  line-height: 1.8;
}

.article-detail__body :where(h2, h3) {
  margin: 2rem 0 0.75rem;
  color: #101828;
  line-height: 1.3;
}

.article-detail__body :where(p, ul, ol, blockquote) {
  margin: 1rem 0;
}

.article-detail__body ul {
  padding-left: 1.5rem;
  list-style: disc;
}

.article-detail__body ol {
  padding-left: 1.5rem;
  list-style: decimal;
}

.article-detail__body a {
  color: var(--brand);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.article-detail__body img {
  display: block;
  width: min(100%, 52rem);
  height: auto;
  margin: 1.5rem auto;
  border-radius: 1rem;
}

.article-detail__body blockquote {
  padding-left: 1rem;
  border-left: 3px solid var(--brand);
}
```

Remove `white-space: pre-wrap`; legacy content already arrives as paragraphs.

- [ ] **Step 5: Run Server public safety and Website tests**

Run:

```powershell
pnpm --filter @petcare/server exec jest src/modules/content/classroom-article-content.spec.ts src/modules/content/classroom-article.service.spec.ts src/modules/content/public-content.controller.spec.ts --runInBand
pnpm --filter @petcare/website exec vitest run src/lib/api.test.ts src/routes/article-route-contract.test.ts
```

Expected: PASS; public service tests prove only published rows return and old HTML-looking text stays escaped.

- [ ] **Step 6: Commit Task 10**

```powershell
git add -- apps/website/src/lib/api.test.ts apps/website/src/pages/articles/[slug].astro apps/website/src/routes/article-route-contract.test.ts apps/website/src/styles/global.css apps/server/src/modules/content/classroom-article.service.spec.ts
git commit -m "feat(website): 安全渲染课堂文章富文本"
```

### Task 11: 课堂文章发布范围验证

**Files:**

- Verify only; no source file is created by this task.

**Interfaces:**

- Verifies every contract and runtime boundary produced by Tasks 1 through 10.

- [ ] **Step 1: Verify shared contracts and permissions**

```powershell
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/shared-types typecheck
pnpm --filter @petcare/shared-types lint
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify focused Server modules**

```powershell
pnpm --filter @petcare/server exec jest src/modules/content src/modules/website-content/website-media.service.spec.ts src/modules/website-content/admin-website-content.controller.spec.ts --runInBand
pnpm --filter @petcare/server lint
pnpm --filter @petcare/server typecheck
pnpm --filter @petcare/server build
```

Expected: all commands exit 0.

- [ ] **Step 3: Verify Admin article behavior and styles**

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/content/content-api.test.ts src/pages/ContentManagement/Articles src/routes/registry.test.ts src/App.test.tsx --pool=forks --maxWorkers=1
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin build
```

Expected: all commands exit 0.

- [ ] **Step 4: Verify Website article rendering and styles**

```powershell
pnpm --filter @petcare/website exec vitest run src/lib/api.test.ts src/routes/article-route-contract.test.ts
pnpm --filter @petcare/website lint
pnpm --filter @petcare/website typecheck
pnpm --filter @petcare/website build
```

Expected: all commands exit 0.

- [ ] **Step 5: Check patch hygiene and decide whether E2E is necessary**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and only planned files are changed. Add and run a focused Admin-to-Website Playwright case only if scoped tests expose an unresolved runtime boundary; do not run unrelated full E2E by default.
