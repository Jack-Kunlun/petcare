# Admin 样式开发规范

本文约束 `apps/admin` 的样式实现、构建和校验方式。

> ~~原规范同时约束 `apps/miniapp` 的 Taro、Tailwind v4、WXSS 和 `px` Token 输出。~~ Taro 项目已于 2026-08-11 删除；对应源码门禁和构建产物检查不再保留。UniApp 使用 UnoCSS 与 Wot UI，不继承已删除项目的 Taro/Tailwind 规则。

## 1. 样式原则

- Tailwind CSS v4 入口固定为 `apps/admin/src/index.css`，由 `@tailwindcss/vite` 构建。
- 页面和组件优先直接使用 Tailwind 工具类；只有 Tailwind 无法合理表达时才使用独立 SCSS。
- 页面采用自适应容器、Flex/Grid、百分比和明确的 `px` 设计 token。
- 默认字号为 `14px`，不得依赖根字号换算布局。
- Tailwind 主题入口必须是普通 CSS；不得把 `@theme`、`@tailwind` 或 `@apply` 写入 SCSS。
- 不使用 SCSS 重新包装可直接使用的 Tailwind 工具类。

## 2. CSS 与 SCSS 边界

- `@theme` 中的间距、断点、容器、字号和圆角使用明确的 `px` token。
- 独立 SCSS 仅用于第三方组件深层覆盖、复杂伪元素、关键帧动画，或必须依赖 Sass 且原生 CSS 无法合理替代的场景。
- Admin SCSS 不得包含 `@theme`、`@tailwind` 或 `@apply`。

## 3. 校验命令

```bash
pnpm lint:styles
pnpm --filter @petcare/admin lint:styles
pnpm --filter @petcare/admin build
```

~~旧 Taro 校验命令：`pnpm --filter @petcare/miniapp lint:styles`、`pnpm --filter @petcare/miniapp build:weapp`。~~

## 4. 评审清单

- 新增尺寸是否使用已批准的语义 token？
- 可由 Tailwind 表达的样式是否仍直接写在组件中？
- 新增 SCSS 是否确有必要并写明原因？
- `pnpm lint:styles` 与 Admin 构建是否通过？
