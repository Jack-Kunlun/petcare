# PetCare Miniapp Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Miniapp 按原型 v45 实现为可运行的品牌化页面壳层，完成高分辨率 Logo 登录页、首页首屏模块、5 个主 Tab 注册与登录成功跳转。

**Architecture:** 保留现有 `AuthProvider` 和首页根路由 `pages/index/index`，使用 Taro 原生 `tabBar` 管理 5 个主 Tab，使用共享的静态数据、品牌 Logo 和 Hero 资源构建首页。悬赏大厅、社区、消息和我的先使用统一的空状态页面，后续按原型子页面逐步替换，不引入新的状态管理或 API 请求。

**Tech Stack:** Taro 4、React 18、TypeScript、Tailwind CSS 4、Jest、Testing Library、Taro 原生 `Icon`。

## Global Constraints

- 主 Tab 固定为 `/`、`/bounty`、`/community`、`/messages`、`/profile`，Taro 页面分别位于 `pages/index/index`、`pages/bounty/index`、`pages/community/index`、`pages/messages/index`、`pages/profile/index`。
- 登录或手机号绑定成功后必须使用 `Taro.switchTab({ url: "/pages/index/index" })`，不得使用 `navigateBack` 返回游客页面。
- Miniapp 颜色 Token 使用 `#4A6CF7`、`#5BC8AF`、`#F6B343`、`#F8FAFC`、`#FFFFFF`、`#1F2937`、`#667085`、`#E6EAF0`。
- 生产 Logo 必须复用 `docs/10-brand-system/deliverables/logo/png` 中的批准资产，不得重新绘制或生成文字 Logo。
- 页面不得新增独立 CSS/SCSS；所有尺寸使用 `apps/miniapp/src/app.css` 中的语义 token，禁止 Tailwind 任意值、动态类名和 Emoji 结构图标。
- 首页使用静态数据，不请求后端；轮播图使用已交付的 `750×340` Miniapp Hero，图片不内嵌文字或 Logo。
- 交互控件触摸区域至少 44px，页面底部内容不得被 Tab 栏遮挡，所有可点击元素提供透明度反馈。

## File Map

- Create: `apps/miniapp/src/assets/brand/petcare-logo-stacked-color-780h.png` — 登录页高分辨率堆叠 Logo。
- Create: `apps/miniapp/src/assets/brand/petcare-symbol-color-1024.png` — 后续紧凑品牌场景备用 Symbol。
- Create: `apps/miniapp/src/assets/brand/hero-trusted-care-miniapp-v1.png` — 首页轮播图 1。
- Create: `apps/miniapp/src/assets/brand/hero-professional-care-miniapp-v1.png` — 首页轮播图 2。
- Create: `apps/miniapp/src/assets/brand/hero-community-companion-miniapp-v1.png` — 首页轮播图 3。
- Create: `apps/miniapp/src/components/brand/BrandLogo.tsx` — 统一 Logo 组件与尺寸语义。
- Create: `apps/miniapp/src/components/navigation/TabPlaceholder.tsx` — 空内容主 Tab 共享页面。
- Create: `apps/miniapp/src/components/navigation/TabPlaceholder.test.tsx` — 空状态和导航文案测试。
- Create: `apps/miniapp/src/pages/bounty/index.tsx`、`index.config.ts` — 悬赏大厅占位页。
- Create: `apps/miniapp/src/pages/community/index.tsx`、`index.config.ts` — 社区占位页。
- Create: `apps/miniapp/src/pages/messages/index.tsx`、`index.config.ts` — 消息占位页。
- Create: `apps/miniapp/src/pages/profile/index.tsx`、`index.config.ts` — 我的占位页。
- `apps/miniapp/package.json` — 依赖保持不变，使用 Taro 原生 `Icon`，避免新增图标依赖。
- Modify: `apps/miniapp/src/app.config.ts` — 注册页面和原生 Tab 栏。
- Modify: `apps/miniapp/src/app.css` — 替换旧 Miniapp Token，增加 Logo、Banner、Tab 和安全区尺寸。
- Modify: `apps/miniapp/src/pages/auth/index.tsx`、`index.test.tsx` — 品牌化登录页与统一登录后跳转。
- Modify: `apps/miniapp/src/pages/index/index.tsx`、`index.test.tsx` — 首页完整静态布局与交互。
- Modify: `apps/miniapp/src/pages/index/index.config.ts` — 首页导航标题。

---

### Task 1: 同步 Miniapp 主题 Token、资产和路由壳层

**Files:**

