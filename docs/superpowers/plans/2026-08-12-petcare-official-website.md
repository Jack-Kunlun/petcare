# PetCare Configurable Official Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Astro SSR official website whose preset page sections are edited in the existing Admin, saved as immutable drafts, previewed safely, and explicitly published per page without rebuilding or redeploying.

**Architecture:** `apps/website` renders only published snapshots from a new NestJS `WebsiteContentModule`. PostgreSQL owns content identity and immutable versions; Redis caches immutable published versions; a bounded Astro process cache provides short failure fallback. Admin uses structured editors backed by shared discriminated unions. Media objects live in the project's existing Tencent Cloud COS account while content snapshots store only `assetId` references. The first release locks page structure through code templates but preserves section identity, type, order, enablement, and schema version so later create/archive/reorder commands can be added without replacing the publishing kernel.

**Tech Stack:** Astro SSR with `@astrojs/node`, TypeScript, Tailwind CSS v4 through `@tailwindcss/vite`, NestJS 11, Prisma 7, PostgreSQL, Redis, `cos-nodejs-sdk-v5`, React 19, TanStack Query, Jest, Vitest, Testing Library, Playwright, Docker, Nginx.

## Global Constraints

- Use Node.js `24.19.0`; supported range is `>=24.12.0 <25`.
- Use the repository-pinned pnpm version and preserve unrelated or concurrent workspace changes.
- Use the repository naming rules: directory and REST path `kebab-case`, classes and shared types `PascalCase`, variables and HTTP fields `camelCase`, constants `SCREAMING_SNAKE_CASE`, persisted business values `snake_case`.
- All request/response contracts, stable business values, and error codes live in `@petcare/shared-types`; every shared field, business value, and public function has purpose-focused JSDoc.
- Server configuration is accessed only through `ConfigService`; no website module reads `process.env`.
- Replace the stale `ALIYUN_OSS_*` configuration with the already-approved `TENCENT_COS_*` group. Do not keep two provider configurations or introduce website-specific COS credentials.
- Reuse `cos-nodejs-sdk-v5` and the same `TENCENT_COS_*` values as other public assets. Keep website media behind its own narrow adapter because its lifecycle and object prefix differ from account avatars.
- COS credentials stay server-side and never enter Admin, Website, API responses, logs, or build-time public environment variables.
- Media uploads accept JPEG, PNG, and WebP, at most `10 * 1024 * 1024` bytes, with decoded width and height between 32 and 8192 pixels.
- Admin uses existing components, Tailwind utilities, and the 14 px base size; do not add a form framework, toast library, drag-and-drop library, or rich-text/HTML editor.
- Astro has no React/Vue client runtime in the first release. Use Astro, CSS, and small native scripts for the mobile menu and preview-token exchange.
- No arbitrary HTML, CSS, JavaScript, component path, object key, or external protocol may be stored through the content API.
- Saving, publishing, restoring, and preview generation are separate commands. Publishing is always explicit and page-scoped.
- Every save creates a new immutable draft snapshot; old draft and published snapshots are never updated in place.
- Do not generate or hand-edit `prisma/migrations`; this repository currently applies schema changes with `prisma:push`.
- Implement every behavior test-first with Red-Green-Refactor and commit only the paths named by that task. If concurrent work already changed a listed file, reconcile it deliberately rather than overwriting it.

## Fixed Initial Limits

- Preview token lifetime: 10 minutes.
- Published-version Redis TTL: 24 hours; cache keys are immutable version IDs.
- Astro last-success fallback window: 5 minutes; preview content is never stored there.
- Preview cookie: `petcare_website_preview`, `HttpOnly`, `SameSite=Lax`, `Secure` in production, path `/preview`, maximum age 10 minutes.
- Public page HTML must be generated per request; do not apply a CDN HTML TTL that can hide a new publish.
- Supported initial content keys: `site_shell`, `home`, `services`, `trust`, `companions`, `about`, `contact`, `privacy`, and `terms`.
- Supported initial section types: `site_header`, `site_footer`, `hero`, `trust_grid`, `feature_split`, `cta`, `rich_text`, and `contact_panel`.
- Classroom articles remain owned by `ContentModule`; the website content module does not duplicate or edit them.

## File Structure

### Shared contracts

- `packages/shared-types/src/api/website-content.ts`: content keys, section unions, Admin/public requests and responses, error codes, and media contracts.
- `packages/shared-types/src/api/website-content.spec.ts`: stable values and discriminant coverage.
- `packages/shared-types/src/api/index.ts`: public export.

### Server

- `apps/server/src/modules/website-content/`: module, controllers, DTOs, registry, templates, draft/publish/history/preview/media/public services, cache, audit, and tests.
- `apps/server/prisma/schema.prisma`: website content, immutable version, section, media, preview token, and audit models.
- `apps/server/prisma/seed-website-content.ts`: idempotent initial page/global snapshots.
- `apps/server/prisma/seed.ts`: call the website seed.
- `apps/server/src/config/config.service.ts`: Tencent COS and website runtime configuration.
- `apps/server/src/config/config.service.spec.ts`: grouped validation and typed getter tests.
- `apps/server/src/modules/content/`: published classroom-article website endpoints only.

### Admin

- `apps/admin/src/api/website-content/`: API client and tests.
- `apps/admin/src/pages/WebsiteContent/`: overview, preset-section editor, diff/publish dialog, history detail, preview, and media picker.
- `apps/admin/src/routes/registry.ts`: protected lazy routes.
- `packages/shared-types/src/rbac/permission-catalog.ts`: menu/button/API permission catalog consumed by the idempotent initial seed.

### Website

- `apps/website/`: Astro application workspace.
- `apps/website/src/lib/`: API unwrapping, last-success cache, page loading, preview session helpers, and tests.
- `apps/website/src/components/sections/`: exhaustive section renderer map.
- `apps/website/src/layouts/`: public and preview layouts.
- `apps/website/src/pages/`: published pages, preview pages, article routes, SEO endpoints, health, 404, and 503.
- `apps/website/public/brand/`: immutable approved logo, favicon, fallback Hero, and placeholder assets copied from `docs/00-overview/brand-deliverables/`.

### Engineering and deployment

- `Dockerfile.website`: Astro standalone runtime image.
- `docker/website-nginx.conf`: separate public gateway; Admin static hosting remains unchanged.
- `docker-compose.yml`: website and website-gateway services.
- Root package, policy scripts, CI, environment documentation, README, and deployment guide: register the new workspace and gates.

