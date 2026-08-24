# PetCare Miniapp Support Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让隐私协议、服务条款、帮助中心和客服信息从现有 Admin Website Content 草稿/发布流程进入 Miniapp，并提供真实的搜索、拨号、邮箱复制、加载失败和重试行为。

**Architecture:** 在共享 Website Content key 中只新增 `HELP`，用四个固定 `RICH_TEXT` 区块表达帮助分类；`PRIVACY`、`TERMS` 和 `CONTACT` 继续使用现有模板、发布版本、缓存和 RBAC。Miniapp 通过现有公开 `/website-content/:contentKey` 读取已发布快照，再用纯函数映射为帮助、法律文本和联系渠道视图；不增加 Miniapp 专用 CMS 或内容转发接口。

**Tech Stack:** NestJS、Prisma、Redis、React 19、TanStack Query、Playwright、UniApp、Vue 3、TypeScript、Vitest、Jest。

**Spec:** `docs/plans/2026-08-24-miniapp-account-and-support-content-design.md`

## Global Constraints

- 本计划在静默登录计划的 Miniapp `rawRequest` 基础上执行，但所有内容读取保持公开，不附加登录令牌。
- 复用 Website Content 的固定模板、草稿、发布、历史、预览、权限、校验和缓存；不新建 FAQ 表、富文本 HTML、搜索服务或 Miniapp 内容后台。
- `HELP` 固定四个分类区块；区块标题是分类，`parts[].heading` 是问题，`paragraphs` 是答案。
- Admin 可以修改固定分类、问题、答案并停用整个分类；首版不能新增、删除或重排分类/问题。
- `HELP` 的 required-section 列表为空，因此每个分类均可停用；模板本身仍禁止删除、增添、换型或重排区块。
- `CONTACT_PANEL` 沿用固定联系渠道；首版保证可配置电话、邮箱和值班时间，不扩展动态增删渠道。
- 初始联系信息不得伪造真实运营号码：未获得正式信息时显示“待运营配置”，且使用无动作的站内 href；运营发布 `tel:` 或 `mailto:` 后 Miniapp 才显示相应动作。
- Miniapp 只执行经过本地格式复核的 `tel:` 拨号；`mailto:` 只复制邮箱，不尝试不稳定的邮件跳转；其他渠道仅展示。
- 业务隐私协议页面与微信平台《小程序隐私保护指引》不是同一能力，不以 `openPrivacyContract` 替代。
- 不用旧静态 fixture 作为接口失败回退；失败时显示错误和重试，空内容显示“暂未配置”。
- 不增加新的 Admin 权限；继续使用 `website.view`、`website.edit` 和 `website.publish`。

## File Map

### Shared and Server

- Modify: `packages/shared-types/src/api/website-content.ts`
- Modify: `packages/shared-types/src/api/website-content.spec.ts`
- Modify: `apps/server/src/seed/seed-website-content.ts`
- Modify: `apps/server/src/seed/seed-website-content.spec.ts`
- Modify: `apps/server/src/modules/website-content/website-page-template.registry.ts`
- Modify: `apps/server/src/modules/website-content/website-page-template.registry.spec.ts`
- Modify: `apps/server/src/modules/website-content/public-website-content.controller.ts`
- Modify: `apps/server/src/modules/website-content/public-website-content.controller.spec.ts`
- Modify: `apps/server/src/modules/website-content/website-content-public.service.spec.ts`

### Admin

- Modify: `apps/admin/src/pages/WebsiteContent/Edit.tsx`
- Modify: `apps/admin/src/pages/WebsiteContent/Edit.test.tsx`
- Modify: `apps/admin/src/pages/WebsiteContent/index.tsx`
- Modify: `apps/admin/src/pages/WebsiteContent/index.test.tsx`
- Modify: `apps/admin/e2e/fixtures/website-content.ts`
- Modify: `apps/admin/e2e/website-content.spec.ts`

### Website preview

- Modify: `apps/website/src/pages/preview/session.ts`
- Modify: `apps/website/src/routes/preview-session.test.ts`

### Miniapp

- Create: `apps/miniapp/src/api/content.ts`
- Create: `apps/miniapp/src/pages-content/content-mappers.ts`
- Create: `apps/miniapp/src/pages-content/content-mappers.spec.ts`
- Modify: `apps/miniapp/src/pages-content/help/index.vue`
- Modify: `apps/miniapp/src/pages-content/contact/index.vue`
- Create: `apps/miniapp/src/pages-content/legal/index.vue`
- Modify: `apps/miniapp/src/pages/profile/index.vue`
- Modify: `apps/miniapp/src/pages/auth/index.vue`
- Modify: `apps/miniapp/pages.config.ts`
- Modify: `apps/miniapp/pages-config.spec.ts`
- Generated: `apps/miniapp/src/pages.json`
- Generated: `apps/miniapp/src/uni-pages.d.ts`

