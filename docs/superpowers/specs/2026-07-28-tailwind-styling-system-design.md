# PetCare 双端 Tailwind 样式体系设计

**日期**：2026-07-28

**状态**：已确认，待实施

## 1. 背景

PetCare 的 Admin 已使用 Tailwind CSS v4，Miniapp 已安装 Tailwind CSS v3，但两端当前的使用方式尚未形成统一约束：

- Miniapp 页面仍大量依赖普通 CSS 语义类，没有真正采用 Tailwind 工具类；
- Miniapp 的 Taro `pxtransform` 仍会参与单位转换，无法保证最终 WXSS 保持 `px`；
- Miniapp 尚未接入 `weapp-tailwindcss`，Tailwind 类名中的特殊字符可能生成微信小程序无法识别的选择器；
- Tailwind 的任意值、分数、透明度简写和部分变体在微信小程序中存在兼容性风险；
- Admin 虽然已使用 Tailwind v4，但缺少明确的 px 设计 token 和 SCSS 使用边界；
- 当前没有自动化规则阻止不安全类名、任意值和普通页面 CSS 再次进入 Miniapp。

本设计在不改变现有页面功能和视觉语义的前提下，建立 Admin 与 Miniapp 共用的样式原则，并针对微信小程序编译环境增加更严格的约束。

## 2. 目标与非目标

### 2.1 目标

- Miniapp 固定使用 Tailwind CSS v3，并通过 `weapp-tailwindcss` 生成微信小程序可识别的类名和 WXSS；
- Admin 延续 Tailwind CSS v4 官方 CSS-first 配置方式；
- 两端均优先在模板中直接使用 Tailwind 工具类；
- 两端使用自适应布局与 px 设计 token，默认字体大小统一为 `14px`；
- Miniapp 关闭所有 px → rpx 和 rem → rpx 转换，确保最终 WXSS 保持 px；
- Miniapp 禁止任意值、分数类和其他未经验证的特殊语法，所有非标准值先配置别名再使用；
- 将现有 Miniapp 页面 CSS 迁移为 Tailwind 工具类；
- 只允许无法由 Tailwind 合理表达的样式进入 SCSS；
- 通过静态检查和构建产物检查防止约束回退。

### 2.2 非目标

- 不升级 Miniapp 到 Tailwind CSS v4；
- 不改变 Admin 或 Miniapp 的业务流程、交互行为和接口调用；
- 不进行新的视觉设计或组件库替换；
- 不为两端强行共享同一个 Tailwind 配置文件；
- 不恢复 rpx 布局，也不对 px 做设备宽度换算；
- 不使用 `@apply` 将普通 Tailwind 工具类重新包装成页面语义类。

## 3. 总体架构

两端共享样式原则，但保留独立构建链路：

| 维度          | Miniapp                                      | Admin                                          |
| ------------- | -------------------------------------------- | ---------------------------------------------- |
| Tailwind 版本 | v3                                           | v4                                             |
| 配置入口      | `tailwind.config.js`                         | CSS-first `@theme`                             |
| 构建集成      | PostCSS + `weapp-tailwindcss` Webpack 插件   | `@tailwindcss/vite`                            |
| 基础单位      | px                                           | px                                             |
| 默认字体      | 14px                                         | 14px                                           |
| 响应式方式    | flex、grid、百分比、全宽、最大宽度与受控变体 | Tailwind 官方响应式工具类                      |
| 自定义样式    | 仅全局选择器、第三方覆盖等必要 SCSS          | 仅全局选择器、第三方覆盖、复杂动画等必要 SCSS  |
| 任意值语法    | 禁止                                         | 按 Tailwind 官方最佳实践使用，但优先复用 token |

两端不共享配置实现的原因是 Tailwind v3 与 v4 的配置模型不同，且微信小程序需要额外的选择器转换和安全限制。共享原则通过项目文档、命名约定和自动化检查保证。

## 4. Miniapp 设计

### 4.1 构建链路

Miniapp 保持 Tailwind CSS v3，并新增 `weapp-tailwindcss` 的 Taro Webpack 5 集成：

