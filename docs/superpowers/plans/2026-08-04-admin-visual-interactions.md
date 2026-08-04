# PetCare 后台视觉与交互优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已批准的 PetCare 品牌资产、统一交互状态和克制动效应用到全部 Admin 页面，重点修复登录方式滑块、验证码交互和全局控件默认态问题。

**Architecture:** 通过 Admin 全局 CSS-first Token 提供品牌颜色、焦点环、过渡曲线和 reduced-motion 降级；通过小型 `BrandLogo` 与 `PageTransition` 组件复用品牌和页面进入行为。页面继续使用 Tailwind v4 工具类，登录和全局壳层先改造，业务页面只消费统一类名和状态模式，不改变路由、权限、API 或信息架构。

**Tech Stack:** React 19、React Router、Tailwind CSS v4、Vite、Lucide React、Vitest、Testing Library、ESLint。

## Global Constraints

- 使用 `docs/10-brand-system/deliverables/` 中的批准 Logo，不重新绘制、改色、拉伸或增加额外容器。
- Admin 颜色 Token 使用品牌蓝 `#4A6CF7`、hover `#3F5FE0`、active `#3552C8`、辅助绿 `#5BC8AF`、强调色 `#F6B343`。
- 普通过渡 150–220ms，页面/卡片进入 220–360ms；不对密集表格使用夸张缩放或 overshoot。
- 所有可点击元素必须有 `cursor-pointer`、hover、active、focus-visible 和 disabled 状态。
- 所有动画必须在 `prefers-reduced-motion: reduce` 下自动降级。
- 不引入 Framer Motion、GSAP 或其他新的运行时动画依赖。
- 不改变现有 React Router、AuthProvider、权限 Gate、API 和共享类型。
- 不在业务页面散落品牌十六进制值；页面优先使用 Tailwind 语义 Token。
- 不使用页面级 SCSS；只有全局 Token 和 Tailwind 无法表达的关键帧放入 `apps/admin/src/index.css`。

---

### Task 1: 品牌资产与全局设计 Token

**Files:**

- Create: `apps/admin/public/brand/petcare-symbol-color.svg`
- Create: `apps/admin/public/brand/petcare-symbol-reverse.svg`
- Create: `apps/admin/public/brand/petcare-logo-stacked-color.svg`
- Create: `apps/admin/public/brand/petcare-logo-stacked-reverse.svg`
- Modify: `apps/admin/src/index.css`
- Test: `apps/admin/src/index.css`（通过样式策略与生产构建验证）

**Interfaces:**

- Produces static asset URLs such as `/brand/petcare-symbol-reverse.svg`.
- Produces Tailwind v4 tokens `brand-primary`, `brand-primary-hover`, `brand-primary-active`, `care-secondary`, `accent`, `page-background`, `text-primary`, `text-secondary`, `border` and shared transition/keyframe rules.

- [ ] **Step 1: 复制批准的品牌 SVG 资产**

从 `docs/10-brand-system/deliverables/logo/svg/` 复制四个指定文件到 `apps/admin/public/brand/`，保持原始 SVG 内容和文件名，不修改 viewBox、颜色或路径。

- [ ] **Step 2: 写入全局 Token 和动画降级规则**

在 `@theme` 中增加品牌 Token，并在 `@layer base` 中保留现有字体和页面背景；增加以下语义关键帧，仅用于页面进入和验证码加载：

```css
@keyframes pc-page-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pc-skeleton-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
```

将现有 `prefers-reduced-motion` 规则扩展为同时覆盖 `pc-page-enter` 和 `pc-skeleton-shimmer`，确保减少动态效果时不产生位移或持续动画。

- [ ] **Step 3: 运行样式检查**

Run: `node scripts/style-policy.mjs admin`  
Expected: PASS，无未批准 CSS/SCSS 用法。

Run: `node scripts/style-output-policy.mjs admin apps/admin/dist`  
Expected: 若 dist 尚未生成，先执行 Task 6 的生产构建；最终必须 PASS。