- Modify: `apps/miniapp/package.json`
- Modify: `apps/miniapp/src/app.css`
- Modify: `apps/miniapp/src/app.config.ts`
- Create: `apps/miniapp/src/assets/brand/*`

**Interfaces:**

- Produces the registered Taro routes and semantic classes consumed by all following page tasks.

- [x] **Step 1: Add the approved brand assets**

Copy the exact approved PNG masters from `docs/10-brand-system/deliverables/` into the Miniapp source asset directory. Do not edit or re-export the images.

```powershell
New-Item -ItemType Directory -Force apps/miniapp/src/assets/brand
Copy-Item docs/10-brand-system/deliverables/logo/png/petcare-logo-stacked-color-780h.png apps/miniapp/src/assets/brand/
Copy-Item docs/10-brand-system/deliverables/logo/png/petcare-symbol-color-1024.png apps/miniapp/src/assets/brand/
Copy-Item docs/10-brand-system/deliverables/hero/miniapp/hero-trusted-care-miniapp-v1.png apps/miniapp/src/assets/brand/
Copy-Item docs/10-brand-system/deliverables/hero/miniapp/hero-professional-care-miniapp-v1.png apps/miniapp/src/assets/brand/
Copy-Item docs/10-brand-system/deliverables/hero/miniapp/hero-community-companion-miniapp-v1.png apps/miniapp/src/assets/brand/
```

- [x] **Step 2: Declare icon and route dependencies**

Use the Taro-native `Icon` component for navigation and action symbols; do not add a new icon dependency for this shell.

- [x] **Step 3: Replace stale theme values with v45 tokens**

Update `app.css` so the existing semantic class names remain compatible while values map to the current brand baseline:

```css
--color-surface: #f8fafc;
--color-surface-muted: #eef2ff;
--color-ink: #1f2937;
--color-ink-strong: #202632;
--color-muted: #667085;
--color-muted-brand: #667085;
--color-brand: #4a6cf7;
--color-brand-strong: #3552c8;
--color-danger: #c23b43;
--color-care: #5bc8af;
--color-accent: #f6b343;
--color-border: #e6eaf0;
```

Add semantic spacing tokens for `logo-sm: 24px`, `logo-md: 48px`, `logo-lockup: 180px`, `hero-height: 170px`, `tab-height: 52px`, and `safe-bottom: 72px`.

- [x] **Step 4: Register the five primary pages and native Tab bar**

Update `app.config.ts` with page order and Tab configuration:

```typescript
pages: [
  "pages/index/index",
  "pages/bounty/index",
  "pages/community/index",
  "pages/messages/index",
  "pages/profile/index",
  "pages/auth/index",
],
tabBar: {
  color: "#667085",
  selectedColor: "#4A6CF7",
  backgroundColor: "#FFFFFF",
  borderStyle: "white",
  list: [
    { pagePath: "pages/index/index", text: "首页" },
    { pagePath: "pages/bounty/index", text: "悬赏大厅" },
    { pagePath: "pages/community/index", text: "社区" },
    { pagePath: "pages/messages/index", text: "消息" },
    { pagePath: "pages/profile/index", text: "我的" },
  ],
},
```

- [x] **Step 5: Run route and style checks**

Run: `pnpm --filter @petcare/miniapp typecheck` and `pnpm --filter @petcare/miniapp lint:styles`.

Expected: PASS with all registered pages and no stale Miniapp token values.

### Task 2: Build shared Logo and empty Tab page primitives

**Files:**

- Create: `apps/miniapp/src/components/brand/BrandLogo.tsx`
- Create: `apps/miniapp/src/components/navigation/TabPlaceholder.tsx`
- Create: `apps/miniapp/src/components/navigation/TabPlaceholder.test.tsx`
- Create: four Tab page pairs under `apps/miniapp/src/pages/`

**Interfaces:**

- `BrandLogo({ variant?: "stacked" | "symbol", className?: string, label?: string })` renders the approved asset with an accessible label and fixed semantic size.
- `TabPlaceholder({ title, description, icon })` renders a reusable empty state for a registered main Tab.

- [x] **Step 1: Write the empty-state test**

```tsx
it("renders the tab title and empty-state guidance", () => {
  render(<TabPlaceholder title="消息" description="新的订单和互动消息会显示在这里" />);
  expect(screen.getByText("消息")).toBeInTheDocument();
  expect(screen.getByText("新的订单和互动消息会显示在这里")).toBeInTheDocument();
});
```

- [x] **Step 2: Implement the shared primitives**