---

### Task 1: Add the HELP content key to the exhaustive shared contract

**Interfaces:**

- `WEBSITE_CONTENT_KEY.HELP === "help"`.
- Existing `WebsiteContentKey` consumers become exhaustively aware of the tenth key.
- No new section discriminator or data type is introduced.

- [ ] **Step 1: Make the stable-key test fail**

Update the expected object in `packages/shared-types/src/api/website-content.spec.ts`:

```ts
expect(WEBSITE_CONTENT_KEY).toEqual({
  SITE_SHELL: "site_shell",
  HOME: "home",
  SERVICES: "services",
  TRUST: "trust",
  COMPANIONS: "companions",
  ABOUT: "about",
  CONTACT: "contact",
  HELP: "help",
  PRIVACY: "privacy",
  TERMS: "terms",
});
```

- [ ] **Step 2: Run the focused contract test and confirm failure**

Run:

```powershell
pnpm --filter @petcare/shared-types exec vitest run src/api/website-content.spec.ts
```

Expected: FAIL because `HELP` is absent.

- [ ] **Step 3: Add one shared key with JSDoc**

In `WEBSITE_CONTENT_KEY`:

```ts
/** Public Miniapp help-center content. */
HELP: "help",
```

Do not add `FAQ` to `WEBSITE_SECTION_TYPE`.

- [ ] **Step 4: Run Shared Types checks and commit**

Run:

```powershell
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/shared-types typecheck
pnpm --filter @petcare/shared-types lint
git diff --check
```

Expected: all checks PASS.

```powershell
git add packages/shared-types
git commit -m "feat(content): 增加帮助中心内容键"
```

### Task 2: Seed and validate the fixed HELP template

**Interfaces:**

- One `help` content unit has four ordered `rich_text` sections.
- All four sections are optional-to-display but fixed in composition.
- Fresh seed totals become 10 contents, 20 versions, and 60 sections.
- Existing operator-owned content pointers remain untouched.

- [ ] **Step 1: Add failing seed-count and help-shape tests**

Update `apps/server/src/seed/seed-website-content.spec.ts`:

```ts
expect(state.contents.map((content) => content.contentKey)).toEqual([
  "site_shell",
  "home",
  "services",
  "trust",
  "companions",
  "about",
  "contact",
  "help",
  "privacy",
  "terms",
]);
expect(state.contents).toHaveLength(10);
expect(state.versions).toHaveLength(20);
expect(state.sections).toHaveLength(60);
```

Find the help draft by content pointer and assert its four ordered section keys are:

```ts
expect(getOrderedSections(state, helpDraft.id).map((section) => section.sectionKey)).toEqual([
  "account_and_identity",
  "bounty_and_orders",
  "care_records",
  "fees_and_benefits",
]);
```

- [ ] **Step 2: Add a failing optional-category template test**

In `website-page-template.registry.spec.ts`:

```ts
it("keeps all fixed help categories optional to display", () => {
  const sections = defaultSections(WEBSITE_CONTENT_KEY.HELP);
  sections.forEach((section) => {
    section.isEnabled = false;
  });

  expect(() => registry.validateSnapshot(WEBSITE_CONTENT_KEY.HELP, sections)).not.toThrow();
});
```