---

## Milestone 1: Shared Domain and Persistence

### Task 1: Shared Website Content Contract and Permission Catalog

**Files:**

- Create: `packages/shared-types/src/api/website-content.ts`
- Create: `packages/shared-types/src/api/website-content.spec.ts`
- Modify: `packages/shared-types/src/api/index.ts`
- Modify: `packages/shared-types/src/rbac/permission-catalog.ts`
- Modify: `packages/shared-types/src/rbac/permission-catalog.spec.ts`

**Interfaces:**

- Produces exhaustive `WEBSITE_CONTENT_KEY`, `WEBSITE_SECTION_TYPE`, `WEBSITE_CONTENT_STATUS`, and `WEBSITE_CONTENT_ERROR_CODE` values.
- Produces the discriminated `WebsiteContentSection` union and all Admin/public/media request and response contracts.
- Produces `website.view`, `website.read`, `website.edit`, `website.edit_action`, `website.publish`, and `website.publish_action` permissions.

- [ ] **Step 1: Write failing contract tests**

Assert the exact public values and an exhaustive section switch:

```ts
expect(WEBSITE_CONTENT_KEY).toEqual({
  SITE_SHELL: "site_shell",
  HOME: "home",
  SERVICES: "services",
  TRUST: "trust",
  COMPANIONS: "companions",
  ABOUT: "about",
  CONTACT: "contact",
  PRIVACY: "privacy",
  TERMS: "terms",
});

expect(WEBSITE_CONTENT_ERROR_CODE.REVISION_CONFLICT).toBe("WEBSITE_CONTENT_REVISION_CONFLICT");
```

The error catalog must also cover invalid content, missing content/version, invalid media, invalid/expired preview token, persistence failure, and storage unavailable.

- [ ] **Step 2: Run the failing tests**

Run: `pnpm --filter @petcare/shared-types test -- website-content.spec.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the exact shared model**

Use a common base and a discriminated union. Do not use `Record<string, unknown>` for section content:

```ts
export interface WebsiteContentSectionBase<TType, TContent, TSettings> {
  /** Stable key within one page template. */
  sectionKey: string;
  /** Renderer and validator discriminator. */
  sectionType: TType;
  /** Future-compatible display order. */
  sortOrder: number;
  /** Whether this preset section is rendered. */
  isEnabled: boolean;
  /** Persisted section schema version. */
  schemaVersion: 1;
  /** Type-specific editable content. */
  content: TContent;
  /** Type-specific bounded presentation settings. */
  settings: TSettings;
}

export type WebsiteContentSection =
  | WebsiteSiteHeaderSection
  | WebsiteSiteFooterSection
  | WebsiteHeroSection
  | WebsiteTrustGridSection
  | WebsiteFeatureSplitSection
  | WebsiteCtaSection
  | WebsiteRichTextSection
  | WebsiteContactPanelSection;
```

Buttons accept only `/`, `https:`, `mailto:`, and `tel:` destinations. Image-bearing content stores `assetId: string | null` and context-specific `altText`; public responses additionally resolve an `asset` object with URL, width, and height.

- [ ] **Step 4: Write and implement permission-catalog tests**

Assert exact types and implications:

```ts
expect(permission("website.view")).toMatchObject({
  type: "menu",
  impliedApiCodes: ["website.read"],
});
expect(permission("website.edit").impliedApiCodes).toEqual(["website.read", "website.edit_action"]);
expect(permission("website.publish").impliedApiCodes).toEqual([
  "website.read",
  "website.publish_action",
]);
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/shared-types test -- website-content.spec.ts
pnpm --filter @petcare/shared-types test -- permission-catalog.spec.ts
pnpm --filter @petcare/shared-types build
git diff --check
```

Commit: `feat(website): 定义官网内容契约与权限`

---

### Task 2: Prisma Website Content Models and Idempotent Seed

**Files:**

- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/src/seed/seed-website-content.ts`
- Create: `apps/server/src/seed/seed-website-content.spec.ts`
- Modify: `apps/server/prisma/seed.ts`

**Interfaces:**

- Produces `WebsiteContent`, `WebsiteContentVersion`, `WebsiteContentSection`, `WebsiteMediaAsset`, `WebsitePreviewToken`, and `WebsiteContentAuditLog` Prisma models.
- Produces an idempotent initial published snapshot plus editable draft for every fixed content key.

- [ ] **Step 1: Write the failing seed test**

Use a transaction-shaped fake Prisma client. Run the seed twice and assert nine stable content identities, one published snapshot, one current draft clone, deterministic section keys/orders, and no duplicate content/version rows. The seed receives the already-created default administrator ID from `prisma/seed.ts`, matching `seedSystemSettings`.

- [ ] **Step 2: Add the persistence model**

Persist these invariants:

```text
WebsiteContent
  unique(contentKey)
  currentDraftVersionId -> immutable WebsiteContentVersion
  publishedVersionId    -> immutable WebsiteContentVersion | null

WebsiteContentVersion
  unique(websiteContentId, revision)
  unique(websiteContentId, businessVersion)
  status: draft | published | superseded
  sections ordered by sortOrder

WebsiteContentSection
  unique(versionId, sectionKey)
  unique(versionId, sortOrder)
```

Store section `content` and `settings` as JSON snapshots. Store `tokenHash`, never a preview plaintext token. Map models to the table names fixed in the design specification.
`WebsiteContentVersion.idempotencyKey` is nullable and globally unique for publish replays; `businessVersion` is nullable for drafts and unique within one content identity when present.

- [ ] **Step 3: Implement seed data using the page-template source of truth**

Initial text must be usable and brand-consistent, but initial content-managed image references may be null. The Website renderer uses approved bundled brand fallbacks until an Admin selects a COS asset. Seed operations must be transactional and safe on restart.

- [ ] **Step 4: Format, validate, generate, test, and commit**

Run:

```powershell
pnpm --filter @petcare/server test -- seed-website-content.spec.ts
pnpm --filter @petcare/server exec prisma format
$env:DATABASE_URL="postgresql://user:password@localhost:5432/petcare?schema=public"
pnpm --filter @petcare/server exec prisma validate
pnpm --filter @petcare/server exec prisma generate
pnpm --filter @petcare/server typecheck
git diff --check
```