- [ ] **Step 4: 提交独立基础层**

```bash
git add apps/admin/public/brand apps/admin/src/index.css
git commit -m "style: 增加后台品牌资产与视觉令牌"
```

### Task 2: 复用品牌与页面过渡组件

**Files:**

- Create: `apps/admin/src/components/BrandLogo.tsx`
- Create: `apps/admin/src/components/BrandLogo.test.tsx`
- Create: `apps/admin/src/components/PageTransition.tsx`
- Create: `apps/admin/src/components/PageTransition.test.tsx`

**Interfaces:**

- `BrandLogo({ variant: "color" | "reverse" | "stacked-color" | "stacked-reverse", className?, label? })` renders an accessible `<img>` with the matching `/brand/*` source and stable dimensions.
- `PageTransition({ children, className? })` renders a `div` with the shared page-enter animation class and does not add application state.

- [ ] **Step 1: 写 BrandLogo 失败测试**

测试四个 variant 对应的 `src`、默认 `alt`、传入 `label` 覆盖和 className；断言 Logo 使用 `object-contain`，不依赖 emoji 或 lucide 图标替代品牌资产。

- [ ] **Step 2: 实现 BrandLogo**

使用静态映射：

```ts
const sources = {
  color: "/brand/petcare-symbol-color.svg",
  reverse: "/brand/petcare-symbol-reverse.svg",
  "stacked-color": "/brand/petcare-logo-stacked-color.svg",
  "stacked-reverse": "/brand/petcare-logo-stacked-reverse.svg",
} as const;
```

默认 `alt` 为 `PetCare`，装饰性场景显式传入空字符串；组件不添加阴影、滤镜或颜色覆盖。

- [ ] **Step 3: 写 PageTransition 失败测试并实现**

断言 children 被渲染且容器包含 `animate-[pc-page-enter_320ms_ease-out_both]` 或等价的全局语义类；组件只负责视觉行为，不影响 children 的路由或权限。

- [ ] **Step 4: 运行组件测试**

Run: `apps/admin/node_modules/.bin/vitest.CMD run --configLoader native src/components/BrandLogo.test.tsx src/components/PageTransition.test.tsx`  
Expected: PASS。

- [ ] **Step 5: 提交组件层**

```bash
git add apps/admin/src/components/BrandLogo.tsx apps/admin/src/components/BrandLogo.test.tsx apps/admin/src/components/PageTransition.tsx apps/admin/src/components/PageTransition.test.tsx
git commit -m "feat: 增加后台品牌与页面过渡组件"
```

### Task 3: 登录页交互重做

**Files:**

- Modify: `apps/admin/src/pages/Login/index.tsx`
- Modify: `apps/admin/src/pages/Login/index.test.tsx`

**Interfaces:**

- Preserve `LoginMode`, AuthProvider methods, captcha API and existing validation messages.
- Add no new network calls and no changes to `authApi` signatures.

- [ ] **Step 1: 扩展登录页失败测试**

在现有测试中增加以下行为断言：

```ts
expect(screen.getByRole("tab", { name: "密码登录" })).toHaveAttribute("aria-selected", "true");
await user.click(screen.getByRole("tab", { name: "验证码登录" }));
expect(screen.getByRole("tab", { name: "验证码登录" })).toHaveAttribute("aria-selected", "true");
expect(screen.getByTestId("login-mode-indicator")).toHaveClass("translate-x-full");
```

同时覆盖验证码图片点击刷新、验证码加载失败重试、发送中禁用、倒计时文本和登录 pending 禁用。

- [ ] **Step 2: 实现品牌登录布局**

使用 `BrandLogo variant="stacked-reverse"`；将背景分为深色品牌面与白色表单面，桌面端并排、窄屏端上下排列。Logo 只承担识别，不添加自制图形容器。

- [ ] **Step 3: 实现滑块 Tab**

