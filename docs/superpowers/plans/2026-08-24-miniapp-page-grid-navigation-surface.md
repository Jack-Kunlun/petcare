# Miniapp Page Grid And Navigation Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize the five root-tab page gutters and align every shared secondary navigation bar to a white surface with a 44px back-button hit area whose icon follows the 16px page baseline.

**Architecture:** Keep `MainTabLayout` and `SubPageLayout` as the two existing page-header modes. Add semantic spacing aliases to the existing UnoCSS token source, migrate only root-page outer gutters and card-internal horizontal padding to those aliases, and fix all secondary pages once through `SubPageLayout` without touching platform safe-area calculations.

**Tech Stack:** UniApp, Vue 3, UnoCSS, Wot UI, Vitest

**Spec:** `C:/Users/18371/.codex/attachments/3797e8fd-28fa-4953-bdbe-7d504f090887/pasted-text.txt`

## Global Constraints

- Support `MP-WEIXIN`, `APP-PLUS`, and `H5`.
- Keep the existing status-bar, capsule, and Safe Area formulas unchanged.
- Use flex plus px-based fluid layout and UnoCSS utilities.
- Root headers retain `page-bg`; secondary navigation uses the existing white `surface` token.
- Preserve a back-button hit area of `44px × 44px` and a page baseline of `16px`.
- Do not add page-specific negative margins, odd-pixel offsets, brand-blue navigation, gradients, or shadows.
- Preserve unrelated `manifest.json` and documentation changes already present in the working tree.
- No Git commit is created unless the user explicitly requests one.

---

### Task 1: Centralize Root-Page Grid Tokens

**Files:**

- Modify: `apps/miniapp/src/config/design-tokens.ts`
- Modify: `apps/miniapp/src/config/design-tokens.spec.ts`
- Modify: `apps/miniapp/src/components/MainTabLayout.vue`
- Modify: `apps/miniapp/src/components/main-tab-layout.spec.ts`
- Modify: `apps/miniapp/src/pages/index/index.vue`
- Modify: `apps/miniapp/src/pages/bounty/index.vue`
- Modify: `apps/miniapp/src/pages/community/index.vue`
- Modify: `apps/miniapp/src/pages/messages/index.vue`
- Modify: `apps/miniapp/src/pages/profile/index.vue`

**Interfaces:**

- Consumes: `miniappDesignTokens.spacing` through the existing UnoCSS theme mapping.
- Produces: `page-horizontal`, `navigation-horizontal`, `card-padding`, and `section-gap` semantic spacing utilities.

- [x] **Step 1: Add a failing token and source contract test**

```ts
expect(miniappDesignTokens.spacing["page-horizontal"]).toBe("16px");
expect(miniappDesignTokens.spacing["navigation-horizontal"]).toBe("16px");
expect(miniappDesignTokens.spacing["card-padding"]).toBe("16px");
expect(miniappDesignTokens.spacing["section-gap"]).toBe("24px");

for (const pagePath of rootPagePaths) {
  const source = readSource(pagePath);
  expect(source).toContain("page-horizontal");
  expect(source).not.toMatch(/\b(?:mx|px)-action\b/);
}
```

- [x] **Step 2: Run the focused tests and confirm they fail for the missing semantic contract**

Run: `pnpm --filter @petcare/miniapp test -- src/config/design-tokens.spec.ts src/components/main-tab-layout.spec.ts`

Expected: failure because the semantic tokens and root-page utilities do not exist yet.

- [x] **Step 3: Add semantic tokens and migrate the five root pages without visual value changes**

```ts
spacing: {
  "page-horizontal": "16px",
  "navigation-horizontal": "16px",
  "card-padding": "16px",
  "section-gap": "24px",
}
```

Use `mx-page-horizontal` / `px-page-horizontal` for page-grid edges and `mx-card-padding` / `px-card-padding` / `p-card-padding` only inside cards. Keep explicitly full-width horizontal scroll containers full width while padding their inner content with `px-page-horizontal`.