Commit: `feat(website): 建立官网内容版本模型`

---

### Task 3: Section Registry and Fixed Page Templates

**Files:**

- Create: `apps/server/src/modules/website-content/website-section-type.registry.ts`
- Create: `apps/server/src/modules/website-content/website-section-type.registry.spec.ts`
- Create: `apps/server/src/modules/website-content/website-page-template.registry.ts`
- Create: `apps/server/src/modules/website-content/website-page-template.registry.spec.ts`
- Create: `apps/server/src/modules/website-content/website-content.errors.ts`

**Interfaces:**

- Produces `WebsiteSectionTypeRegistry.validate(section)` and `resolveAssetIds(section)`.
- Produces `WebsitePageTemplateRegistry.validateSnapshot(contentKey, sections)` and `createDefaultSections(contentKey)`.

- [ ] **Step 1: Write failing registry tests**

Cover every section type plus unknown type, unsupported schema version, unsafe link protocol, missing required text, invalid settings, duplicate keys/orders, changed type, new/deleted section, reordering, and disabling a required section.

- [ ] **Step 2: Implement explicit type definitions**

Use an exhaustive definition map:

```ts
type SectionDefinition<T extends WebsiteContentSection> = {
  schemaVersion: 1;
  validate: (section: T) => ValidationIssue[];
  resolveAssetIds: (section: T) => string[];
};

const definitions = {
  site_header: siteHeaderDefinition,
  site_footer: siteFooterDefinition,
  hero: heroDefinition,
  trust_grid: trustGridDefinition,
  feature_split: featureSplitDefinition,
  cta: ctaDefinition,
  rich_text: richTextDefinition,
  contact_panel: contactPanelDefinition,
} satisfies Record<WebsiteSectionType, SectionDefinition<any>>;
```

No definition may execute dynamic code or accept HTML.

- [ ] **Step 3: Implement fixed page templates**

Templates own allowed section key/type/order/enablement. During the first release, `validateSnapshot` must reject structure mutations even if the caller bypasses Admin. Keep `sortOrder` and `isEnabled` persisted because later orchestration commands will relax these rules.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @petcare/server test -- website-section-type.registry.spec.ts website-page-template.registry.spec.ts`

Commit: `feat(website): 注册官网区块与页面模板`

---

## Milestone 2: Server Content Lifecycle

### Task 4: Immutable Draft Save, History, Diff, and Restore

**Files:**

- Create: `apps/server/src/modules/website-content/website-content.repository.ts`
- Create: `apps/server/src/modules/website-content/website-content-draft.service.ts`
- Create: `apps/server/src/modules/website-content/website-content-draft.service.spec.ts`
- Create: `apps/server/src/modules/website-content/website-content-history.service.ts`
- Create: `apps/server/src/modules/website-content/website-content-history.service.spec.ts`
- Create: `apps/server/src/modules/website-content/website-content-diff.service.ts`
- Create: `apps/server/src/modules/website-content/website-content-diff.service.spec.ts`

**Interfaces:**

- Produces `saveDraft`, `listHistory`, `getHistoryVersion`, `diffDraftFromPublished`, and `restoreAsDraft`.

- [ ] **Step 1: Write draft service tests**

Assert that a valid save creates a new version and copied section rows in one transaction, advances `currentDraftVersionId`, increments `revision`, supersedes the prior draft, writes audit metadata, and never changes `publishedVersionId`. Assert stale `revision` returns `WEBSITE_CONTENT_REVISION_CONFLICT` with the current revision.

- [ ] **Step 2: Implement the transactional save**

The command input is exact:

```ts
interface SaveWebsiteContentDraftCommand {
  contentKey: WebsiteContentKey;
  revision: number;
  changeSummary: string;
  seo: WebsiteSeoContent;
  sections: WebsiteContentSection[];
  operatorId: string;
  requestId: string;
}
```

Validate templates, section content, links, and database media state before writing. Re-check the current draft ID/revision inside the transaction. Never mutate JSON in an existing version row.

- [ ] **Step 3: Write and implement diff/history/restore tests**

Diff output is field-level and stable: `path`, `before`, `after`, and `changeType`. Restore copies a selected historical snapshot to a new draft, sets `sourceVersionId`, increments revision, and does not publish it.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @petcare/server test -- website-content-draft.service.spec.ts website-content-history.service.spec.ts website-content-diff.service.spec.ts`

Commit: `feat(website): 实现官网草稿与历史`

---

### Task 5: Explicit Publishing, Public Reads, and Redis Cache

**Files:**

- Create: `apps/server/src/modules/website-content/website-content-publishing.service.ts`
- Create: `apps/server/src/modules/website-content/website-content-publishing.service.spec.ts`
- Create: `apps/server/src/modules/website-content/website-content-public.service.ts`
- Create: `apps/server/src/modules/website-content/website-content-public.service.spec.ts`
- Create: `apps/server/src/modules/website-content/website-content-cache.service.ts`
- Create: `apps/server/src/modules/website-content/website-content-cache.service.spec.ts`

**Interfaces:**

- Produces `publish(contentKey, revision, idempotencyKey, changeSummary)` and `getPublished(contentKey)`.
- Cache key: `website_content:version:<versionId>`.

- [ ] **Step 1: Write failing publish tests**

Cover preflight failure, stale revision, one-page scope, monotonic `businessVersion`, old published supersession, draft cloning after publish, idempotent replay, mismatched idempotency body, audit, and cache prewarm failure that does not roll back a committed publish.

- [ ] **Step 2: Implement the publish boundary**

Preflight verifies the entire snapshot and each COS-referenced asset before the database transaction. The transaction re-checks draft identity/revision, template validity, and media database status; it must not perform network I/O. After commit, prewarm the immutable version cache and log warning-only failure.

- [ ] **Step 3: Write failing cache/public-read tests**

Assert pointer read -> Redis version lookup -> PostgreSQL fallback -> Redis fill. Redis connect/get/set failures must degrade to PostgreSQL without failing module startup. Public output must omit draft, operator, audit, token, and storage credentials.

- [ ] **Step 4: Implement failure-tolerant website cache**

This cache owns a lazy Redis client with a different failure policy from authentication. It may not weaken Auth's fail-closed session behavior or import `AuthModule` as cache infrastructure.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @petcare/server test -- website-content-publishing.service.spec.ts website-content-public.service.spec.ts website-content-cache.service.spec.ts`

