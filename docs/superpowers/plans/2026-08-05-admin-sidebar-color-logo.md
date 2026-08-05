# Admin Sidebar Color Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Admin sidebar brand symbol with the approved color SVG while leaving the login logo and navigation behavior unchanged.

**Architecture:** Keep brand asset selection inside `BrandLogo` by adding a typed `color` variant. `Sidebar` consumes that variant without importing image files directly, and Vite continues to fingerprint the runtime SVG from `src/assets`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS v4, Vitest, Testing Library

## Global Constraints

- The source asset must be `docs/10-brand-system/deliverables/logo/svg/petcare-symbol-color.svg`.
- The Admin runtime asset directory must contain only assets used by the application.
- The sidebar symbol remains `40px × 40px`, retains its accessible name, and keeps the existing dark sidebar layout.
- The login page continues to use the reverse logo variants.
- Menu permissions, navigation behavior, animation, and responsive behavior must not change.

---

### Task 1: Add and consume the color brand symbol

**Files:**

- Create: `apps/admin/src/assets/brand/petcare-symbol-color.svg`
- Modify: `apps/admin/src/components/BrandLogo.tsx`
- Modify: `apps/admin/src/components/BrandLogo.test.tsx`
- Modify: `apps/admin/src/components/Sidebar.tsx`
- Modify: `apps/admin/src/components/Sidebar.test.tsx`

**Interfaces:**

- Consumes: the approved source SVG at `docs/10-brand-system/deliverables/logo/svg/petcare-symbol-color.svg`.
- Produces: `BrandLogoVariant` support for `"color"`, resolved by `BrandLogo` to the Vite-managed color SVG URL.
- Preserves: existing `"reverse"` and `"stacked-reverse"` variants and all `BrandLogoProps` behavior.

- [ ] **Step 1: Write failing component tests**

In `apps/admin/src/components/BrandLogo.test.tsx`, import the future runtime asset and add a color-variant assertion:

```tsx
import colorSymbolUrl from "../assets/brand/petcare-symbol-color.svg";

it("renders the color brand symbol", () => {
  render(<BrandLogo variant="color" label="PetCare color logo" />);

  expect(screen.getByRole("img", { name: "PetCare color logo" })).toHaveAttribute(
    "src",
    colorSymbolUrl,
  );
});
```

In `apps/admin/src/components/Sidebar.test.tsx`, replace the reverse asset import with the color asset import and update the first test:

```tsx
import colorSymbolUrl from "../assets/brand/petcare-symbol-color.svg";

it("uses the color PetCare brand symbol with an accessible label", () => {
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );

  const logo = screen.getByRole("img", { name: "PetCare 运营管理中心" });

  expect(logo).toHaveAttribute("src", colorSymbolUrl);
  expect(logo).toHaveClass("h-10", "w-10");
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run from `apps/admin`:

```bash
pnpm exec vitest run src/components/BrandLogo.test.tsx src/components/Sidebar.test.tsx
```

Expected: FAIL because `petcare-symbol-color.svg` and the `color` variant do not exist yet.

- [ ] **Step 3: Add the approved runtime SVG**

Copy the source file byte-for-byte:

```powershell
Copy-Item -LiteralPath "docs/10-brand-system/deliverables/logo/svg/petcare-symbol-color.svg" -Destination "apps/admin/src/assets/brand/petcare-symbol-color.svg"
```

Verify the source and runtime SHA-256 hashes match:

```powershell
$sourceHash = (Get-FileHash -Algorithm SHA256 "docs/10-brand-system/deliverables/logo/svg/petcare-symbol-color.svg").Hash
$runtimeHash = (Get-FileHash -Algorithm SHA256 "apps/admin/src/assets/brand/petcare-symbol-color.svg").Hash
if ($sourceHash -ne $runtimeHash) { throw "Color logo hash mismatch" }
```

- [ ] **Step 4: Add the typed color variant**

Update `apps/admin/src/components/BrandLogo.tsx` so the imports, variant union, and source mapping include `color`:

```tsx
import type { JSX } from "react";
import colorSymbolUrl from "../assets/brand/petcare-symbol-color.svg";
import stackedReverseLogoUrl from "../assets/brand/petcare-logo-stacked-reverse.svg";
import reverseSymbolUrl from "../assets/brand/petcare-symbol-reverse.svg";

type BrandLogoVariant = "color" | "reverse" | "stacked-reverse";

const sources = {
  color: colorSymbolUrl,
  reverse: reverseSymbolUrl,
  "stacked-reverse": stackedReverseLogoUrl,
} as const satisfies Record<BrandLogoVariant, string>;
```

Do not change the `BrandLogo` rendering, default label, decoding mode, or class merging.

- [ ] **Step 5: Switch only the sidebar to the color variant**

In `apps/admin/src/components/Sidebar.tsx`, change the existing `BrandLogo` call to:

```tsx
<BrandLogo variant="color" label="PetCare 运营管理中心" className="h-10 w-10 shrink-0" />
```

Do not modify the surrounding sidebar header, text, dimensions, menu tree, permissions, or responsive classes.

- [ ] **Step 6: Run focused tests and verify they pass**

Run from `apps/admin`:

```bash
pnpm exec vitest run src/components/BrandLogo.test.tsx src/components/Sidebar.test.tsx
```

Expected: 2 test files pass with no failures.

- [ ] **Step 7: Run Admin quality gates and production build**

Run from the repository root:

```bash
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin test
pnpm --filter @petcare/admin build
git diff --check
```

Expected: lint, all Admin tests, TypeScript checking, Vite production build, px-only style output policy, and Git whitespace validation all pass.

- [ ] **Step 8: Commit the implementation**

```bash
git add apps/admin/src/assets/brand/petcare-symbol-color.svg apps/admin/src/components/BrandLogo.tsx apps/admin/src/components/BrandLogo.test.tsx apps/admin/src/components/Sidebar.tsx apps/admin/src/components/Sidebar.test.tsx
git commit -m "feat(admin): 使用彩色侧栏 Logo"
```
