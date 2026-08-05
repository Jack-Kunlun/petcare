# Admin 静态资源与登录背景优化设计

## 背景

Admin 当前将 20 个 Logo SVG、PNG 和兼容副本放在 `apps/admin/public/brand/`，并通过 `/brand/...` 绝对路径引用。此方式会绕过 Vite 的模块依赖图和内容哈希，无法自动清理未使用资源，也不利于长期缓存管理。`BrandLogo` 还会优先加载 4K PNG，使浏览器无法直接使用更小、更清晰的 SVG。

品牌权威资源已经集中在 `docs/10-brand-system/deliverables/`。本次优化需要让运行时资源来自该权威目录，仅在 Admin 中保留实际使用的副本，并为登录页增加完整的品牌软背景。

## 目标

- 将 Admin 业务静态资源迁移到 `apps/admin/src/assets/brand/`，通过 ES Module 或 Vite HTML 资源引用进入构建流程。
- Admin 只保存当前实际使用的品牌资源，不保留未引用的颜色变体、尺寸副本或 4K PNG。
- 使用品牌系统中的软渐变 SVG 作为登录页整体背景。
- 修复无效的 Vite favicon 引用，替换为 PetCare favicon。
- 让 SVG 支持生产环境 gzip，并让 Vite 哈希资源具备长期缓存能力。
- 保持现有登录流程、页面结构、动画、权限和路由行为不变。

## 非目标

- 不修改品牌源文件或重新设计 Logo。
- 不引入新的图片压缩依赖、资源清单生成器或 CDN。
- 不改变 Admin 其他业务页面的布局与配色。
- 不使用大尺寸宠物摄影作为登录页背景。

## 方案选择

采用 `src/assets` 直接导入方案。相比继续使用 `public` 并增加自定义压缩脚本，该方案可以直接获得 Vite 内容哈希、依赖追踪和未引用资源排除能力。相比生成资源清单，仅有五个运行时资源时直接导入更简单，也更容易维护。

## 资源清单与来源

| Admin 运行时资源                   | 品牌系统来源                                                  | 用途               |
| ---------------------------------- | ------------------------------------------------------------- | ------------------ |
| `petcare-symbol-reverse.svg`       | `deliverables/logo/svg/petcare-symbol-reverse.svg`            | 深色侧栏 Logo      |
| `petcare-logo-stacked-reverse.svg` | `deliverables/logo/svg/petcare-logo-stacked-reverse.svg`      | 登录卡片品牌 Logo  |
| `petcare-favicon.svg`              | `deliverables/logo/favicon/petcare-favicon.svg`               | 现代浏览器标签图标 |
| `petcare-favicon.ico`              | `deliverables/logo/favicon/petcare-favicon.ico`               | 浏览器图标兼容回退 |
| `petcare-background-soft.svg`      | `deliverables/elements/gradients/petcare-background-soft.svg` | 登录页整体背景     |

所有运行时副本放在 `apps/admin/src/assets/brand/`。`docs/10-brand-system/deliverables/` 继续作为权威源，Admin 目录仅保存被代码引用的交付副本。

## 组件设计

### BrandLogo

`BrandLogo` 直接导入两个 SVG URL，并只暴露 `reverse` 与 `stacked-reverse` 两个实际使用的变体。组件继续接收 `className` 和可访问名称，渲染单个 `<img>`，保留 `object-contain` 与同步解码行为。

删除 `<picture>` 和 4K PNG `source`。SVG 在当前显示尺寸下更清晰、体积更小，并可由 Vite 生成哈希文件名。

### 登录页背景

登录页导入 `petcare-background-soft.svg`，在页面根节点内使用一个 `aria-hidden` 的绝对定位图片覆盖整个视口，使用 `object-cover` 保持自适应。现有蓝色和薄荷色光晕继续叠加在背景之上，登录卡片继续使用不透明白色与深色品牌面板，保证表单可读性。

背景不承载语义信息，不提供替代文本，也不影响键盘焦点和指针事件。小屏幕与桌面端使用同一 SVG，通过裁切适应视口。

### Favicon

`apps/admin/index.html` 使用两条 favicon 声明：SVG 作为现代浏览器首选格式，ICO 作为兼容回退。两项都通过 Vite 可处理的 `/src/assets/brand/` 路径引用，构建时由 Vite 改写为最终资源路径。浏览器标签不再引用无效的 `/vite.svg`。

## 构建与缓存

- 删除 `apps/admin/public/brand/`，避免同一品牌资源出现两套来源。
- Vite 仅输出被模块或 HTML 引用的资源，并为非内联资源生成内容哈希。
- 小体积软背景可能被 Vite 内联为 data URL；该行为由默认资源阈值控制，无需增加配置。
- Nginx 的 `gzip_types` 增加 `image/svg+xml`。
- `/assets/` 使用一年有效期和 `immutable` 缓存头，因为 Vite 文件名包含内容哈希。
- SPA HTML 继续通过现有回退规则提供，不设置 immutable，避免入口文件缓存旧资源引用。

## 异常与回退

- 若资源导入路径错误，TypeScript/Vite 构建必须失败，禁止静默回退到 `public` 路径。
- 若 SVG 加载失败，Logo 的可访问名称仍存在，但不提供重复 PNG 兜底；构建校验负责阻止缺失资源进入交付物。
- 登录背景加载失败时，页面根节点保留现有浅色渐变背景色，表单仍可正常使用。

## 测试与验收

- 更新 `BrandLogo` 单元测试，验证两个变体使用导入后的 SVG URL、可访问名称、样式转发和同步解码。
- 更新侧栏测试，验证反白 Symbol 仍正确渲染。
- 更新登录页测试，验证品牌软背景存在、被标记为装饰内容且不拦截交互。
- 运行 Admin 单元测试、ESLint、样式策略检查和生产构建。
- 检查 `dist`：不存在 `/brand/` 旧目录和 4K PNG，只包含实际引用的品牌资源；HTML 中 SVG 与 ICO favicon 的资源路径均有效。
- 检查 Nginx 配置语法，并确认 SVG gzip 与哈希资源缓存规则存在。
- 运行 `git diff --check`，确保无空白错误。

## 验收标准

1. `apps/admin/public/brand/` 被删除，`apps/admin/src/assets/brand/` 仅包含五个已使用资源。
2. 登录页在所有视口都有品牌软背景，登录卡片和表单文字保持清晰。
3. 侧栏与登录页 Logo 使用品牌交付目录中的 SVG，不再请求 4K PNG。
4. Admin 生产构建通过，构建输出使用哈希资源且没有未引用品牌文件。
5. 浏览器标签使用正式 PetCare favicon，并保留 SVG 首选与 ICO 兼容回退。
6. 现有认证、导航和权限行为不发生变化。