Commit: `feat(website): 实现官网显式发布与公共读取`

---

### Task 6: Preview Tokens and Audit Safety

**Files:**

- Create: `apps/server/src/modules/website-content/website-preview.service.ts`
- Create: `apps/server/src/modules/website-content/website-preview.service.spec.ts`
- Create: `apps/server/src/modules/website-content/website-content-audit.service.ts`
- Create: `apps/server/src/modules/website-content/website-content-audit.service.spec.ts`
- Modify: `apps/server/src/logging/log-sanitizer.ts`
- Modify: `apps/server/src/logging/log-sanitizer.spec.ts`

**Interfaces:**

- Produces `createPreview`, `readPreview`, `revokeForVersion`, and token-hash-only persistence.

- [ ] **Step 1: Write preview lifecycle tests**

Assert 256-bit random plaintext, SHA-256 hash persistence, exact content/version/revision scope, ten-minute expiry, old-revision continued readability after further edits, revocation on publish, and invalid/expired/revoked errors. Database rows and audit payloads must not contain plaintext.

- [ ] **Step 2: Implement preview URL generation**

Return `https://<WEBSITE_PUBLIC_URL>/preview?contentKey=<key>#token=<plaintext>`. The token must never appear before the fragment and must never be logged.

- [ ] **Step 3: Extend defensive log redaction**

Treat `X-Website-Preview-Token`, `websitePreviewToken`, and normalized header-key variants as sensitive. Add a regression test with nested headers.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @petcare/server test -- website-preview.service.spec.ts website-content-audit.service.spec.ts log-sanitizer.spec.ts`

Commit: `feat(website): 实现安全草稿预览`

---

### Task 7: Tencent COS Website Media Storage and Library

**Files:**

- Modify: `apps/server/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/server/src/config/config.service.ts`
- Modify: `apps/server/src/config/config.service.spec.ts`
- Create: `apps/server/src/modules/website-content/media/website-media-storage.types.ts`
- Create: `apps/server/src/modules/website-content/media/tencent-cos-website-media.storage.ts`
- Create: `apps/server/src/modules/website-content/media/tencent-cos-website-media.storage.spec.ts`
- Create: `apps/server/src/modules/website-content/media/disabled-website-media.storage.ts`
- Create: `apps/server/src/modules/website-content/media/website-media-file.ts`
- Create: `apps/server/src/modules/website-content/media/website-media-file.spec.ts`
- Create: `apps/server/src/modules/website-content/website-media.service.ts`
- Create: `apps/server/src/modules/website-content/website-media.service.spec.ts`

**Interfaces:**

- Produces `WebsiteMediaStorage.put`, `head`, and `delete` with server-generated keys under `public/website-media/<yyyy>/<mm>/<uuid>.<ext>`.
- Produces media upload, paginated list, archive, reference check, and public URL resolution.

- [ ] **Step 1: Reconcile the shared Tencent COS foundation**

If `cos-nodejs-sdk-v5` and the five `TENCENT_COS_*` getters already landed from the account plan, reuse them unchanged. Otherwise install the SDK and replace the stale Aliyun config exactly once:

```env
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_BUCKET=
TENCENT_COS_REGION=
TENCENT_COS_PUBLIC_BASE_URL=
```

Validation requires the four core fields together; a public base URL also requires them and must be absolute HTTP(S). Also add validated `websitePublicUrl`, `websitePreviewTtlSeconds`, and `websiteContentCacheTtlSeconds` getters for Server-side preview/cache behavior. Do not create `WEBSITE_COS_*` variables.

Declare the image probe as a direct Server dependency rather than relying on a transitive lockfile entry:

```powershell
pnpm --filter @petcare/server add probe-image-size
```

If the shared COS work has not landed, also add `cos-nodejs-sdk-v5` and `@types/multer`; otherwise do not reinstall or fork them.

- [ ] **Step 2: Write and implement real-file validation tests**

Detect content from decoded bytes, not only MIME or extension. Cover truncated/corrupt data, JPEG/PNG/WebP, 10 MiB boundary, dimensions, checksum, and extension normalization.

- [ ] **Step 3: Write and implement COS adapter tests**

Use a fake callback-style COS client and assert Bucket/Region/Key/Body/ContentType. Generate keys internally. Resolve URLs from `TENCENT_COS_PUBLIC_BASE_URL` or the standard COS domain. Map provider failures to stable storage errors while retaining request IDs only in structured server logs.

- [ ] **Step 4: Write and implement media lifecycle tests**

Upload order: validate -> COS put -> database insert. Compensate with COS delete if database insert fails. Archive must reject assets referenced by current drafts or published versions; it never physically deletes referenced objects. Publish preflight uses `head` and fails without moving the published pointer.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/server test -- config.service.spec.ts website-media
pnpm --filter @petcare/server typecheck
git diff --check
```

Commit: `feat(website): 接入腾讯 COS 官网素材库`

---

### Task 8: Website Content Controllers, DTOs, Module Wiring, and Swagger

**Files:**

- Create: `apps/server/src/modules/website-content/dto/admin-website-content.dto.ts`
- Create: `apps/server/src/modules/website-content/dto/public-website-content.dto.ts`
- Create: `apps/server/src/modules/website-content/dto/website-media.dto.ts`
- Create: `apps/server/src/modules/website-content/admin-website-content.controller.ts`
- Create: `apps/server/src/modules/website-content/admin-website-content.controller.spec.ts`
- Create: `apps/server/src/modules/website-content/website-content-permission.guard.ts`
- Create: `apps/server/src/modules/website-content/website-content-permission.guard.spec.ts`
- Create: `apps/server/src/modules/website-content/public-website-content.controller.ts`
- Create: `apps/server/src/modules/website-content/public-website-content.controller.spec.ts`
- Create: `apps/server/src/modules/website-content/website-content.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- Produces every Admin and public route fixed in the design specification.
- Produces DTO runtime validation aligned with shared contracts through `implements`.

- [ ] **Step 1: Write controller contract tests**

Assert methods, paths, parameter forwarding, HTTP status, response-envelope data, multipart field name `file`, `Cache-Control: private, no-store` on preview responses, and permissions on every Admin method.

- [ ] **Step 2: Implement DTOs and controllers**

Use `AccessTokenGuard`, `PermissionGuard`, and `RequirePermissions`. Route mapping:

```text
website.read           -> Admin GET overview/draft/diff/history/detail/media
website.edit_action    -> save draft/create preview/upload/archive media
website.publish_action -> publish/restore
```

Public routes return only published content. Preview routes receive the raw token only from `X-Website-Preview-Token`.

Wrap the existing `PermissionGuard` in a narrow `WebsiteContentPermissionGuard`. On `ForbiddenException`, write a `permission_denied` Website audit event with operator, route permission, request ID, and timestamp, then rethrow the original 403. Audit failure must never convert the authorization result into success or a 500. This preserves the central permission evaluator while satisfying the Website audit requirement.

- [ ] **Step 3: Wire module and Swagger**

Register the module in `AppModule`; do not export internal services unless another bounded module needs a public interface.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/server test -- admin-website-content.controller.spec.ts public-website-content.controller.spec.ts
pnpm --filter @petcare/server typecheck
pnpm --filter @petcare/server build
```

