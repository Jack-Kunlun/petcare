# Admin 静态资源与登录背景优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Admin 品牌资源纳入 Vite 构建流程，只保留真实使用的资源，并为登录页增加品牌软背景和正式浏览器图标。

**Architecture:** `docs/10-brand-system/deliverables/` 继续作为品牌权威源，Admin 在 `src/assets/brand/` 保存五个运行时副本并通过模块或 HTML 引用。Logo 组件只暴露真实使用的两个 SVG 变体；登录背景使用装饰性 SVG 图像；Nginx 为哈希资源提供 SVG gzip 和 immutable 缓存。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Tailwind CSS 4、Vitest、Nginx

## Global Constraints

- Admin 运行时品牌资源必须来自 `docs/10-brand-system/deliverables/` 的权威文件。
- `apps/admin/src/assets/brand/` 最终只能包含五个实际引用资源。
- Logo 使用 SVG，不保留或加载 4K PNG。
- 登录页使用 `petcare-background-soft.svg`，不使用宠物摄影背景。
- 样式优先使用 Tailwind 工具类，不新增页面级 CSS 或 SCSS。
- 保持现有认证、导航、权限、表单高度和切换动画行为不变。
- 提交说明使用 Conventional Commits，正文优先使用中文。

---

## File Structure

- `apps/admin/src/assets/brand/petcare-symbol-reverse.svg`：侧栏反白 Symbol。
- `apps/admin/src/assets/brand/petcare-logo-stacked-reverse.svg`：登录页反白堆叠 Logo。
- `apps/admin/src/assets/brand/petcare-background-soft.svg`：登录页整体软背景。
- `apps/admin/src/assets/brand/petcare-favicon.svg`：现代浏览器 favicon。
- `apps/admin/src/assets/brand/petcare-favicon.ico`：浏览器 favicon 兼容回退。
- `apps/admin/src/components/BrandLogo.tsx`：将两个 Logo 变体映射到 Vite 资源导入。
- `apps/admin/src/pages/Login/index.tsx`：渲染装饰性全页背景。
- `apps/admin/index.html`：声明 SVG 和 ICO favicon。
- `docker/nginx.conf`：配置 SVG gzip 与哈希资源长期缓存。
- `apps/admin/public/brand/`：删除整个旧运行时资源目录。

### Task 1: 将 Logo 迁移到 Vite 资源导入

**Files:**

- Create: `apps/admin/src/assets/brand/petcare-symbol-reverse.svg`
- Create: `apps/admin/src/assets/brand/petcare-logo-stacked-reverse.svg`
- Modify: `apps/admin/src/components/BrandLogo.tsx`
- Modify: `apps/admin/src/components/BrandLogo.test.tsx`
- Modify: `apps/admin/src/components/Sidebar.test.tsx`
- Delete: `apps/admin/public/brand/`

**Interfaces:**

- Consumes: 品牌源文件 `docs/10-brand-system/deliverables/logo/svg/petcare-symbol-reverse.svg` 与 `petcare-logo-stacked-reverse.svg`。
- Produces: `BrandLogo({ variant: "reverse" | "stacked-reverse", className?: string, label?: string }): JSX.Element`。

- [ ] **Step 1: 复制两个权威 SVG 到 Admin 资源目录**

使用精确文件复制，保留品牌源文件字节：

```powershell
New-Item -ItemType Directory -Force apps/admin/src/assets/brand
Copy-Item docs/10-brand-system/deliverables/logo/svg/petcare-symbol-reverse.svg apps/admin/src/assets/brand/petcare-symbol-reverse.svg
Copy-Item docs/10-brand-system/deliverables/logo/svg/petcare-logo-stacked-reverse.svg apps/admin/src/assets/brand/petcare-logo-stacked-reverse.svg
```

- [ ] **Step 2: 修改测试以声明模块导入行为**

在 `BrandLogo.test.tsx` 中导入两个资源，并将变体测试收敛为：