1. Tailwind 根据 `src/**/*.{js,jsx,ts,tsx}` 扫描并生成 utilities；
2. PostCSS 处理 Tailwind CSS；
3. `UnifiedWebpackPluginV5` 使用 Taro 模式转换微信小程序不支持的选择器和转义类名；
4. Taro 输出最终 JS、WXML 和 WXSS；
5. 产物检查脚本验证单位、选择器和运行时代码。

插件配置必须满足：

- `appType: "taro"`；
- `rem2rpx: false`；
- Taro `mini.postcss.pxtransform.enable: false`；
- Tailwind `corePlugins.preflight: false`；
- 只引入 Tailwind utilities，不引入会生成通用元素重置的 preflight；
- 依赖版本使用安装时策略允许的最近稳定版本，并与项目 Node 22 版本约束匹配。

如果 `weapp-tailwindcss` 当前稳定版本提高了 Node 22 的最低小版本要求，应同步收紧根目录 `engines.node`、文档和 CI Node 版本，避免“声明可安装但实际无法运行”。

### 4.2 px 与响应式规则

Miniapp 的源样式和最终 WXSS 均保持 px：

- 禁用 Taro 的 px → rpx 转换；
- 禁用 `weapp-tailwindcss` 的 rem → rpx 转换；
- Tailwind theme 中使用显式 px token；
- 不在 Miniapp 业务代码中使用 `rem` 或 `rpx`；
- 默认字体大小通过全局 `page` 样式和 `text-base` token 均固定为 `14px`。

“自适应 + px”表示容器关系使用 `flex`、`grid`、`w-full`、百分比、`max-width` 等自适应能力，而间距、字号、圆角、固定控件高度使用 px token。它不表示根据设计稿自动缩放 px。

### 4.3 Token 与命名

所有非 Tailwind 标准值必须先写入 `tailwind.config.js`，再通过稳定别名使用。配置范围至少包括：

- `spacing`；
- `fontSize` 与对应行高；
- `borderRadius`；
- `width`、`minWidth`、`maxWidth`；
- `height`、`minHeight`、`maxHeight`；
- `colors`；
- `boxShadow`；
- 经验证可用的断点和变体。

别名按以下优先级命名：

1. 能表达用途时使用语义别名，例如 `control`、`captcha`、`card`；
2. 无稳定业务语义时使用中性别名，例如 `mm`；
3. 禁止把数值编码进别名。

示例：

```js
theme: {
  extend: {
    height: {
      control: "44px",
      mm: "20px",
    },
  },
}
```

允许：

```tsx
<View className="h-control" />
<View className="h-mm" />
```

禁止：

```tsx
<View className="h-[44px]" />
<View className="h-1/2" />
<View className="h-20px" />
```

`h-20px` 即使能够通过配置实现也不允许，因为它把实现值固化进调用点，导致设计 token 无法独立演进。

### 4.4 Miniapp 类名安全规则

Miniapp 默认禁止以下 Tailwind 语法：

- 任意值和任意属性：`[...]`；
- CSS 变量简写：`(...)`；
- 分数、透明度简写及其他包含 `/` 的类名；
- important 修饰：`!`；
- 任意断点、容器查询和任意变体；
- 未列入 Miniapp 变体白名单的 `:` 变体；
- 将具体数值编码进自定义类名的别名；
- 动态拼接无法被 Tailwind 静态扫描的类名。

业务代码使用完整、静态可扫描的类名字符串。条件样式可以在完整类名之间切换，不得拼接类名片段。

变体采用默认拒绝策略：只有在 `weapp-tailwindcss` 转换后经过真机或开发者工具验证，并加入项目白名单的变体才可使用。初始白名单只保留本次现有页面确实需要且能够稳定编译的变体。

### 4.5 SCSS 边界

Miniapp 将 `app.css` 改为 `app.scss`，它是全局样式和 Tailwind utilities 的唯一入口。允许保留的内容包括：

- `@tailwind utilities`；
- 无法挂载 Tailwind 类名的 `page` 全局选择器；
- Taro 或第三方组件内部结构的必要覆盖；
- Tailwind 无法可靠表达的微信小程序平台样式。