Commit: `feat(website): 暴露官网内容管理接口`

---

### Task 9: Published Classroom Article Website Endpoints

**Files:**

- Modify: `packages/shared-types/src/api/content.ts`
- Modify: `packages/shared-types/src/api/content.spec.ts`
- Modify: `apps/server/src/modules/content/content.service.ts`
- Modify: `apps/server/src/modules/content/content.service.spec.ts`
- Create: `apps/server/src/modules/content/public-content.controller.ts`
- Create: `apps/server/src/modules/content/public-content.controller.spec.ts`
- Modify: `apps/server/src/modules/content/dto/content-response.dto.ts`
- Modify: `apps/server/src/modules/content/content.module.ts`

**Interfaces:**

- Produces public paginated article list and published article detail contracts for Website consumption.

- [ ] **Step 1: Write failing public visibility tests**

Only `published` articles are visible. Draft/offline/missing items return public not-found. The first release uses the stable article `id` as the route slug value; do not add a speculative slug migration or article editor to website scope.

- [ ] **Step 2: Implement public endpoints**

Return only title, summary, cover, author display fields, published time, escaped plain-text body, and `slug: id`. Do not invent a category field absent from the current model, expose Admin moderation metadata, or render the stored body as trusted HTML.

- [ ] **Step 3: Verify and commit**

Run: `pnpm --filter @petcare/server test -- content.service.spec.ts public-content.controller.spec.ts`

Commit: `feat(content): 提供官网课堂文章读取接口`

---

## Milestone 3: Admin Content Management

### Task 10: Admin API Client, Lazy Routes, and Permission Boundaries

**Files:**

- Create: `apps/admin/src/api/website-content/index.ts`
- Create: `apps/admin/src/api/website-content/index.test.ts`
- Create: `apps/admin/src/pages/WebsiteContent/index.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/Edit.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/Detail.tsx`
- Modify: `apps/admin/src/routes/registry.ts`
- Modify: `apps/admin/src/routes/registry.test.tsx`

**Interfaces:**

- Produces typed API calls for every WebsiteContent Admin endpoint.
- Produces protected, lazy `/website-content`, `/website-content/:contentKey/edit`, and `/website-content/:contentKey/history/:versionId` routes.

- [ ] **Step 1: Write failing API tests**

Assert exact HTTP methods, paths, bodies, query parameters, multipart field, and response types. No page component may call Axios directly.

- [ ] **Step 2: Implement API client**

Use the existing client/interceptor and shared contracts. Keep query keys in this module and include content key/revision where cache identity requires it.

- [ ] **Step 3: Write and implement route tests**

Overview requires `website.view`; edit and history URLs remain route-readable with `website.view`, while operation buttons are gated separately. Register menu metadata and lazy imports using current registry conventions.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @petcare/admin exec vitest run src/api/website-content/index.test.ts src/routes/registry.test.tsx`

Commit: `feat(admin): 注册官网内容管理入口`

---

### Task 11: Content Overview and Preset Section Editor

**Files:**

- Modify: `apps/admin/src/pages/WebsiteContent/index.tsx`
- Modify: `apps/admin/src/pages/WebsiteContent/Edit.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/index.test.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/Edit.test.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/editors/WebsiteSectionEditor.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/editors/WebsiteSectionEditor.test.tsx`
- Create: section-specific editors under `apps/admin/src/pages/WebsiteContent/editors/`
- Create: `apps/admin/src/pages/WebsiteContent/MediaAssetPicker.tsx`

**Interfaces:**

- Produces overview status, structured SEO/section forms, unsaved-change guard, conflict recovery, media selection, and save-draft flow.

- [ ] **Step 1: Write overview tests**

Cover loading, error/retry, nine content units, draft revision, published business version/time, unpublished-change indicator, last editor, and permission-gated edit action.

- [ ] **Step 2: Implement overview with TanStack Query**

Use the established table/card patterns and existing feedback components. Do not add a second state/query library.

- [ ] **Step 3: Write exhaustive editor tests**

Assert each section discriminator renders the correct strongly typed fields; hidden sections remain in the fixed order. Assert there are no add/delete/change-type/drag handles. Cover required alt text, safe links, disabled-when-template-allows, dirty navigation warning, save, validation errors, and revision conflict refresh.

- [ ] **Step 4: Implement the editor map**

```ts
const editorByType = {
  site_header: SiteHeaderEditor,
  site_footer: SiteFooterEditor,
  hero: HeroEditor,
  trust_grid: TrustGridEditor,
  feature_split: FeatureSplitEditor,
  cta: CtaEditor,
  rich_text: RichTextEditor,
  contact_panel: ContactPanelEditor,
} satisfies Record<WebsiteSectionType, WebsiteSectionEditorComponent>;
```

Preserve section keys/types/orders in request construction; only editable content/settings/allowed enablement change.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @petcare/admin exec vitest run src/pages/WebsiteContent`

Commit: `feat(admin): 实现官网预设区块编辑`

---

### Task 12: Diff, Publish, Preview, History, Restore, and Media Library UI

**Files:**

- Create: `apps/admin/src/pages/WebsiteContent/PublishDialog.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/PublishDialog.test.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/ContentDiff.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/ContentHistory.tsx`
- Modify: `apps/admin/src/pages/WebsiteContent/Detail.tsx`
- Create: `apps/admin/src/pages/WebsiteContent/WebsiteMediaLibrary.tsx`
- Create: focused co-located tests for history, preview, restore, and media.