在 `role="tablist"` 内增加绝对定位 indicator，使用 `translate-x-0`/`translate-x-full` 切换，过渡 220ms；两个 Tab 保持最小 44px 高度、键盘焦点和 `aria-controls`。滑块不改变登录模式业务状态，只反映已有 `mode`。

- [ ] **Step 4: 实现表单切换和验证码反馈**

为两种表单保留稳定的最小高度，使用 `opacity` 与 `translate-y` 类控制进入状态；验证码按钮增加 `cursor-pointer`、hover、active、focus-visible，加载时显示 skeleton/禁用态，发送按钮按 `sendingCode` 和 `cooldown` 展示状态。

- [ ] **Step 5: 运行登录测试与 lint**

Run: `apps/admin/node_modules/.bin/vitest.CMD run --configLoader native src/pages/Login/index.test.tsx`  
Expected: PASS。

Run: `apps/admin/node_modules/.bin/eslint.CMD src/pages/Login/index.tsx`  
Expected: PASS。

- [ ] **Step 6: 提交登录页**

```bash
git add apps/admin/src/pages/Login/index.tsx apps/admin/src/pages/Login/index.test.tsx
git commit -m "feat: 优化后台登录交互与验证码反馈"
```

### Task 4: 全局 Layout、Header、Sidebar 动效

**Files:**

- Modify: `apps/admin/src/components/Layout.tsx`
- Modify: `apps/admin/src/components/Header.tsx`
- Modify: `apps/admin/src/components/Sidebar.tsx`
- Modify: `apps/admin/src/components/Layout.test.tsx`
- Modify: `apps/admin/src/components/Header.test.tsx`
- Modify: `apps/admin/src/components/Sidebar.test.tsx`

**Interfaces:**

- Preserve existing permission props, route tree, mobile drawer behavior and logout flow.
- `Layout` wraps `<Outlet />` in `PageTransition` without changing route elements.

- [ ] **Step 1: 扩展全局壳层测试**

增加断言：Header/Sidebar 展示真实品牌 Symbol、可点击按钮包含 `cursor-pointer` 和 focus-visible 类；Layout 主内容仍含 `min-h-0 flex-1 overflow-y-auto`，权限菜单断言保持原样。

- [ ] **Step 2: 改造 Sidebar 品牌区与菜单状态**

使用 `BrandLogo variant="reverse"` 替换当前手绘 Shield 图标作为品牌 Symbol；保留 Lucide 图标作为菜单图标。父菜单展开/收起使用高度和透明度过渡，子菜单保持无图标，权限过滤函数不变。

- [ ] **Step 3: 改造 Header 控件状态**

统一通知、移动菜单、退出登录和用户信息区域的 hover/active/focus-visible 状态；通知徽标保留文字可访问名称，不引入新的通知业务逻辑。

- [ ] **Step 4: 接入页面过渡**

将 `<Outlet />` 放入 `PageTransition`，主内容滚动容器和 `h-screen` 结构不变，避免侧栏被内容高度撑开。

- [ ] **Step 5: 运行壳层测试**

Run: `apps/admin/node_modules/.bin/vitest.CMD run --configLoader native src/components/Layout.test.tsx src/components/Header.test.tsx src/components/Sidebar.test.tsx`  
Expected: PASS。

- [ ] **Step 6: 提交全局壳层**

```bash
git add apps/admin/src/components/Layout.tsx apps/admin/src/components/Header.tsx apps/admin/src/components/Sidebar.tsx apps/admin/src/components/Layout.test.tsx apps/admin/src/components/Header.test.tsx apps/admin/src/components/Sidebar.test.tsx
git commit -m "style: 优化后台全局壳层交互"
```

### Task 5: 统一业务页面状态和可操作反馈

**Files:**