- [ ] **Step 3: Run the two focused tests and confirm failures**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/seed/seed-website-content.spec.ts src/modules/website-content/website-page-template.registry.spec.ts
```

Expected: FAIL because no Help template or required-key entry exists.

- [ ] **Step 4: Add the exact Help seed**

Add a small seed-only helper:

```ts
function helpSection(
  sectionKey: string,
  sortOrder: number,
  title: string,
  parts: WebsiteRichTextPart[],
): WebsiteRichTextSection {
  return {
    sectionKey,
    sectionType: WEBSITE_SECTION_TYPE.RICH_TEXT,
    sortOrder,
    isEnabled: true,
    schemaVersion: 1,
    content: { title, effectiveDate: null, parts },
    settings: { width: "normal" },
  };
}
```

Add this complete template before Privacy/Terms:

```ts
{
  contentKey: WEBSITE_CONTENT_KEY.HELP,
  contentType: "page",
  seo: {
    title: "帮助中心｜PetCare 宠伴",
    description: "PetCare 小程序常见问题与使用指南。",
    canonicalPath: "/help",
    image: null,
  },
  sections: [
    helpSection("account_and_identity", 1, "账号与认证", [
      {
        partKey: "complete_profile",
        heading: "如何完善个人信息？",
        paragraphs: ["进入“我的－个人信息－编辑个人信息”，验证手机号后即可完成资料。"],
      },
      {
        partKey: "wechat_profile",
        heading: "如何修改头像和昵称？",
        paragraphs: ["在编辑个人信息页主动选择微信头像并填写微信昵称，保存后即可更新。"],
      },
    ]),
    helpSection("bounty_and_orders", 2, "悬赏与订单", [
      {
        partKey: "publish_bounty",
        heading: "如何发布悬赏？",
        paragraphs: ["进入悬赏大厅并点击发布按钮，资料完善后按页面步骤填写需求。"],
      },
      {
        partKey: "publish_blocked",
        heading: "为什么暂时无法发布？",
        paragraphs: ["请先确认已经登录并通过短信验证手机号；页面会引导你完善资料。"],
      },
    ]),
    helpSection("care_records", 3, "服务记录", [
      {
        partKey: "service_progress",
        heading: "怎样查看服务进度？",
        paragraphs: ["从订单列表进入订单详情，可查看该订单已经开放的服务进度与照护记录。"],
      },
      {
        partKey: "service_issue",
        heading: "遇到服务问题怎么办？",
        paragraphs: ["请保留订单编号和相关记录，再通过“联系客服”页面选择已配置的渠道。"],
      },
    ]),
    helpSection("fees_and_benefits", 4, "费用与优惠", [
      {
        partKey: "coupon_location",
        heading: "优惠券在哪里查看？",
        paragraphs: ["进入“我的”页面并点击“优惠券”即可查看当前页面提供的优惠信息。"],
      },
      {
        partKey: "fee_reference",
        heading: "服务费用以哪里为准？",
        paragraphs: ["实际费用以提交订单前的确认页面和最终订单记录为准。"],
      },
    ]),
  ],
},
```

Import `WebsiteRichTextPart` and `WebsiteRichTextSection` as types from `@petcare/shared-types`.

- [ ] **Step 5: Keep Help categories optional in the template registry**

Add:

```ts
[WEBSITE_CONTENT_KEY.HELP]: [],
```

to `REQUIRED_SECTION_KEYS`. The existing template registry will still reject missing, added, reordered, or type-changed Help sections because it derives structure from the seed.

- [ ] **Step 6: Make contact defaults safe and configurable**

Keep exactly two existing channels so the current editor remains sufficient. For fresh installations, change them to:

```ts
channels: [
  {
    channelKey: "customer_service",
    label: "客服电话",
    value: "待运营配置",
    href: "/contact",
    availability: "工作时间待运营配置",
  },
  {
    channelKey: "business",
    label: "客服邮箱",
    value: "待运营配置",
    href: "/contact",
    availability: "工作时间待运营配置",
  },
],
```

Admin can publish a `tel:` and `mailto:` destination through the existing `ContactPanelEditor`. Do not overwrite contact snapshots whose pointers already belong to operators.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/seed/seed-website-content.spec.ts src/modules/website-content/website-page-template.registry.spec.ts src/modules/website-content/website-section-type.registry.spec.ts
pnpm --filter @petcare/server typecheck
git diff --check
```

Expected: seed and registry tests PASS with exact totals 10/20/60.

```powershell
git add apps/server/src/seed apps/server/src/modules/website-content/website-page-template.registry.ts apps/server/src/modules/website-content/website-page-template.registry.spec.ts
git commit -m "feat(content): 建立帮助与客服固定模板"
```

### Task 3: Expose HELP through the existing public published-content path

**Interfaces:**

- `GET /website-content/help` returns only the current published snapshot.
- Disabled Help categories are omitted by `WebsiteContentPublicService`.
- Draft-only changes remain invisible.
- No authentication or Miniapp-specific forwarding route is added.
- Admin's existing capability preview accepts `help` and renders its structured text.

- [ ] **Step 1: Add failing public Help tests**

Extend `website-content-public.service.spec.ts` with a helper that selects the Help seed and a test:

```ts
it("returns enabled Help categories from the published pointer only", async () => {
  const version = publishedVersion(WEBSITE_CONTENT_KEY.HELP);
  version.sections[0].isEnabled = false;
  const service = createPublicService(version);

  const result = await service.getPublished(WEBSITE_CONTENT_KEY.HELP);

  expect(result.contentKey).toBe("help");
  expect(result.sections).toHaveLength(3);
  expect(result.sections.every((section) => section.sectionType === "rich_text")).toBe(true);
});
```