普通页面不得新增 `.css` 或 `.scss` 文件。现有 `pages/index/index.css` 与 `pages/auth/index.css` 的规则全部迁移到 TSX 的 Tailwind 类名后删除。

不得在 SCSS 中使用 `@apply` 包装可直接写在组件上的工具类。确需保留的 SCSS 必须附有简短注释，说明无法使用 Tailwind 的平台或选择器原因。

### 4.6 现有页面迁移

本次迁移覆盖 Miniapp 当前所有页面：

- 首页容器、标题、说明、会话提示、按钮、用户卡片和欢迎信息；
- 认证页容器、卡片、标题、说明、主按钮和错误提示；
- 全局页面背景、字体栈和默认字号。

迁移遵循视觉等价原则：保留当前颜色、间距、字号、圆角、阴影和布局关系。重复值先提炼为 token，再替换语义 CSS 类。页面不再导入自身样式文件。

## 5. Admin 设计

### 5.1 Tailwind v4 CSS-first 配置

Admin 保持现有 Tailwind CSS v4 和 `@tailwindcss/vite`，不新增传统 `tailwind.config.js`。设计 token 继续集中在 `src/index.css` 的 `@theme` 中：

- 基础 spacing 使用 px；
- `text-base` 固定为 `14px` 并定义对应行高；
- 常用字号、圆角、容器宽度、断点和阴影使用 px；
- 颜色继续通过 CSS 变量与主题 token 管理；
- `html` 和 `body` 的默认字号保持 `14px`。

页面和组件继续直接使用 Tailwind 工具类。现有 Admin 代码已经以工具类为主，本次重点是补齐 px token、审计不一致值和固化规则，不为了形式而重写稳定代码。

### 5.2 Admin 的 SCSS 边界

Tailwind v4 的入口继续使用普通 CSS，因为 Tailwind v4 不以 Sass 预处理作为推荐集成方式。以下场景才允许新增独立 SCSS：

- 无法挂载类名的全局元素或伪元素；
- 第三方组件内部选择器覆盖；
- Tailwind 工具类不适合表达的复杂关键帧动画；
- 必须依赖 Sass 能力且无法用 CSS 原生能力合理替代的样式。

SCSS 文件不得包含 `@theme`、`@tailwind` 或 `@apply`。可直接由 Tailwind 表达的样式不得转移到 SCSS。

## 6. 自动化校验

新增仓库内样式规则检查，并接入 Miniapp、Admin 和根目录质量命令。

### 6.1 源码检查

Miniapp 检查至少覆盖：

- 禁止 `[]`、`()`、`/`、`!` 等不安全 Tailwind 类名语法；
- 禁止未授权的变体；
- 禁止动态拼接 Tailwind 类名片段；
- 禁止数值编码别名，例如 `h-20px`；
- 禁止页面级 CSS/SCSS 文件回归；
- 禁止 Miniapp 业务样式出现 `rem` 或 `rpx`；
- 校验实际使用的自定义别名能够在 Tailwind 配置中解析。

Admin 检查至少覆盖：

- Tailwind 入口继续使用 CSS；
- 新增 SCSS 不得包含 Tailwind 指令或 `@apply`；
- 页面和组件不得用 SCSS 重复包装可直接使用的 Tailwind 工具类；
- 默认字号和核心 token 使用 px。

检查脚本应使用项目已有 Node.js 能力实现，不为简单文本与语法校验引入额外运行时依赖。

### 6.2 Miniapp 产物检查

微信小程序构建完成后扫描输出：

- WXSS 不包含 `rem` 或 `rpx`；
- WXSS 不包含会导致编译失败的通用 `*` 选择器；
- WXSS 不包含未被转换的非法转义选择器；
- 产物不包含 `NaN`；
- 运行时代码不包含浏览器环境不可用的 `process` 引用；
- 页面需要的 Tailwind 工具类确实生成到 WXSS 中。

该检查用于防止配置看似正确但最终微信产物仍不可运行。

## 7. 测试与验证

实施采用测试先行方式：

