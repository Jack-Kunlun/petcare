# 后台登录页视觉修正实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans when executing this plan task-by-task.

**Goal:** 在不改变认证行为的前提下，修正后台登录页的背景层次、表单对齐、品牌区排版、Logo 清晰度观感和模式切换稳定性。

**Architecture:** 保持现有 `Login` 单页和 `BrandLogo` 共享组件边界，使用 Tailwind v4 语义 token 与现有全局动效，不引入新依赖、不替换 SVG 资产。登录表单两种模式继续由同一固定高度容器承载，通过静态布局和短时入场动画避免布局跳动。

**Tech Stack:** React 19、TypeScript、Tailwind CSS v4、Vitest、Testing Library、Vite。

## Global Constraints

- 不修改认证 API、验证码 API、路由、权限判断或服务端逻辑。
- 不新增第三方依赖，不引入 PNG/WebP 构建链，不修改批准 SVG 内容。
- Admin 样式优先使用 Tailwind；仅使用现有 `@theme` 语义 token，不在组件中新增原始颜色。
- 保留键盘焦点环、语义 label/tab/tabpanel、禁用状态和 aria-live 错误提示。
- 动效使用约 220ms，并遵守全局 `prefers-reduced-motion` 降级。

---

### Task 1: 统一 BrandLogo 的清晰度与布局属性

**Files:**

- Modify: `apps/admin/src/components/BrandLogo.tsx`
- Test: `apps/admin/src/components/BrandLogo.test.tsx`

**Implementation:**

- 先在测试中断言 Logo 具有 `decoding="sync"` 和 `object-contain`。
- 运行 `./node_modules/.bin/vitest.CMD run src/components/BrandLogo.test.tsx --configLoader native`，确认新增断言失败。
- 在 `<img>` 上增加 `decoding="sync"`，保留静态 src、alt、object-contain 和现有 className 合并逻辑；不要修改 SVG。
- 重跑同一测试，确认通过。
- 提交：`git add apps/admin/src/components/BrandLogo.tsx apps/admin/src/components/BrandLogo.test.tsx; git commit -m "fix: 提升后台品牌标识显示稳定性"`。

### Task 2: 修正登录页视觉层次、控件对齐与切换稳定性

**Files:**

- Modify: `apps/admin/src/pages/Login/index.tsx`
- Test: `apps/admin/src/pages/Login/index.test.tsx`

**Implementation:**

- 测试新增 `login-form-panels` 固定高度容器、验证码面板动效 class、验证码输入框 `h-12` 和发送按钮 `h-12` 断言；继续复用现有登录、验证码刷新、发送中、错误状态测试，禁止改动 mock API 参数。
- 先运行 `./node_modules/.bin/vitest.CMD run src/pages/Login/index.test.tsx --configLoader native`，确认新增断言失败。
- 将左侧改为品牌蓝到靛蓝渐变，增加两个 `aria-hidden` 低对比光晕和细网格装饰；文案按眉题、主标题、说明和三项服务标签分层；登录 Logo 使用更大 stacked reverse 规格。
- 给两种面板共用的容器增加 `data-testid="login-form-panels"` 和固定最小高度；验证码面板增加 `data-testid="sms-login-panel"`。
- 验证码输入框、验证码图片按钮和发送按钮统一 `h-12`、圆角和间距；发送按钮固定宽度，避免发送中/倒计时文字引起布局抖动。
- 两个面板使用 220ms 透明度与上移动效，不动画高度；使用现有 `text-text-primary`、`text-text-secondary` 和品牌 token，保留 reduced-motion。
- 重跑登录页测试，确认全部通过。
- 提交：`git add apps/admin/src/pages/Login/index.tsx apps/admin/src/pages/Login/index.test.tsx; git commit -m "fix: 优化后台登录页视觉与切换体验"`。

### Task 3: 全量验证与交付检查

**Files:**

- Test: `apps/admin/src/components/BrandLogo.test.tsx`
- Test: `apps/admin/src/pages/Login/index.test.tsx`

**Implementation:**

- 从 `apps/admin` 运行 `./node_modules/.bin/vitest.CMD run src/components/BrandLogo.test.tsx src/pages/Login/index.test.tsx --configLoader native`。
- 运行 `./node_modules/.bin/tsc.CMD --noEmit`、`./node_modules/.bin/eslint.CMD .`、`node ../../scripts/style-policy.mjs admin`。
- 运行 `./node_modules/.bin/vite.CMD build --configLoader native` 和 `node ../../scripts/style-output-policy.mjs admin dist`；允许已有 bundle 体积提示，但不得新增样式产物违规。
- 运行 `git diff --check` 和 `git status --short`；人工检查 375px、768px、1024px、1440px 下品牌区、Logo、控件对齐、切换高度稳定、hover/focus/disabled 和 reduced-motion。
- 仅当验证暴露本次改动引入的问题时提交修复；无额外修复则不创建空提交。
