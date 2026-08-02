# 后台内容管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution was selected by the user); execute each task with a verification checkpoint.

**目标：** 为 Admin 增加内容管理一级菜单及悬赏、帖子、课堂文章三个二级页面，并打通共享类型、RBAC、服务端分页接口和基础列表状态。

**架构：** 共享权限目录声明内容域菜单与接口权限；NestJS 新增独立 `ContentModule`，分别从 `Order`、`Post` 和 `ClassroomArticle` 查询数据；Admin 通过 `apps/admin/src/api/content/` 调用统一分页 API，页面按模块目录组织。`/content` 同时作为内容管理父路由和悬赏管理默认页，以保持恰好三个二级菜单。

**技术栈：** NestJS、Prisma、PostgreSQL、React 19、React Router、TanStack Query、Tailwind CSS v4、Vitest、Swagger。

## 全局约束

- 请求参数和响应类型只能定义在 `@petcare/shared-types`，Admin 与 Server 不得重复声明契约类型。
- 分页响应固定为 `list`、`total`、`page`、`pageSize`。
- Admin 页面目录使用 `ContentManagement/index.tsx`、`ContentManagement/Posts/index.tsx`、`ContentManagement/Articles/index.tsx`；悬赏页使用 `ContentManagement/index.tsx`。
- Admin 优先使用 Tailwind 工具类，不新增页面级 SCSS；默认字号维持 14px。
- 所有服务端配置通过已有 ConfigService/PrismaModule 获取；接口必须经过 AccessTokenGuard 与 PermissionGuard。
- 代码和提交信息使用中文 Conventional Commits。

---

### Task 1: 共享内容权限与契约类型

**Files:**

- Modify: `packages/shared-types/src/rbac/permission-catalog.ts`
- Create: `packages/shared-types/src/api/content.ts`
- Modify: `packages/shared-types/src/api/index.ts`
- Test: `packages/shared-types/src/rbac/permission-catalog.spec.ts`
- Test: `packages/shared-types/src/api/content.spec.ts`

**Interfaces:**

- Produces permission codes `content.view`, `content.post.view`, `content.article.view`, `content.reward.read`, `content.post.read`, `content.article.read`.
- Produces `AdminContentRewardListQuery/Response`, `AdminContentPostListQuery/Response`, `AdminClassroomArticleListQuery/Response` and their item types.

- [ ] **Step 1: Write failing catalog and contract tests**

```ts
it("declares content as a root menu with two child menus", () => {
  const content = getRbacPermission("content.view");
  expect(content).toMatchObject({ type: "menu", path: "/content", parentCode: null });
  expect(getRbacPermission("content.post.view")).toMatchObject({
    type: "menu",
    path: "/content/posts",
    parentCode: "content.view",
  });
  expect(getRbacPermission("content.article.view")).toMatchObject({
    type: "menu",
    path: "/content/articles",
    parentCode: "content.view",
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm exec vitest run packages/shared-types/src/rbac/permission-catalog.spec.ts packages/shared-types/src/api/content.spec.ts --root .`

Expected: FAIL because content permissions and shared content response types do not exist.

- [ ] **Step 3: Add catalog entries and typed pagination contracts**

Use the existing `PaginatedResponse<T>` and define item fields needed by the three tables. `AdminContentRewardListItem` should extend the existing order summary shape only through explicit fields; do not import Prisma types into shared-types. Add JSDoc to every field. `content.view` must imply `content.reward.read`; each child menu must imply its own `*.read` API permission.

- [ ] **Step 4: Run shared tests and type-check**

Run: `pnpm exec vitest run packages/shared-types/src --root .` and `pnpm exec tsc -p packages/shared-types/tsconfig.json`.

Expected: all shared tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/rbac/permission-catalog.ts packages/shared-types/src/api/content.ts packages/shared-types/src/api/index.ts packages/shared-types/src/rbac/permission-catalog.spec.ts packages/shared-types/src/api/content.spec.ts
git commit -m "feat: 增加内容管理共享权限与类型"
```

### Task 2: Prisma 课堂文章模型与服务端内容 DTO

**Files:**

- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/src/modules/content/dto/admin-content-query.dto.ts`
- Create: `apps/server/src/modules/content/dto/content-response.dto.ts`
- Create: `apps/server/src/modules/content/content.service.ts`
- Test: `apps/server/src/modules/content/content.service.spec.ts`