```tsx
import stackedReverseLogoUrl from "../assets/brand/petcare-logo-stacked-reverse.svg";
import reverseSymbolUrl from "../assets/brand/petcare-symbol-reverse.svg";

it.each([
  ["reverse", reverseSymbolUrl],
  ["stacked-reverse", stackedReverseLogoUrl],
] as const)("renders the %s variant from its imported asset", (variant, source) => {
  render(<BrandLogo variant={variant} />);
  expect(screen.getByRole("img", { name: "PetCare" })).toHaveAttribute("src", source);
});

it("renders SVG directly without a raster source", () => {
  const { container } = render(<BrandLogo variant="stacked-reverse" />);
  expect(container.querySelector("picture")).not.toBeInTheDocument();
  expect(container.querySelector("source")).not.toBeInTheDocument();
});
```

在 `Sidebar.test.tsx` 中导入 `reverseSymbolUrl`，并使用该值断言 `src`。

- [ ] **Step 3: 运行测试并确认旧 public URL 使测试失败**

Run:

```bash
pnpm --filter @petcare/admin exec vitest run src/components/BrandLogo.test.tsx src/components/Sidebar.test.tsx
```

Expected: FAIL，`src` 仍为 `/brand/...`，且 `<picture>`/`<source>` 仍存在。

- [ ] **Step 4: 实现精简的 BrandLogo**

将 `BrandLogo.tsx` 改为：

```tsx
import type { JSX } from "react";
import stackedReverseLogoUrl from "../assets/brand/petcare-logo-stacked-reverse.svg";
import reverseSymbolUrl from "../assets/brand/petcare-symbol-reverse.svg";

type BrandLogoVariant = "reverse" | "stacked-reverse";

interface BrandLogoProps {
  variant: BrandLogoVariant;
  className?: string;
  label?: string;
}

const sources = {
  reverse: reverseSymbolUrl,
  "stacked-reverse": stackedReverseLogoUrl,
} as const satisfies Record<BrandLogoVariant, string>;

/** 渲染一个进入 Vite 构建流程的 PetCare 品牌标识。 */
export function BrandLogo({ variant, className, label = "PetCare" }: BrandLogoProps): JSX.Element {
  return (
    <img
      src={sources[variant]}
      alt={label}
      decoding="sync"
      className={`object-contain${className ? ` ${className}` : ""}`}
    />
  );
}
```

- [ ] **Step 5: 删除旧 public 品牌目录并验证测试**

先确认删除目标为 `D:\projects\petcare\apps\admin\public\brand`，然后删除该目录，运行：

```bash
pnpm --filter @petcare/admin exec vitest run src/components/BrandLogo.test.tsx src/components/Sidebar.test.tsx
```

Expected: PASS，且 `apps/admin/public/brand` 不存在。

- [ ] **Step 6: 提交 Logo 资源迁移**

```bash
git add apps/admin/src/assets/brand apps/admin/src/components/BrandLogo.tsx apps/admin/src/components/BrandLogo.test.tsx apps/admin/src/components/Sidebar.test.tsx apps/admin/public/brand
git commit -m "refactor(admin): 迁移品牌静态资源"
```

### Task 2: 增加登录背景与浏览器图标

**Files:**

- Create: `apps/admin/src/assets/brand/petcare-background-soft.svg`
- Create: `apps/admin/src/assets/brand/petcare-favicon.svg`
- Create: `apps/admin/src/assets/brand/petcare-favicon.ico`
- Modify: `apps/admin/src/pages/Login/index.tsx`
- Modify: `apps/admin/src/pages/Login/index.test.tsx`
- Modify: `apps/admin/index.html`

**Interfaces:**

- Consumes: `petcare-background-soft.svg`、`petcare-favicon.svg` 与 `petcare-favicon.ico` 的权威品牌交付文件。
- Produces: `data-testid="login-background"` 的装饰性背景图，以及 SVG 首选、ICO 回退的 favicon 声明。

- [ ] **Step 1: 复制背景和 favicon 权威资源**

```powershell
Copy-Item docs/10-brand-system/deliverables/elements/gradients/petcare-background-soft.svg apps/admin/src/assets/brand/petcare-background-soft.svg
Copy-Item docs/10-brand-system/deliverables/logo/favicon/petcare-favicon.svg apps/admin/src/assets/brand/petcare-favicon.svg
Copy-Item docs/10-brand-system/deliverables/logo/favicon/petcare-favicon.ico apps/admin/src/assets/brand/petcare-favicon.ico
```