Refactor the existing test-local `publishedVersion` helper to accept a `WebsiteContentKey` and the test-local service setup into `createPublicService`; keep both inside the spec file.

- [ ] **Step 2: Add controller forwarding coverage**

Extend `public-website-content.controller.spec.ts`:

```ts
it("forwards the public Help key without requiring authentication", async () => {
  const content = { contentKey: "help", businessVersion: 1 };
  const published = { getPublished: jest.fn().mockResolvedValue(content) };
  const previews = { readPreview: jest.fn() };
  const controller = new PublicWebsiteContentController(published as never, previews as never);

  await expect(controller.getPublished("help")).resolves.toBe(content);
  expect(published.getPublished).toHaveBeenCalledWith("help");
});
```

- [ ] **Step 3: Run focused tests**

Run:

```powershell
pnpm --filter @petcare/server exec jest --runInBand src/modules/website-content/website-content-public.service.spec.ts src/modules/website-content/public-website-content.controller.spec.ts
```

Expected: tests PASS through the generic public service once Task 2 is present. No second controller is introduced.

- [ ] **Step 4: Add a failing Website preview-session test**

Extend `apps/website/src/routes/preview-session.test.ts`:

```ts
it("accepts the fixed Help key for an Admin capability preview", async () => {
  const api: PreviewSessionApi = { getPreview: vi.fn().mockResolvedValue({}) };
  const context = createContext({ contentKey: "help", token: "preview-token" });

  const response = await createPreviewSessionHandler(api)(context as never);

  await expect(response.json()).resolves.toEqual({ path: "/preview/help" });
  expect(api.getPreview).toHaveBeenCalledWith("help", "preview-token");
});
```

Run:

```powershell
pnpm --filter @petcare/website exec vitest run src/routes/preview-session.test.ts
```

Expected: FAIL because the current preview allow-list omits `help`.

- [ ] **Step 5: Derive previewable page keys from the shared registry**

In `apps/website/src/pages/preview/session.ts`, replace the duplicated string union/set:

```ts
import { WEBSITE_CONTENT_KEY, type WebsiteContentKey } from "@petcare/shared-types";

type PreviewableContentKey = Exclude<WebsiteContentKey, typeof WEBSITE_CONTENT_KEY.SITE_SHELL>;

const PREVIEWABLE_CONTENT_KEYS = new Set<PreviewableContentKey>(
  Object.values(WEBSITE_CONTENT_KEY).filter(
    (contentKey): contentKey is PreviewableContentKey =>
      contentKey !== WEBSITE_CONTENT_KEY.SITE_SHELL,
  ),
);
```

The dynamic preview renderer already supports `rich_text`, so no Help-only Astro page or renderer is added.

- [ ] **Step 6: Correct the controller audience, verify, and commit**

Change “to the SSR website only” to “to public clients” in `public-website-content.controller.ts` because Miniapp is now an intentional consumer. No route behavior changes.

```powershell
pnpm --filter @petcare/website exec vitest run src/routes/preview-session.test.ts
pnpm --filter @petcare/website typecheck
git diff --check
git add apps/server/src/modules/website-content apps/website/src/pages/preview/session.ts apps/website/src/routes/preview-session.test.ts
git commit -m "test(content): 覆盖帮助中心公开读取"
```

### Task 4: Make HELP editable and publishable in Admin

**Interfaces:**

- Admin overview renders ten content units.
- `/website-content/help/edit` is accepted.
- All four Help categories use the existing `RichTextEditor` and may be disabled.
- Existing `ContactPanelEditor` continues to edit the two fixed channels and their availability.

- [ ] **Step 1: Add failing Admin overview/editor tests**

Extend the overview fixture in `index.test.tsx` with a Help item and update:

```ts
expect(screen.getAllByRole("listitem")).toHaveLength(10);
expect(screen.getAllByRole("link", { name: "编辑草稿" })).toHaveLength(10);
expect(
  screen
    .getAllByRole("link", { name: "编辑草稿" })
    .some((link) => link.getAttribute("href") === "/website-content/help/edit"),
).toBe(true);
```

Add a Help draft fixture to `Edit.test.tsx` and render `/website-content/help/edit`. Assert all four “正文标题” controls render and disabling `account_and_identity` is allowed.

- [ ] **Step 2: Run focused Admin tests and confirm failures**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/WebsiteContent/index.test.tsx src/pages/WebsiteContent/Edit.test.tsx
```

Expected: FAIL because the overview fixture/count and editor allow-list know only nine keys.

- [ ] **Step 3: Derive the editor key allow-list from the shared constant**

Import the runtime constant and replace the duplicated literal set:

```ts
import {
  WEBSITE_CONTENT_KEY,
  type ApiErrorResponse,
  type WebsiteContentKey,
  type WebsiteContentSection,
  type WebsiteContentVersion,
  type WebsiteMediaListQuery,
  type WebsiteSeoContent,
} from "@petcare/shared-types";