**Interfaces:**

- `ContentService.findRewardPage(query): Promise<AdminContentRewardListResponse>`
- `ContentService.findPostPage(query): Promise<AdminContentPostListResponse>`
- `ContentService.findArticlePage(query): Promise<AdminClassroomArticleListResponse>`

- [ ] **Step 1: Add failing service tests**

Mock `PrismaService.order.findMany/order.count`, `post.findMany/post.count`, and `classroomArticle.findMany/count`. Assert every query includes page offset, descending creation order, keyword/status filters, and returns the four pagination fields.

- [ ] **Step 2: Run the focused service test**

Run: `pnpm --filter @petcare/server exec vitest run src/modules/content/content.service.spec.ts`

Expected: FAIL because the module and service do not exist.

- [ ] **Step 3: Add `ClassroomArticle` Prisma model**

Add `id`, `title`, `summary`, `coverUrl`, `content`, `status`, `authorId`, `publishedAt`, `createdAt`, `updatedAt`, relation to `User`, indexes on `status` and `createdAt`, and map the table to `classroom_articles`. Keep article status values `draft`, `published`, `offline` in the shared contract.

- [ ] **Step 4: Implement DTO validation and service queries**

DTOs must validate `page` 1+, `pageSize` 1-100, keyword max 50, and status enums. Reward query always adds `{ orderType: "reward" }`; post/article queries use validated status and case-insensitive keyword matching. Select only table fields and related author summary. Convert `Date` values to ISO strings and reward amount cents to yuan.

- [ ] **Step 5: Regenerate Prisma client and run service tests**

Run: `pnpm --filter @petcare/server exec prisma generate` then `pnpm --filter @petcare/server exec vitest run src/modules/content/content.service.spec.ts`.

Expected: focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/server/prisma/schema.prisma apps/server/src/modules/content
git commit -m "feat: 增加内容管理查询服务"
```

### Task 3: 服务端 Controller、Swagger 与模块接入

**Files:**

- Create: `apps/server/src/modules/content/admin-content.controller.ts`
- Create: `apps/server/src/modules/content/content.module.ts`
- Test: `apps/server/src/modules/content/admin-content.controller.spec.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- `GET /admin/content/rewards` requires `content.reward.read`.
- `GET /admin/content/posts` requires `content.post.read`.
- `GET /admin/content/articles` requires `content.article.read`.

- [ ] **Step 1: Write failing controller metadata tests**

Assert controller paths, `AccessTokenGuard`/`PermissionGuard`, `RequirePermissions` metadata, `ApiSuccessResponse` DTOs, and standard 400/401/403/500 errors for all endpoints.

- [ ] **Step 2: Implement controller and module**

Follow `AdminOrderController` structure. Add `@ApiTags("admin-content")`, `@ApiBearerAuth()`, guards at class level, and one handler per list. Import `AuthModule` in `ContentModule`; import `ContentModule` in `AppModule`.

- [ ] **Step 3: Run controller tests and server build**

Run: `pnpm --filter @petcare/server exec vitest run src/modules/content/admin-content.controller.spec.ts` and `pnpm --filter @petcare/server exec nest build`.