**Interfaces:**

- Produces explicit publish confirmation, change summary, generated idempotency key, old-revision preview link, history detail, restore-to-draft, upload/list/archive media.

- [ ] **Step 1: Write publish and permission tests**

`website.publish` shows publish/restore; `website.edit` shows save/preview/media; neither implies the other's UI. Publish is disabled until the current edits are saved. The dialog shows field-level diff, requires `changeSummary`, and performs a second confirmation.

- [ ] **Step 2: Implement publish and cache invalidation**

Generate one UUID idempotency key per user attempt and reuse it during retry. On success invalidate overview/draft/history/diff query keys and show the new business version.

- [ ] **Step 3: Write and implement preview tests**

Create preview only from the saved revision and open the returned fragment URL in a new window. Never parse, persist, log, or copy the token into local/session storage.

- [ ] **Step 4: Write and implement history/restore/media tests**

Restore creates a new draft and redirects to Edit; it never labels the action as direct rollback. Media upload validates early for UX but trusts Server as authority. Referenced assets show why archive is blocked.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/WebsiteContent
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin lint
```

Commit: `feat(admin): 完成官网预览发布与素材管理`

---

## Milestone 4: Astro SSR Website

### Task 13: Scaffold the Website Workspace and Build Gates

**Files:**

- Create: `apps/website/package.json`
- Create: `apps/website/astro.config.mjs`
- Create: `apps/website/tsconfig.json`
- Create: `apps/website/eslint.config.js`
- Create: `apps/website/vitest.config.ts`
- Create: `apps/website/src/styles/global.css`
- Create: `apps/website/src/env.d.ts`
- Modify: `.prettierrc.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces an Astro Node standalone SSR app with Tailwind v4 through the Vite plugin.

- [ ] **Step 1: Create the workspace package and install dependencies**

Use pnpm so the lockfile pins resolved versions:

```powershell
pnpm --filter @petcare/website add astro @astrojs/node
pnpm --filter @petcare/website add -D tailwindcss @tailwindcss/vite typescript vitest @vitest/coverage-v8 eslint eslint-plugin-astro
pnpm add -Dw prettier-plugin-astro
```

Do not install deprecated `@astrojs/tailwind`, React, Vue, or `@astrojs/sitemap`.

- [ ] **Step 2: Configure SSR and Tailwind**

```js
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  vite: { plugins: [tailwindcss()] },
});
```

Global CSS starts with `@import "tailwindcss";` and brand tokens scoped to Website.

- [ ] **Step 3: Add scripts and a smoke test**

Package scripts: `dev`, `build`, `preview`, `typecheck` (`astro check`), `lint`, `test`, and `test:run`. Add the required `@astrojs/check` dependency if `astro check` reports it missing. Extend the shared Prettier configuration with `prettier-plugin-astro`, and configure `eslint-plugin-astro` so `.astro` files are actually linted rather than silently skipped.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/website typecheck
pnpm --filter @petcare/website lint
pnpm --filter @petcare/website test:run
pnpm --filter @petcare/website build
```

Commit: `feat(website): 初始化 Astro SSR 官网`

---

### Task 14: Published Content Loader, Last-Success Fallback, and Preview Session

**Files:**

- Create: `apps/website/src/lib/api.ts`
- Create: `apps/website/src/lib/api.test.ts`
- Create: `apps/website/src/lib/published-content-cache.ts`
- Create: `apps/website/src/lib/published-content-cache.test.ts`
- Create: `apps/website/src/lib/runtime-config.ts`
- Create: `apps/website/src/lib/runtime-config.test.ts`
- Create: `apps/website/src/lib/load-page-content.ts`
- Create: `apps/website/src/lib/load-page-content.test.ts`
- Create: `apps/website/src/pages/preview/index.astro`
- Create: `apps/website/src/pages/preview/session.ts`
- Create: `apps/website/src/pages/preview/[contentKey].astro`

**Interfaces:**

- Produces server-only API unwrapping, parallel shell/page loads, five-minute public fallback, and fragment-to-HttpOnly-cookie exchange.

- [ ] **Step 1: Write API and fallback tests**

Cover the repository response envelope, timeouts, non-2xx mapping, last-success age, shell fallback, no published fallback, and strict exclusion of preview responses from the cache.

- [ ] **Step 2: Implement the bounded public cache**

Use a module-local `Map<WebsiteContentKey, { snapshot; storedAt }>` with no timers and no cross-process promises. `runtime-config.ts` is the single Website runtime environment boundary: validate `WEBSITE_PUBLIC_URL`, `WEBSITE_CONTENT_API_BASE_URL`, and `WEBSITE_LAST_SUCCESS_TTL_SECONDS` there; no other Website module reads `process.env`/`import.meta.env`. With the default, return entries only while `Date.now() - storedAt <= 300_000`, otherwise throw the 503 page signal.

- [ ] **Step 3: Write preview exchange tests**

The guide page reads the token from `location.hash`, immediately removes it with `history.replaceState`, POSTs it to the same-origin endpoint, and never stores it. The endpoint validates by calling Nest preview API, sets the fixed cookie options, and returns the content-key preview path.

- [ ] **Step 4: Implement preview rendering**

`/preview/[contentKey]` reads only the HttpOnly cookie server-side, forwards it in `X-Website-Preview-Token`, emits `noindex,nofollow` and `Cache-Control: private, no-store`, and never calls the public fallback cache.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @petcare/website test:run`

Commit: `feat(website): 接入发布内容与草稿预览`

---

### Task 15: Layout, Exhaustive Section Renderers, and Published Pages

**Files:**

- Create: `apps/website/src/layouts/PublicLayout.astro`
- Create: `apps/website/src/layouts/PreviewLayout.astro`
- Create: `apps/website/src/components/SiteHeader.astro`
- Create: `apps/website/src/components/SiteFooter.astro`
- Create: all eight section renderers under `apps/website/src/components/sections/`
- Create: `apps/website/src/components/sections/SectionRenderer.astro`
- Create: renderer tests.
- Create: published page routes for `/`, `/services`, `/trust`, `/companions`, `/about`, `/contact`, `/privacy`, and `/terms`.
- Create: approved assets under `apps/website/public/brand/`.

**Interfaces:**