const WEBSITE_CONTENT_KEYS = new Set<WebsiteContentKey>(Object.values(WEBSITE_CONTENT_KEY));
```

Add:

```ts
help: [],
```

to the Admin `REQUIRED_SECTION_KEYS` record. Do not alter `RichTextEditor` or add structure controls.

- [ ] **Step 4: Update the overview skeleton count**

Change only:

```tsx
{Array.from({ length: 10 }, (_, index) => index).map((item) => (
```

Keep the existing page title and permissions because this feature is reusing Website Content rather than creating a second support-content area.

- [ ] **Step 5: Verify Admin unit behavior and commit**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/WebsiteContent/index.test.tsx src/pages/WebsiteContent/Edit.test.tsx src/pages/WebsiteContent/editors/WebsiteSectionEditor.test.tsx src/pages/WebsiteContent/editors/WebsiteSectionEditor.exhaustive.test.tsx
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin lint
git diff --check
```

Expected: unit, type, lint, and diff checks PASS.

```powershell
git add apps/admin/src/pages/WebsiteContent
git commit -m "feat(admin): 支持帮助内容编辑发布"
```

### Task 5: Prove Admin publication reaches the public Help API

**Interfaces:**

- E2E helpers open any fixed content key rather than only Home.
- A saved Help draft does not alter the public API until explicitly published.
- After publish, `/api/website-content/help` returns the edited question.

- [ ] **Step 1: Generalize the two Home-only E2E helpers**

In `apps/admin/e2e/fixtures/website-content.ts` add:

```ts
help: {
  contentKey: "help",
  questionLabel: "正文小节 如何完善个人信息？ 标题",
  initialQuestion: "如何完善个人信息？",
},
```

Replace `openHomeEditor` with:

```ts
export async function openContentEditor(page: Page, contentKey: string): Promise<void> {
  await page.getByTestId("desktop-menu-tree").getByRole("link", { name: "官网设置" }).click();
  await expect(page.getByRole("heading", { name: "官网内容" })).toBeVisible();
  const card = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: contentKey, exact: true }),
  });

  await card.getByRole("link", { name: "编辑草稿" }).click();
  await expect(page).toHaveURL(new RegExp(`/website-content/${contentKey}/edit$`, "u"));
}
```

Update existing Home callers to `openContentEditor(page, "home")`. Make `publishSavedDraft` accept `contentKey` and assert `发布前确认：{contentKey}`.

- [ ] **Step 2: Add the Help draft/publish/public test**

Add a serial test:

```ts
test("帮助草稿发布后才进入公开接口", async ({ browser, page }) => {
  const question = `如何完善资料 ${Date.now()}`;
  let publisherContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

  try {
    await loginWebsiteOperator(page, websiteContentFixtures.editor);
    await openContentEditor(page, websiteContentFixtures.help.contentKey);
    await page.getByLabel(websiteContentFixtures.help.questionLabel).fill(question);
    await page.getByLabel("变更摘要").fill("帮助 E2E：更新资料问题");
    await page.getByRole("button", { name: "保存草稿" }).click();

    const before = await page.request.get("/api/website-content/help");
    expect(before.ok()).toBe(true);
    expect(JSON.stringify((await before.json()).data)).not.toContain(question);

    publisherContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const publisherPage = await publisherContext.newPage();
    await loginWebsiteOperator(publisherPage, websiteContentFixtures.publisher);
    await openContentEditorRoute(publisherPage, "help");
    await publishSavedDraft(publisherPage, "help", "帮助 E2E：发布资料问题");

    const after = await publisherPage.request.get("/api/website-content/help");
    expect(after.ok()).toBe(true);
    expect(JSON.stringify((await after.json()).data)).toContain(question);
  } finally {
    await publisherContext?.close();
  }
});
```

Change `openHomeEditorRoute` to `openContentEditorRoute(page, contentKey)` using the same validated fixed key argument. The E2E runner uses an isolated schema, so no production content is modified.

- [ ] **Step 3: Run the target E2E**

Run:

```powershell
$env:ASTRO_TELEMETRY_DISABLED="1"
pnpm --filter @petcare/admin test:e2e -- website-content.spec.ts
```

Expected: existing Home lifecycle/RBAC/media tests and the new Help publication test PASS.

- [ ] **Step 4: Commit the E2E coverage**

```powershell
git add apps/admin/e2e
git commit -m "test(content): 覆盖帮助内容发布链路"
```

### Task 6: Add pure Miniapp content retrieval and mapping

**Interfaces:**

- `getPublishedContent(contentKey): Promise<WebsitePublicContent>` uses public `rawRequest`.
- `toHelpCategories` maps enabled `rich_text` sections.
- `filterHelpCategories` searches category, question, and answer text in memory.
- `toRichTextContent` maps Privacy/Terms.
- `toContactPanel` selects the fixed `contact_panel`.
- `getContactAction` returns `phone`, `email`, or `none` after local format checks.

- [ ] **Step 1: Write failing mapper tests**

Create `apps/miniapp/src/pages-content/content-mappers.spec.ts` with a minimal `WebsitePublicContent` fixture and these cases:

```ts
it("maps rich-text sections to Help categories and filters question answers", () => {
  const categories = toHelpCategories(helpContent);

  expect(categories[0]).toMatchObject({
    key: "account_and_identity",
    title: "账号与认证",
    questions: [{ question: "如何完善个人信息？" }],
  });
  expect(filterHelpCategories(categories, "手机号")).toHaveLength(1);
  expect(filterHelpCategories(categories, "没有结果")).toEqual([]);
});

it("accepts only locally valid phone and email actions", () => {
  expect(getContactAction("tel:400-888-6288")).toEqual({
    kind: "phone",
    value: "4008886288",
  });
  expect(getContactAction("mailto:support@petcare.example")).toEqual({
    kind: "email",
    value: "support@petcare.example",
  });
  expect(getContactAction("https://example.com/support")).toEqual({ kind: "none" });
  expect(getContactAction("tel:not-a-number")).toEqual({ kind: "none" });
});
```

Also assert disabled sections are ignored and multiple legal paragraphs retain order.

- [ ] **Step 2: Run the mapper test and confirm missing modules**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/pages-content/content-mappers.spec.ts
```

Expected: FAIL because the content API/mappers do not exist.

- [ ] **Step 3: Add the one-line public API wrapper**

Create `apps/miniapp/src/api/content.ts`:

```ts
import type { WebsiteContentKey, WebsitePublicContent } from "@petcare/shared-types";
import { rawRequest } from "./request";

export function getPublishedContent(contentKey: WebsiteContentKey): Promise<WebsitePublicContent> {
  return rawRequest<WebsitePublicContent>(`/website-content/${encodeURIComponent(contentKey)}`);
}
```

- [ ] **Step 4: Implement exhaustive pure mappers**

Define only view shapes actually rendered:

```ts
export interface HelpCategory {
  key: string;
  title: string;
  questions: Array<{ key: string; question: string; answer: string }>;
}

export function toHelpCategories(content: WebsitePublicContent): HelpCategory[] {
  return content.sections.flatMap((section) =>
    section.isEnabled && section.sectionType === WEBSITE_SECTION_TYPE.RICH_TEXT
      ? [
          {
            key: section.sectionKey,
            title: section.content.title,
            questions: section.content.parts.map((part) => ({
              key: part.partKey,
              question: part.heading,
              answer: part.paragraphs.join("\n"),
            })),
          },
        ]
      : [],
  );
}
```

`filterHelpCategories` trims/lowercases the query and preserves category/question order. `toRichTextContent` returns all enabled rich-text sections. `toContactPanel` returns the first enabled contact panel or `null`.

For actions:

```ts
export function getContactAction(
  href: WebsiteLinkDestination,
): { kind: "phone" | "email"; value: string } | { kind: "none" } {
  if (href.startsWith("tel:")) {
    const value = href.slice(4).replace(/[\s-]/gu, "");
    return /^\+?\d{5,20}$/u.test(value) ? { kind: "phone", value } : { kind: "none" };
  }
  if (href.startsWith("mailto:")) {
    const value = href.slice(7).split("?", 1)[0];
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) ? { kind: "email", value } : { kind: "none" };
  }
  return { kind: "none" };
}
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/pages-content/content-mappers.spec.ts
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
git diff --check
```

Expected: focused test and Miniapp checks PASS.

```powershell
git add apps/miniapp/src/api/content.ts apps/miniapp/src/pages-content/content-mappers.ts apps/miniapp/src/pages-content/content-mappers.spec.ts
git commit -m "feat(miniapp): 建立支持内容读取映射"
```

### Task 7: Replace static Help and Contact pages with published content

**Interfaces:**

- Help performs local keyword filtering with real input.
- Contact executes only validated phone/email actions.
- Both pages expose loading, empty, failure, retry, and ready states.
- No fixture fallback remains.

- [ ] **Step 1: Connect Help loading and search**

In `help/index.vue`, replace `categories` and `faqs` constants with:

```ts
const query = ref("");
const categories = ref<HelpCategory[]>([]);
const status = ref<"loading" | "ready" | "error">("loading");
const filtered = computed(() => filterHelpCategories(categories.value, query.value));

async function load() {
  status.value = "loading";
  try {
    categories.value = toHelpCategories(await getPublishedContent(WEBSITE_CONTENT_KEY.HELP));
    status.value = "ready";
  } catch {
    status.value = "error";
  }
}

onLoad(() => {
  void load();
});
```

Use a real input bound to `query`. Render category cards only when they retain matching questions. Empty published content and no search matches need different copy: “帮助内容暂未配置” versus “未找到相关问题”.

- [ ] **Step 2: Connect Contact content and safe actions**

Replace every hard-coded card in `contact/index.vue`. Load `CONTACT` and map the panel. For each channel:

```ts
async function activateChannel(channel: WebsiteContactChannel) {
  const action = getContactAction(channel.href);
  if (action.kind === "phone") {
    await uni.makePhoneCall({ phoneNumber: action.value });
    return;
  }
  if (action.kind === "email") {
    await uni.setClipboardData({ data: action.value });
    await uni.showToast({ title: "邮箱已复制", icon: "success" });
  }
}
```

Only render an action button for `phone` or `email`. For `none`, show label/value/availability as text with no chevron, hover state, pointer behavior, or click handler.

- [ ] **Step 3: Add matched error and retry states**

Both pages must render:

- a lightweight loading block while `status === "loading"`;
- “暂未配置” when the response is valid but has no usable sections;
- an alert-style failure with a real “重新加载” button when `status === "error"`.

Disable retry during an active reload. Do not display stale fixture values.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- src/pages-content/content-mappers.spec.ts
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
git diff --check
```

Expected: checks PASS.

```powershell
git add apps/miniapp/src/pages-content/help/index.vue apps/miniapp/src/pages-content/contact/index.vue
git commit -m "feat(miniapp): 对接帮助与客服发布内容"
```

### Task 8: Add the legal content page and Privacy entry

**Interfaces:**

- One physical `legal/index` page renders `PRIVACY` or `TERMS` based on an allow-listed query.
- My adds a visible Privacy row.
- Login agreement links open Privacy and Terms.
- The route-state total rises from 36 after the cancellation plan to 37.

- [ ] **Step 1: Add the failing route and legal-key assertions**

Append `pages-content/legal/index` to `expectedSubPages` and update:

```ts
expect(6 + expectedSubPages.length + 2).toBe(37);
```

Add to `content-mappers.spec.ts`:

```ts
it("accepts only the two legal content keys", () => {
  expect(getLegalContentKey("privacy")).toBe(WEBSITE_CONTENT_KEY.PRIVACY);
  expect(getLegalContentKey("terms")).toBe(WEBSITE_CONTENT_KEY.TERMS);
  expect(getLegalContentKey("help")).toBe(WEBSITE_CONTENT_KEY.PRIVACY);
  expect(getLegalContentKey(undefined)).toBe(WEBSITE_CONTENT_KEY.PRIVACY);
});
```

- [ ] **Step 2: Run focused tests and confirm failures**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- pages-config.spec.ts src/pages-content/content-mappers.spec.ts
```

Expected: FAIL because the route and `getLegalContentKey` are absent.

- [ ] **Step 3: Implement the allow-listed key and register one route**

```ts
export function getLegalContentKey(value: unknown): WebsiteContentKey {
  return value === WEBSITE_CONTENT_KEY.TERMS
    ? WEBSITE_CONTENT_KEY.TERMS
    : WEBSITE_CONTENT_KEY.PRIVACY;
}
```

Add `"legal/index"` to the existing `pages-content` array in `pages.config.ts`.

- [ ] **Step 4: Build the generic legal page**

In `legal/index.vue`, read the query during `onLoad`, load the selected published content, and use `toRichTextContent`. The title is “服务协议” for Terms and “隐私协议” for Privacy. Render section title, optional effective date, each part heading, and escaped paragraphs in order.

Use the same loading/empty/error/retry state contract as Help and Contact. Do not render HTML and do not call `openPrivacyContract`.

- [ ] **Step 5: Add Privacy to My and connect both login agreements**

Append this managed support entry in `pages/profile/index.vue`:

```ts
{
  icon: "/static/main/help.svg",
  label: "隐私协议",
  detail: "查看已发布隐私内容",
  route: "/pages-content/legal/index?key=privacy",
},
```

In `pages/auth/index.vue`:

```ts
function openLegal(key: "privacy" | "terms") {
  uni.navigateTo({ url: `/pages-content/legal/index?key=${key}` });
}
```

Bind “服务协议” to `terms` and “隐私政策” to `privacy`. Both texts receive active color, click handling, and accessibility labels; surrounding explanatory text remains inert.

- [ ] **Step 6: Build and commit**

Run sequentially:

```powershell
pnpm --filter @petcare/miniapp test
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp build:mp-weixin
git diff --check
```

Expected: all checks PASS and generated route files include `pages-content/legal/index`.

```powershell
git add apps/miniapp
git commit -m "feat(miniapp): 接入隐私与服务协议内容"
```

### Task 9: Run affected cross-application acceptance

- [ ] **Step 1: Run Shared and Server checks**

```powershell
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/shared-types typecheck
pnpm --filter @petcare/server exec jest --runInBand src/seed/seed-website-content.spec.ts src/modules/website-content/website-page-template.registry.spec.ts src/modules/website-content/website-section-type.registry.spec.ts src/modules/website-content/website-content-public.service.spec.ts src/modules/website-content/public-website-content.controller.spec.ts
pnpm --filter @petcare/server typecheck
pnpm --filter @petcare/server lint
```

Expected: all affected shared/server checks PASS.

- [ ] **Step 2: Run Admin checks**

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/WebsiteContent
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin build
$env:ASTRO_TELEMETRY_DISABLED="1"
pnpm --filter @petcare/admin test:e2e -- website-content.spec.ts
```

Expected: Website Content unit/E2E, Admin typecheck/lint/build PASS.

- [ ] **Step 3: Run Website preview checks**

```powershell
pnpm --filter @petcare/website exec vitest run src/routes/preview-session.test.ts src/routes/preview-route-contract.test.ts
pnpm --filter @petcare/website typecheck
pnpm --filter @petcare/website build
```

Expected: Help capability preview tests, Website typecheck, and Website build PASS.

- [ ] **Step 4: Run Miniapp checks**

```powershell
pnpm --filter @petcare/miniapp test
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp build:mp-weixin
```

Expected: Miniapp checks PASS.

- [ ] **Step 5: Inspect the three real content states**

In Admin and WeChat DevTools:

1. Save a Help question as draft and confirm Miniapp still shows the published question.
2. Publish Help and confirm search finds the new question/answer.
3. Publish Contact with a test `tel:` and `mailto:`, then confirm only phone calls and email copies are actionable.
4. Publish Privacy text and confirm the My row and login Privacy link show the new published version.
5. Disable one Help category and confirm it disappears without shifting the remaining order.

- [ ] **Step 6: Finish diff hygiene**

Run:

```powershell
rg -n "400-888-6288|support@petcare\.example|const categories =|const faqs =" apps/miniapp/src/pages-content
git diff --check
```

Expected: no old hard-coded support fixture matches and diff check PASS.

- [ ] **Step 7: Commit final verification-only adjustments**

If formatting or generated route files changed after the last feature commit:

```powershell
git add packages/shared-types apps/server apps/admin apps/website apps/miniapp
git commit -m "chore(content): 完成支持内容对接门禁"
```

If there is no remaining diff, skip this commit.

## Final Acceptance Checklist

- [ ] Admin overview shows ten Website Content units and accepts `/website-content/help/edit`.
- [ ] Help has exactly four fixed `RICH_TEXT` categories; each category may be disabled but not removed, added, retyped, or reordered.
- [ ] Admin can edit every seeded category title, question, answer, contact label/value/href/availability, Privacy paragraph, and Terms paragraph.
- [ ] Draft changes remain private; public API and Miniapp change only after explicit publication.
- [ ] Miniapp Help search covers category, question, and answer text without a network search endpoint.
- [ ] Miniapp Contact invokes `uni.makePhoneCall` only for a locally valid `tel:` and copies only a locally valid `mailto:` address.
- [ ] Unconfigured or unsupported contact channels have no misleading active control.
- [ ] My contains a Privacy row; login contains active Privacy and Terms links.
- [ ] Legal content renders escaped structured text, never arbitrary HTML.
- [ ] Loading, empty, error, retry, disabled, and actionable visual states agree.
- [ ] The final route contract reports 37 pages/states after cancellation and legal pages are added.
- [ ] Fresh Website Content seed totals are exactly 10 contents, 20 versions, and 60 sections.
- [ ] Existing operator-owned content pointers are not overwritten by seeding.
- [ ] Shared, Server, Admin, Website preview/build, target E2E, Miniapp, MP build, and `git diff --check` pass at the scoped risk tier.