- Modify: `apps/admin/src/pages/Dashboard/index.tsx`
- Modify: `apps/admin/src/pages/UserManagement/index.tsx`
- Modify: `apps/admin/src/pages/UserManagement/Certification/index.tsx`
- Modify: `apps/admin/src/pages/OrderManagement/index.tsx`
- Modify: `apps/admin/src/pages/OrderManagement/Complaint/index.tsx`
- Modify: `apps/admin/src/pages/ContentManagement/index.tsx`
- Modify: `apps/admin/src/pages/ContentManagement/Posts/index.tsx`
- Modify: `apps/admin/src/pages/ContentManagement/Articles/index.tsx`
- Modify: `apps/admin/src/pages/Rbac/index.tsx`
- Modify: `apps/admin/src/pages/Rbac/Catalog.tsx`
- Modify: `apps/admin/src/pages/Settings/index.tsx`
- Modify: Existing `*.test.tsx` files adjacent to the pages when assertions need to cover the new interaction classes.

**Interfaces:**

- Preserve all existing API calls, query keys, filters, pagination shapes, permission gates and mutation handlers.
- Reuse `PageTransition` only at page roots; use Tailwind classes for cards, rows, controls and status feedback.

- [ ] **Step 1: 为页面根节点和卡片补充统一进入/hover 类**

每个页面根节点使用 `PageTransition` 或等价的 `animate-[pc-page-enter_320ms_ease-out_both]`；卡片使用统一 `transition-[box-shadow,border-color,background-color] duration-200`，表格行只变更背景/边框，不改变布局位置。

- [ ] **Step 2: 统一筛选器、分页和异步按钮状态**

为筛选输入、select、分页按钮、保存/发布/处理按钮补齐 `cursor-pointer`（非 disabled）、hover、active、focus-visible 和 disabled；异步状态保留按钮尺寸并显示文字或 spinner 图标。

- [ ] **Step 3: 统一 loading、empty、error 反馈**

现有 skeleton、空状态和错误状态增加共享品牌色、可读文字和可重试按钮；不得通过动画隐藏错误，也不得移除已有 `role="alert"`、`aria-live` 或表格语义。

- [ ] **Step 4: 更新关键交互测试**

至少为 Dashboard、用户列表、订单列表、投诉列表、内容列表、RBAC 和系统设置保留一个成功状态及一个 loading/empty/error 状态断言；新增断言只检查语义状态和交互类，不绑定脆弱的完整 class 字符串。

- [ ] **Step 5: 运行业务页面测试**

Run: `apps/admin/node_modules/.bin/vitest.CMD run --configLoader native`  
Expected: 全部 Admin 测试通过。

- [ ] **Step 6: 提交业务页面**

```bash
git add apps/admin/src/pages
git commit -m "style: 统一后台业务页面交互反馈"
```

### Task 6: 全量验证与手工验收准备

**Files:**

- Modify only files flagged by verification commands; no unrelated generated files.

- [ ] **Step 1: 运行 Admin 类型检查**

Run from `apps/admin`: `pnpm exec tsc --noEmit`  
Expected: PASS。

- [ ] **Step 2: 运行 Admin 全量测试**

Run from `apps/admin`: `./node_modules/.bin/vitest.CMD run --configLoader native`  
Expected: 所有测试通过。

- [ ] **Step 3: 运行 ESLint、生产构建和样式策略**

```powershell
cd apps/admin
./node_modules/.bin/eslint.CMD .
./node_modules/.bin/vite.CMD build --configLoader native
cd ../..
node scripts/style-policy.mjs admin
node scripts/style-output-policy.mjs admin apps/admin/dist
git diff --check
```

Expected: ESLint、Vite build、两项样式策略和 diff 检查全部通过。

- [ ] **Step 4: 运行关键屏幕手工验收**

使用 Chrome/Edge 验证 375px、768px、1024px、1440px；重点检查登录 Tab 滑块、验证码刷新/发送倒计时、页面滚动边界、侧栏展开、按钮 hover/focus 和 reduced-motion。

- [ ] **Step 5: 汇总变更并提交验证结果**

检查 `git status --short`，确保只保留本次设计相关文件；不要加入 `.env`、WorkBuddy 目录或审计 JSON。若各步骤已产生独立提交，最终只需报告提交列表和验证结果，不再创建空提交。