- Produces an exhaustive safe renderer and all configurable preset pages.

- [ ] **Step 1: Write exhaustive renderer tests**

Every shared section type maps to one renderer. Unknown types and unsupported schema versions fail closed and are never interpolated as HTML. Images use resolved public media or a bundled approved fallback with explicit dimensions and alt text.

- [ ] **Step 2: Implement semantic layouts and renderers**

Use one `h1` per page, semantic landmarks, visible focus, keyboard-operable navigation, responsive images, lazy loading below the fold, and `prefers-reduced-motion`. Render text with normal Astro escaping; never use `set:html` on managed content.

- [ ] **Step 3: Implement fixed route-to-content mapping**

Each page loads `site_shell` plus its fixed content key and renders sections in persisted order. The route mapping is code, not database data. Publish changes content without changing routing.

- [ ] **Step 4: Copy approved immutable brand assets**

Copy only the selected logo, favicon, fallback Hero, and placeholder from `docs/00-overview/brand-deliverables/`; preserve the originals. Configurable imagery still uses COS after an Admin selects an asset.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/website test:run
pnpm --filter @petcare/website typecheck
pnpm --filter @petcare/website build
```

Commit: `feat(website): 构建官网页面与区块渲染`

---

### Task 16: Articles, SEO, Sitemap, Health, and Error Pages

**Files:**

- Create: `apps/website/src/pages/articles/index.astro`
- Create: `apps/website/src/pages/articles/[slug].astro`
- Create: `apps/website/src/pages/robots.txt.ts`
- Create: `apps/website/src/pages/sitemap.xml.ts`
- Create: `apps/website/src/pages/healthz.ts`
- Create: `apps/website/src/pages/404.astro`
- Create: `apps/website/src/pages/503.astro`
- Create: focused tests for article visibility, metadata, XML, and failures.

**Interfaces:**

- Produces public published article pages, per-request dynamic sitemap, robots policy, and operational health.

- [ ] **Step 1: Write article and SEO tests**

Cover published list/detail, missing/offline 404, unique title/description/canonical/Open Graph, noindex preview, and semantic article metadata.

- [ ] **Step 2: Implement article routes**

Use `slug` from the public contract, currently equal to stable article ID. Do not broaden scope into article editing or a slug migration.

- [ ] **Step 3: Implement dynamic SEO endpoints**

Because the app is SSR, generate `sitemap.xml` as a server endpoint by reading currently published website units and articles. Do not rely on build-time dynamic route enumeration. `robots.txt` points to the canonical sitemap and excludes `/preview`.

- [ ] **Step 4: Implement health and failure pages**

`/healthz` verifies the Astro process without exposing configuration. Render brand-consistent 404/503 states; never fall back to a draft.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/website test:run
pnpm --filter @petcare/website build
```

Commit: `feat(website): 完成文章 SEO 与故障页面`

---

## Milestone 5: End-to-End Verification and Deployment

### Task 17: Admin-to-Website Playwright Flows

**Files:**

- Modify: `apps/admin/playwright.config.ts`
- Modify: `apps/admin/e2e/run-e2e.mjs`
- Modify: `scripts/admin-e2e-runner.test.mjs`
- Create: `apps/admin/e2e/website-content.spec.ts`
- Create: `apps/admin/e2e/fixtures/website-content.ts`
- Modify: `apps/admin/e2e/README.md`

**Interfaces:**

- Proves save-draft isolation, fixed-revision preview, explicit publish, permission separation, history restore, and media selection across the real HTTP boundaries.

- [ ] **Step 1: Extend the isolated E2E runner test-first**

Reserve an additional Website port, start Astro with the same disposable database-backed Server, expose the Website URL to Playwright, and stop Website in the existing signal-safe cleanup path. Add runner tests for startup failure, interruption, and cleanup; do not create a second E2E process manager.

- [ ] **Step 2: Add deterministic fixtures**

Seed or API-create an isolated content unit and role fixtures. Do not depend on production COS; media endpoint tests may use the Server test adapter, while one provider adapter contract remains unit-tested.

- [ ] **Step 3: Write the core lifecycle test**

Sequence:

```text
open live page -> record published text
edit preset Hero -> save draft
reload live page -> old text remains
open preview link -> new text appears, noindex/no-store asserted
publish with change summary -> reload live page -> new text appears
restore old version -> live page still new
publish restored draft -> live page returns to old text
```

- [ ] **Step 4: Add permission and structure tests**

Read-only can view but not save/preview/publish; editor cannot publish; publisher cannot edit; no role sees add/delete/reorder controls.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @petcare/admin test:e2e -- website-content.spec.ts`

Commit: `test(website): 覆盖官网内容发布流程`

---

### Task 18: Root Workspace, Policy, Style, and CI Integration

**Files:**

- Modify: `package.json`
- Modify: `pnpm-workspace.yaml` only if current globs do not already include `apps/website`.
- Modify: `turbo.json` only if Website requires a missing lifecycle output.
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/workspace-contract.test.mjs`
- Modify: `scripts/repository-policy.test.mjs`
- Modify: `scripts/commit-scope.mjs`
- Modify: `scripts/commit-scope.test.mjs`
- Modify: `scripts/style-policy.mjs`
- Modify: related style-policy tests.
- Modify: `scripts/ci-policy.test.mjs`
- Modify: `scripts/compose-policy.test.mjs`
- Modify: `.prettierignore`

**Interfaces:**

- Makes Website first-class in root build/typecheck/lint/test, commit scope, style gates, CI, Docker policy, and cleanup discovery.

- [ ] **Step 1: Write failing policy tests before changing scripts**

Assert `apps/website/**` maps to the Website workspace, root checks discover it, style policy uses a Website scope instead of Admin-only assumptions, CI builds/tests it, and Docker policy requires the website image/gateway.

- [ ] **Step 2: Implement the smallest root integration**

Prefer existing `apps/*` discovery. Do not add manual lists where current scripts already discover workspaces. Update only tests and branches that assume exactly Server/Admin/UniApp. Add `@petcare/website` to commit-scope classification/full checks, add a `website` style scope, add `apps/website/**/*.{astro,ts,css,json}` to lint-staged with Prettier plus the Website lint command, and ignore generated `.astro/` and `dist/` artifacts in repository formatting.

- [ ] **Step 3: Verify and commit**

Run:

