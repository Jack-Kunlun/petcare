# 双端样式开发规范

本文约束 `apps/admin` 与 `apps/miniapp` 的样式实现、构建和校验方式。新增或修改界面时必须遵守本规范。

## 1. 共同原则

- Admin 与 Miniapp 均使用 Tailwind CSS v4 的 CSS-first 配置。
- 优先在组件中直接使用 Tailwind 工具类；Tailwind 无法合理表达时才考虑独立 SCSS。
- 页面采用自适应容器、Flex/Grid、百分比和明确的 `px` 设计 token。
- 两端默认字号均为 `14px`，不得依赖根字号换算布局。
- Tailwind 主题入口必须是普通 CSS；不得把 `@theme`、Tailwind `@import`、`@tailwind` 或 `@apply` 写入 SCSS。
- 不使用 SCSS 重新包装可直接使用的 Tailwind 工具类。

## 2. Miniapp

### 2.1 构建与主题入口

- 唯一 Tailwind 入口是 `apps/miniapp/src/app.css`。
- `app.css` 使用 `@theme` 管理颜色、间距、字号、圆角和阴影 token，并只导入 Tailwind theme 与 utilities，不导入 Preflight。
- `apps/miniapp/config/index.ts` 必须以绝对路径配置 `cssEntries`。
- `weapp-tailwindcss` 的 `rem2rpx`、`px2rpx`、`cssPreflight` 以及 Taro 的 `pxtransform` 必须保持关闭。
- 最终 WXSS 只允许 `px`，不得生成 `rem` 或 `rpx`。

自定义尺寸必须先声明语义 token，再使用稳定类名：

```css
@theme {
  --spacing-mm: 20px;
  --spacing-action: 240px;
}
```

```tsx
<View className="h-mm w-action" />
```

允许 `h-mm`、`w-action`；禁止以下写法：

- 任意值：`h-[20px]`
- 分数：`h-1/2`
- 值编码类名：`h-20px`
- 透明度简写：`bg-brand/50`
- `important`：`!w-full`
- 未批准变体：`hover:bg-brand`
- 动态片段：`` `text-${tone}` ``

条件样式必须在完整、静态可扫描的类名字符串之间切换。

### 2.2 CSS 与 SCSS 边界

- `app.css` 只承载 Tailwind v4 主题、utilities 和无法挂载类名的 `page` 全局平台样式。
- 页面不得新增 `.css` 或 `.scss` 文件；页面样式直接使用 Tailwind 工具类。
- 当前 Miniapp 不保留 SCSS。确有 Tailwind 和原生 CSS 都无法合理表达的需求时，应先更新样式策略门禁并经过评审，再新增独立 SCSS。
- 获准的 SCSS 必须写明保留原因，且不得包含 Tailwind 指令或 `@apply`。

### 2.3 Miniapp 品牌 Token 基线（v45）

Miniapp 页面必须将 `@theme` 中的语义 token 映射到 `docs/10-brand-system/PetCare-Brand-Book-v1.0.md` 和 `docs/01-requirements/04-prototype-specification.md` 的当前基准，不得继续使用旧的绿色主按钮或橙色主导航方案：

| 语义              | 当前基准  | 主要用途                         |
| ----------------- | --------- | -------------------------------- |
| `brand-primary`   | `#4A6CF7` | 主按钮、主链接、选中 Tab、焦点态 |
| `brand-secondary` | `#5BC8AF` | 陪伴、完成、成长、进度           |
| `brand-accent`    | `#F6B343` | 价格、悬赏、有限度强调           |
| `surface`         | `#F8FAFC` | 页面背景                         |
| `surface-card`    | `#FFFFFF` | 卡片和浮层                       |
| `ink`             | `#1F2937` | 主文字                           |
| `muted`           | `#667085` | 次要文字                         |
| `border`          | `#E6EAF0` | 分隔线和控件边框                 |

批准 Logo 内部的 `#5BC9B9` 只用于 Logo artwork；不得将 Logo 专用色直接当作通用 UI token。生产导航图标使用统一 SVG 图标，不使用 Emoji。

## 3. Admin

- Tailwind v4 入口固定为 `apps/admin/src/index.css`，由 `@tailwindcss/vite` 构建。
- `@theme` 中的间距、断点、容器、字号和圆角使用明确的 `px` token。
- 页面与组件优先直接使用 Tailwind 官方响应式工具类；任意值应尽量提炼为可复用 token。
- 独立 SCSS 仅用于第三方组件深层覆盖、复杂伪元素、关键帧动画，或必须依赖 Sass 且原生 CSS 无法合理替代的场景。
- Admin SCSS 不得包含 `@theme`、`@tailwind` 或 `@apply`。

## 4. 校验命令

```bash
# 检查双端源码、主题 token、类名和样式文件边界
pnpm lint:styles

# 分端检查
pnpm --filter @petcare/miniapp lint:styles
pnpm --filter @petcare/admin lint:styles

# 构建并检查最终 WXSS/CSS
pnpm --filter @petcare/miniapp build:weapp
pnpm --filter @petcare/admin build

# 项目完整质量门禁
pnpm check
```

Miniapp 产物检查同时阻止未转换的 Tailwind 转义、通配选择器、`NaN` 和运行时代码中的 `process`。Admin 产物检查阻止 `rem/rpx`，并确认默认字号为 `14px`。

## 5. Miniapp 热更新排查

使用根目录 `pnpm dev:miniapp` 或 Miniapp 内的 `pnpm dev:weapp` 启动 Taro watch。若源码已重新编译但微信开发者工具样式没有刷新：

1. 确认 Taro watch 进程仍在运行，终端出现重新编译记录。
2. 在微信开发者工具中关闭“代码自动热重载”。
3. 重新编译项目；必要时清理工具缓存后再打开 `apps/miniapp/dist`。

不要用额外的 Tailwind watch、PostCSS 配置或第二套样式入口规避刷新问题。

## 6. 评审清单

- 新增尺寸是否使用已批准的语义 token？
- Miniapp 类名是否完整、静态且不含禁用语法？
- 可由 Tailwind 表达的样式是否仍直接写在组件中？
- 新增 SCSS 是否确有必要并写明原因？
- `pnpm lint:styles` 与对应端构建是否通过？