Expected: all focused tests pass and build exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/content apps/server/src/app.module.ts
git commit -m "feat: 接入内容管理后台接口"
```

### Task 4: Admin API 客户端与路由菜单

**Files:**

- Create: `apps/admin/src/api/content/rewards.ts`
- Create: `apps/admin/src/api/content/posts.ts`
- Create: `apps/admin/src/api/content/articles.ts`
- Create: `apps/admin/src/api/content/index.ts`
- Modify: `apps/admin/src/routes/registry.ts`
- Modify: `apps/admin/src/components/Sidebar.tsx`
- Test: `apps/admin/src/routes/registry.test.ts`

**Interfaces:**

- `fetchAdminContentRewards(query)` calls `/admin/content/rewards`.
- `fetchAdminContentPosts(query)` calls `/admin/content/posts`.
- `fetchAdminClassroomArticles(query)` calls `/admin/content/articles`.

- [ ] **Step 1: Write failing route/menu tests**

Assert root route `/content` is labeled “悬赏管理” as its child label, child paths are `/content/posts` and `/content/articles`, and visible root/child helpers return the expected tree for the corresponding permission set.

- [ ] **Step 2: Add API wrappers and registry routes**

Use only shared request/response types. Add lazy or direct page elements using `ContentManagement/index`, `ContentManagement/Posts/index`, and `ContentManagement/Articles/index`. Add the `FileText` icon to the Sidebar icon map. Do not change mobile flat-root behavior or existing permission filtering.

- [ ] **Step 3: Run Admin route tests**

Run: `pnpm --filter @petcare/admin exec vitest run src/routes/registry.test.ts`.

Expected: tests pass and no existing menu route regressions occur.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/api/content apps/admin/src/routes/registry.ts apps/admin/src/components/Sidebar.tsx apps/admin/src/routes/registry.test.ts
git commit -m "feat: 增加内容管理后台菜单与接口客户端"
```

### Task 5: Admin 三个分页列表页面

**Files:**

- Create: `apps/admin/src/pages/ContentManagement/index.tsx`
- Create: `apps/admin/src/pages/ContentManagement/Posts/index.tsx`
- Create: `apps/admin/src/pages/ContentManagement/Articles/index.tsx`
- Test: `apps/admin/src/pages/ContentManagement/index.test.tsx`
- Test: `apps/admin/src/pages/ContentManagement/Posts/index.test.tsx`
- Test: `apps/admin/src/pages/ContentManagement/Articles/index.test.tsx`

**Interfaces:**

- Each page uses TanStack Query with `keepPreviousData`, exposes keyword/status filters, and renders loading/error/empty/success states.
- Each page uses the API wrapper from Task 4 and displays server pagination without local mock rows.

- [ ] **Step 1: Write failing page tests**

Mock each API wrapper and assert: loading skeleton has an accessible label; rejected query renders retry action; empty response renders empty state; successful response renders table heading and total count; changing filters resets page to 1.

- [ ] **Step 2: Implement shared local page primitives**

Keep repeated table/pagination markup local to each page unless a component is reused by all three. Use Tailwind v4 classes only, `aria-label` on forms and tables, and readable Chinese copy.

- [ ] **Step 3: Run focused Admin tests**

Run: `pnpm --filter @petcare/admin exec vitest run src/pages/ContentManagement`.

Expected: all three page suites pass.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/pages/ContentManagement
git commit -m "feat: 增加内容管理分页页面"
```

### Task 6: 集成验证、文档索引与最终提交

**Files:**

- Modify: `docs/INDEX.md`
- Modify: `docs/06-api-specification/api-specification.md`
- Modify: `docs/09-development-guidelines/05-frontend-structure-and-api-contracts.md` only if the new content route rule needs an example.

- [ ] **Step 1: Run all required verification**

```bash
pnpm --filter @petcare/admin exec vitest run
pnpm exec vitest run packages/shared-types/src --root .
pnpm exec tsc -p packages/shared-types/tsconfig.json
pnpm --filter @petcare/server exec nest build
pnpm --filter @petcare/admin exec vite build
pnpm --filter @petcare/admin exec node ../../scripts/style-output-policy.mjs admin dist
git diff --check
```

Expected: all commands pass with no TypeScript, ESLint, style-policy, or diff-check errors.

- [ ] **Step 2: Update documentation**

Add the content endpoints, permission codes, and menu paths to the API index and frontend structure docs. Do not document future editing actions as implemented.

- [ ] **Step 3: Review diff and commit**

```bash
git status --short
git diff --stat
git add docs/INDEX.md docs/06-api-specification/api-specification.md docs/09-development-guidelines/05-frontend-structure-and-api-contracts.md
git commit -m "docs: 补充内容管理接口与目录说明"
```

## 自检

- 设计文档中的三个二级菜单均有对应路由、权限和页面任务。
- `/content` 作为父路由和悬赏默认页面，避免生成第四个“内容总览”子菜单。
- 契约、DTO、Swagger、前端 API 和页面测试均有独立任务。
- 没有使用 TODO/TBD 占位，也没有把编辑/审核等非目标能力误写为已实现。