- [x] **Step 4: Re-run the focused tests**

Run: `pnpm --filter @petcare/miniapp test -- src/config/design-tokens.spec.ts src/components/main-tab-layout.spec.ts`

Expected: both files pass.

### Task 2: Align Shared Secondary Navigation

**Files:**

- Modify: `apps/miniapp/src/components/SubPageLayout.vue`
- Modify: `apps/miniapp/src/components/sub-page-layout.spec.ts`

**Interfaces:**

- Consumes: `spacing["navigation-horizontal"]`, `sizes.control`, `colors.surface`, and the existing `titleInset` capsule-safe centering calculation.
- Produces: one shared white navigation surface and a left-aligned 44px back-button hit area for every `SubPageLayout` consumer.

- [x] **Step 1: Replace the old background-only test with a failing full navigation contract**

```ts
expect(source).toContain('class="shrink-0 bg-surface"');
expect(source).toContain('class="relative flex shrink-0 items-center bg-surface"');
expect(source).toContain("left-0");
expect(source).toContain("h-control w-control");
expect(source).toContain("justify-start");
expect(source).toContain("pl-navigation-horizontal");
expect(source).toContain("left: `${titleInset}px`, right: `${titleInset}px`");
```

- [x] **Step 2: Run the focused test and confirm it fails on gray navigation and the 28px icon baseline**

Run: `pnpm --filter @petcare/miniapp test -- src/components/sub-page-layout.spec.ts`

Expected: failure because the status placeholder and navigation use `bg-page-bg`, and the back hit area starts at 16px with a centered icon.

- [x] **Step 3: Apply the shared navigation fix**

```vue
<view class="shrink-0 bg-surface" />
<view class="relative flex shrink-0 items-center bg-surface">
  <view class="absolute left-0 box-border h-control w-control flex items-center justify-start pl-navigation-horizontal">
```

Retain the symmetric `titleInset` left/right style so the title remains screen-centered and capsule-safe. Do not change `platform-layout.ts`.

- [x] **Step 4: Re-run the focused test**

Run: `pnpm --filter @petcare/miniapp test -- src/components/sub-page-layout.spec.ts`

Expected: pass.

### Task 3: Verify Shared Consumers And All Targets

**Files:**

- Verify: `apps/miniapp/src/pages-bounty/reward/detail.vue`
- Verify: every `SubPageLayout` consumer under `apps/miniapp/src/pages-*`

**Interfaces:**

- Consumes: the root-grid and secondary-navigation contracts from Tasks 1 and 2.
- Produces: build and runtime evidence for the requested platforms and representative pages.

- [x] **Step 1: Run Miniapp tests, typecheck, scoped ESLint, Prettier, and diff hygiene**

Run:

```powershell
pnpm --filter @petcare/miniapp test
pnpm --filter @petcare/miniapp typecheck
node ../../node_modules/eslint/bin/eslint.js <changed-miniapp-files>
node node_modules/prettier/bin/prettier.cjs --check <changed-files>
git diff --check
```

Expected: zero test failures, zero type errors, zero lint errors, clean formatting, and no diff whitespace errors.

- [x] **Step 2: Run all four relevant builds sequentially**

Run:

```powershell
pnpm build:miniapp:mp-weixin
pnpm build:miniapp:h5
pnpm build:miniapp:app-android
pnpm build:miniapp:app-ios
```

Expected: four successful builds.

- [x] **Step 3: Verify H5 at mobile and desktop widths**

At `390×844`, `360×800`, and desktop width, assert root title/search/card left baselines equal `16px`; the secondary back icon left edge equals `16px`; the hit area stays `44px`; the navigation background is `rgb(255, 255, 255)`; and there is no horizontal overflow.

- [x] **Step 4: Report consumer coverage and exceptions**

List all existing `SubPageLayout` consumers. Explicitly report that standalone privacy-policy and service-agreement pages do not currently exist as routes rather than claiming they inherited the shared navigation.