Use the Taro-native `Icon` component for non-decorative symbols, Taro `Image` for approved Logo assets, and static Tailwind classes only. Empty state must include `aria-label`, a 44px-safe action area only when an action is provided, and bottom spacing for the native Tab bar.

- [x] **Step 3: Create page wrappers and configs**

Each page imports `TabPlaceholder` and exports a short page-specific title/description. Page configs set the native navigation title and do not add a page-level stylesheet.

- [x] **Step 4: Run focused tests**

Run: `pnpm --filter @petcare/miniapp exec jest --runInBand src/components/navigation/TabPlaceholder.test.tsx`.

Expected: PASS.

### Task 3: Rebuild the branded login page and post-login navigation

**Files:**

- Modify: `apps/miniapp/src/pages/auth/index.tsx`
- Modify: `apps/miniapp/src/pages/auth/index.test.tsx`

**Interfaces:**

- Consumes `BrandLogo`, v45 theme tokens, and existing `useAuth()` methods.
- Produces the same `login`/`bindPhone` behavior with deterministic navigation to `/pages/index/index`.

- [x] **Step 1: Update navigation tests first**

Mock `Taro.switchTab` and assert both an already-bound login and a successful phone bind call:

```tsx
expect(Taro.switchTab).toHaveBeenCalledWith({ url: "/pages/index/index" });
expect(Taro.navigateBack).not.toHaveBeenCalled();
```

- [x] **Step 2: Implement the visual hierarchy**

Use the high-resolution stacked Logo at a restrained `logo-lockup` width, a brand-blue/mint light gradient surface, a white authentication card, clear two-step copy, disabled/loading states, and `MiniappApiError` recovery text. Do not add a page CSS file or use an oversized Logo as the page hero.

- [x] **Step 3: Replace `completeLogin()` with a single safe route**

```typescript
async function completeLogin(): Promise<void> {
  await Taro.switchTab({ url: "/pages/index/index" });
}
```

- [x] **Step 4: Run focused auth tests**

Run: `pnpm --filter @petcare/miniapp exec jest --runInBand src/pages/auth/index.test.tsx`.

Expected: PASS.

### Task 4: Implement the v45 home page shell

**Files:**

- Modify: `apps/miniapp/src/pages/index/index.tsx`
- Modify: `apps/miniapp/src/pages/index/index.test.tsx`
- Modify: `apps/miniapp/src/pages/index/index.config.ts`

**Interfaces:**

- Consumes `BrandLogo`, approved Miniapp Hero assets, `useAuth()`, and `Taro.navigateTo`/`Taro.switchTab`.
- Produces static v45 sections: Header, 3-slide Banner, service progress empty state, popular bounty cards, classroom list, and community highlights.

- [x] **Step 1: Add failing assertions for the v45 sections**

Cover loading, guest login, authenticated greeting, Banner title, `热门悬赏`, `萌宠课堂`, `社区精选`, and CTA navigation to `/pages/bounty/index`.

- [x] **Step 2: Implement static home data and layout**

Use `Swiper`/`SwiperItem` for three 5-second slides, `Image` with approved Hero assets, semantic token classes, horizontal `ScrollView` for bounty cards, and accessible buttons. Keep the home content scrollable above the native Tab bar with `pb-safe-bottom`.

- [x] **Step 3: Preserve authentication states**

Keep the current loading/guest/authenticated branching. Guest users see a login CTA; authenticated users see the greeting and logout action without changing the static home sections.

- [x] **Step 4: Run focused home tests**

Run: `pnpm --filter @petcare/miniapp exec jest --runInBand src/pages/index/index.test.tsx`.

Expected: PASS.

### Task 5: Run Miniapp quality gates and update implementation docs

**Files:**

- Modify: `docs/01-requirements/04-prototype-specification.md` — record the implementation start and any route deviations.
- Modify: `docs/superpowers/plans/2026-08-04-miniapp-pages-implementation.md` — check completed steps.

- [x] **Step 1: Run unit tests, typecheck, lint and style policy**

Run:

```powershell
pnpm --filter @petcare/miniapp test -- --runInBand
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp lint:styles
```

Expected: all Miniapp checks PASS; no build is required for the commit gate.

- [x] **Step 2: Run the repository diff check**

Run: `git diff --check`.

Expected: no whitespace errors.

- [x] **Step 3: Commit the Miniapp implementation**

```powershell
git add apps/miniapp docs/superpowers/plans/2026-08-04-miniapp-pages-implementation.md
git commit -m "feat: build miniapp branded page shell"
```