```powershell
pnpm test:tooling
pnpm lint:styles
pnpm --filter @petcare/website lint
pnpm --filter @petcare/website typecheck
pnpm --filter @petcare/website test:run
pnpm --filter @petcare/website build
```

Commit: `chore(website): 接入工作区与 CI 门禁`

---

### Task 19: Docker, Nginx, Environment Variables, and Deployment Documentation

**Files:**

- Create: `Dockerfile.website`
- Create: `docker/website-nginx.conf`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `docs/environment-variables.md`
- Modify: `README.md`
- Modify: `docs/08-deployment/deployment.md`
- Modify: `docs/08-deployment/deployment-architecture.html`
- Modify: `docs/03-technical-architecture/01-tech-stack.md`
- Modify: `docs/INDEX.md` only if the new Website documentation adds an indexed page.

**Interfaces:**

- Produces Astro standalone container plus a distinct public Nginx gateway without overwriting Admin's static container.
- Produces deployable Website/COS configuration documentation.

- [ ] **Step 1: Write/extend Docker policy tests first**

Require multi-stage image, non-root runtime where supported, health check, no secret build args, gateway upstream to Website SSR, public Website content API routes only, and unchanged Admin hosting.

- [ ] **Step 2: Add runtime variables**

Use:

```env
WEBSITE_PUBLIC_URL=http://localhost:8080
WEBSITE_CONTENT_API_BASE_URL=http://server:3000
WEBSITE_PREVIEW_TTL_SECONDS=600
WEBSITE_CONTENT_CACHE_TTL_SECONDS=86400
WEBSITE_LAST_SUCCESS_TTL_SECONDS=300
WEBSITE_PORT=8080
TENCENT_COS_SECRET_ID=
TENCENT_COS_SECRET_KEY=
TENCENT_COS_BUCKET=
TENCENT_COS_REGION=
TENCENT_COS_PUBLIC_BASE_URL=
```

Only the Astro process receives `WEBSITE_CONTENT_API_BASE_URL`; it is not a public client variable. Server receives preview/cache values and COS credentials through Compose and `ConfigService`.

- [ ] **Step 3: Build the containers and gateway**

`website` listens internally on 4321. `website-gateway` publishes `${WEBSITE_PORT:-8080}:80`, proxies page traffic to Website, and proxies only required public Nest routes. Keep Admin on its existing port/container.

- [ ] **Step 4: Update documentation and architecture diagram**

Document DNS/TLS/CDN ownership, immediate publish behavior, COS public base URL, secret handling, health checks, seed/apply order, rollback through history restore + explicit publish, and five-minute stale fallback.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
docker compose config
docker build -f Dockerfile.website -t petcare-website:verify .
pnpm test:tooling
pnpm exec prettier --check .env.example README.md docs/08-deployment/deployment.md docs/03-technical-architecture/01-tech-stack.md
git diff --check
```

Commit: `chore(website): 配置官网容器与部署`

---

### Task 20: Full Verification and Documentation Reconciliation

**Files:**

- Modify only files that fail a verified gate and belong to this feature.
- Modify: `apps/server/src/modules/website-content/CONTEXT.md` if implementation interfaces differ from the pre-implementation boundary document.
- Modify: `CONTEXT-MAP.md` only if final ownership paths changed.
- Modify: `docs/superpowers/specs/2026-08-12-petcare-official-website-design.md` only for explicitly reviewed implementation-driven corrections.

- [ ] **Step 1: Apply the schema to the designated development database**

Run only after confirming the target is the local development database:

```powershell
pnpm --filter @petcare/server exec prisma db push
pnpm --filter @petcare/server prisma:seed
```

- [ ] **Step 2: Run focused suites**

```powershell
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/server test -- website-content content
pnpm --filter @petcare/admin exec vitest run src/pages/WebsiteContent src/api/website-content
pnpm --filter @petcare/website test:run
pnpm --filter @petcare/admin test:e2e -- website-content.spec.ts
```

- [ ] **Step 3: Run full quality gates**

```powershell
pnpm lint
pnpm lint:styles
pnpm typecheck
pnpm test
pnpm build
pnpm test:tooling
pnpm --filter @petcare/server exec prisma validate
git diff --check
```

- [ ] **Step 4: Run production smoke tests**

Start the Compose stack, then verify Admin, Server health, Website health, one published page, dynamic sitemap, preview no-store/noindex, save-without-publish isolation, publish immediate visibility, Redis-disabled public reads, and COS-disabled behavior. Redis-disabled reads must fall back to PostgreSQL; COS-disabled must leave content editing/publishing functional when no content-managed media is referenced, while upload and media-referencing publish fail explicitly with stable storage errors.

- [ ] **Step 5: Security and scope audit**

Confirm:

```powershell
rg -n "ALIYUN_OSS|WEBSITE_COS" --glob "!*.md" --glob "!.env"
rg -n "TENCENT_COS_SECRET_(ID|KEY)=.+" .env.example docker-compose.yml Dockerfile* apps packages scripts
rg -n "set:html|dangerouslySetInnerHTML|X-Website-Preview-Token" apps/website apps/admin apps/server
git status --short
```

Expected: no stale provider variables, no secrets, no managed-content raw HTML, preview header appears only in intended server-side paths, and no unrelated file is staged.

- [ ] **Step 6: Final implementation commit**

Commit only verified reconciliation files: `docs(website): 对齐官网实现与运维说明`.

## Definition of Done

- Admin can edit every approved text/image/link field in preset sections but cannot add, delete, change type, or reorder sections.
- Saving creates an immutable new draft revision and never changes the public Website.
- A preview link remains pinned to its generated revision, expires in ten minutes, is not indexed/cached, and does not leak its token.
- Explicit per-page publish is revision-checked, idempotent, audited, and immediately visible to new requests without a build/deploy.
- Published history is readable; restore creates a draft and requires another explicit publish.
- Tencent Cloud COS is the only configured object-storage provider; content stores media IDs, not temporary signed URLs or caller-provided object keys.
- Read/edit/publish permissions are enforced independently in Admin and Server.
- Astro renders all fixed routes and section types safely, with SEO, accessibility, articles, sitemap, 404/503, and bounded fallback behavior.
- Root gates, CI, Docker, Nginx, environment docs, and production smoke tests cover Website as a first-class workspace.
- No unrelated or concurrent workspace changes are staged or committed.