1. 先为样式规则检查器编写失败用例，覆盖允许和拒绝的类名；
2. 再实现最小检查逻辑使测试通过；
3. 为 Miniapp 编译配置补充配置级测试；
4. 完成页面迁移；
5. 运行 Miniapp 单元测试、类型检查、Lint 和微信构建；
6. 扫描最终 WXSS 与 JS；
7. 运行 Admin 单元测试、类型检查、Lint 和构建；
8. 运行根目录格式、质量和差异检查。

关键回归样例至少包括：

- `h-mm` 通过；
- `h-[20px]`、`h-1/2`、`h-20px` 被拒绝；
- 完整条件类名可以通过，动态拼接片段被拒绝；
- Miniapp 最终 WXSS 保留 `14px`；
- Miniapp 最终 WXSS 不出现 `14rpx`、`0.875rem` 或通用 `*` 选择器；
- Admin 仍能通过 Tailwind v4 Vite 构建。

## 8. 文档与维护

实施时同步更新：

- 根目录开发规范与常用命令；
- Miniapp 的 Tailwind、安全类名和 SCSS 约定；
- Admin 的 Tailwind v4、px token 和 SCSS 约定；
- Miniapp 构建与微信开发者工具使用说明；
- 依赖版本和 Node 最低版本要求；
- 新增样式 token、白名单变体和必要 SCSS 的评审规则。

新增 token 时应优先复用现有语义。只有重复出现或具有稳定设计含义的值才进入公共 token，避免将每个临时数值都配置成永久 API。

## 9. 风险与处理

### 9.1 微信选择器兼容性

风险：Tailwind 类名生成的特殊字符无法被微信 WXSS 解析。

处理：由 `weapp-tailwindcss` 统一转换，并通过产物扫描与开发者工具验证。

### 9.2 单位被二次转换

风险：Taro 与 `weapp-tailwindcss` 同时转换单位，导致最终值变成 rpx。

处理：显式关闭 `pxtransform` 和 `rem2rpx`，同时禁止源代码使用 rem/rpx。

### 9.3 JIT 未扫描到类名

风险：动态拼接或错误 content 范围导致工具类未生成。

处理：只允许静态完整类名，保持 `src` 全量扫描，并在构建产物中断言关键工具类。

### 9.4 Token 过度增长

风险：为每个页面数值创建一次性别名，使配置失去可维护性。

处理：优先语义 token；临时值只有确实无法复用且设计必要时才使用中性别名，并通过审查控制。

### 9.5 Tailwind v4 与 Sass 冲突

风险：将 Admin 的 Tailwind v4 入口改为 SCSS，破坏官方构建模型。

处理：保持 Tailwind 入口为 CSS；SCSS 独立存在且不处理 Tailwind 指令。

## 10. 验收标准

实施完成后必须满足：

1. Miniapp 使用 Tailwind CSS v3 与 `weapp-tailwindcss`，微信构建成功；
2. Miniapp 的 Taro `pxtransform` 和插件 `rem2rpx` 均关闭；
3. Miniapp 最终 WXSS 中默认字号为 `14px`，且不存在 `rem` 或 `rpx`；
4. Miniapp 不存在 `h-[20px]`、`h-1/2`、`h-20px` 等禁止类名；
5. 所有非标准 Miniapp 值均通过 `tailwind.config.js` 别名使用；
6. Miniapp 当前页面的普通 CSS 已迁移为 Tailwind 工具类；
7. Miniapp 仅保留必要的全局 `app.scss`，无页面级样式文件；
8. Admin 保持 Tailwind v4 CSS-first 构建，默认字号为 `14px`，核心设计 token 使用 px；
9. 两端新增 SCSS 均符合“Tailwind 无法实现时才使用”的边界；
10. 样式源码检查和 Miniapp 产物检查能够阻止规则回退；
11. Miniapp 与 Admin 的格式、Lint、类型检查、单元测试和构建全部通过；
12. 项目文档完整记录 Tailwind、px、类名、SCSS 和构建约束；
13. `git diff --check` 通过，构建与测试不遗留未跟踪产物。