- [ ] **Step 2: 为登录背景编写失败测试**

在 `Login/index.test.tsx` 顶部导入背景 URL，并在布局测试中增加：

```tsx
import loginBackgroundUrl from "../../assets/brand/petcare-background-soft.svg";

const background = screen.getByTestId("login-background");
expect(background).toHaveAttribute("src", loginBackgroundUrl);
expect(background).toHaveAttribute("aria-hidden", "true");
expect(background).toHaveClass("pointer-events-none", "absolute", "inset-0", "object-cover");
```

- [ ] **Step 3: 运行登录页测试并确认背景不存在**

Run:

```bash
pnpm --filter @petcare/admin exec vitest run src/pages/Login/index.test.tsx
```

Expected: FAIL，找不到 `login-background`。

- [ ] **Step 4: 在登录页渲染整体品牌背景**

在 `Login/index.tsx` 导入背景 URL，并将背景图放在现有光晕之前：

```tsx
import loginBackgroundUrl from "../../assets/brand/petcare-background-soft.svg";

<img
  src={loginBackgroundUrl}
  alt=""
  aria-hidden="true"
  data-testid="login-background"
  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
/>;
```

保留 `<main>` 当前浅色渐变作为 SVG 加载失败时的回退，不改变登录卡片、表单或动画类名。

- [ ] **Step 5: 替换浏览器 favicon 声明**

将 `apps/admin/index.html` 中的 `/vite.svg` 替换为：

```html
<link rel="icon" type="image/svg+xml" href="/src/assets/brand/petcare-favicon.svg" />
<link rel="icon" href="/src/assets/brand/petcare-favicon.ico" sizes="any" />
```

- [ ] **Step 6: 验证登录测试和生产构建**

Run:

```bash
pnpm --filter @petcare/admin exec vitest run src/pages/Login/index.test.tsx
pnpm --filter @petcare/admin build
```

Expected: 测试与构建 PASS；`dist/index.html` 不包含 `/vite.svg` 或 `/brand/`，并包含构建后的 PetCare favicon 路径。

- [ ] **Step 7: 提交登录背景与 favicon**

```bash
git add apps/admin/src/assets/brand apps/admin/src/pages/Login/index.tsx apps/admin/src/pages/Login/index.test.tsx apps/admin/index.html
git commit -m "feat(admin): 增加登录页品牌背景与浏览器图标"
```

### Task 3: 配置 SVG 压缩与哈希资源缓存

**Files:**

- Modify: `docker/nginx.conf`

**Interfaces:**

- Consumes: Vite 默认输出目录 `/assets/` 和内容哈希文件名。
- Produces: SVG gzip 响应与 `/assets/` 一年 immutable 缓存策略。

- [ ] **Step 1: 修改 Nginx 静态资源配置**

在 `gzip_types` 中加入 `image/svg+xml`，并在 `location /` 之前增加：

```nginx
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}
```

保持 `/api/` 代理和 SPA 回退规则不变。

- [ ] **Step 2: 验证配置与完整构建**

Run:

```bash
docker compose config
pnpm lint:styles
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin test
pnpm --filter @petcare/admin build
git diff --check
```

Expected: 所有命令 PASS；`apps/admin/dist` 不包含 `brand` 目录或 PNG Logo，`src/assets/brand` 恰好包含五个文件。

- [ ] **Step 3: 检查最终资源闭包**

```powershell
Get-ChildItem apps/admin/src/assets/brand | Sort-Object Name | Select-Object Name,Length
Get-ChildItem apps/admin/dist -Recurse | Where-Object { $_.Name -match 'petcare|brand|4096|\.png$' } | Select-Object FullName,Length
rg -n "/brand/|vite\.svg|4096\.png" apps/admin/src apps/admin/index.html apps/admin/dist
```

Expected: 源目录只有五个批准资源；代码与构建产物没有旧 public URL、Vite 默认图标或 4K PNG 引用。

- [ ] **Step 4: 提交 Nginx 与最终验证结果**

```bash
git add docker/nginx.conf
git commit -m "chore(docker): 优化前端静态资源缓存"
```
