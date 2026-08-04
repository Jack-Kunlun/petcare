# PetCare 后台视觉与交互优化设计

## 1. 背景与目标

当前 Admin 已具备完整的业务页面和权限路由，但页面视觉仍主要依赖基础 Tailwind 工具类，登录方式切换、验证码发送、按钮悬浮和页面状态反馈缺少连续性与可操作提示。本次优化覆盖全部后台页面，目标是：

- 使用已批准的 PetCare 品牌资产和品牌色，形成稳定、可复用的后台视觉语言。
- 让登录、查询、保存、发送验证码、展开菜单和页面切换等操作具有明确的状态反馈。
- 在不改变权限、路由、API 契约和页面信息架构的前提下，提升可感知性能和操作信心。
- 保持 Tailwind v4 CSS-first 规范；仅将全局 Token、动画关键帧和 Tailwind 无法表达的规则放入 `index.css`。
- 满足键盘访问、焦点可见、对比度和 `prefers-reduced-motion` 要求。

## 2. 设计原则

### 2.1 品牌资产

使用 `docs/10-brand-system/deliverables/` 中的批准资产，不重新绘制或改色：

- 深色背景使用 `logo/svg/petcare-symbol-reverse.svg`。
- 浅色背景使用 `logo/svg/petcare-symbol-color.svg`。
- 登录页等垂直空间充足的区域使用 `logo/svg/petcare-logo-stacked-reverse.svg` 或彩色版本。
- Logo 周围保留品牌手册规定的安全区，不加入额外徽章、描边或渐变。

### 2.2 颜色与层级

Admin 统一使用品牌语义 Token：

| 语义                   | 值        | 用途                           |
| ---------------------- | --------- | ------------------------------ |
| `brand-primary`        | `#4A6CF7` | 主按钮、选中项、链接、焦点环   |
| `brand-primary-hover`  | `#3F5FE0` | hover 状态                     |
| `brand-primary-active` | `#3552C8` | active/按下状态                |
| `care-secondary`       | `#5BC8AF` | 辅助强调、成功状态和品牌陪伴感 |
| `accent`               | `#F6B343` | 少量提示和温度强调             |
| `surface`              | `#FFFFFF` | 卡片和控件表面                 |
| `page-background`      | `#F8FAFC` | 后台页面背景                   |
| `text-primary`         | `#1F2937` | 标题和主要内容                 |
| `text-secondary`       | `#667085` | 辅助说明                       |
| `border`               | `#E6EAF0` | 分隔线和控件边框               |

状态颜色继续使用语义文字配合颜色，不依赖颜色单独传达状态。

### 2.3 交互反馈

- 可点击元素必须有 `cursor-pointer`、hover、active、focus-visible 和 disabled 状态。
- 普通过渡使用 150–220ms；页面/卡片进入使用 220–360ms；不使用无限循环的装饰动画。
- 不对密集表格做夸张缩放或 overshoot，避免影响扫描效率。
- 所有动画在 `prefers-reduced-motion: reduce` 下自动降级为即时变化。
- 触控和移动端可点击区域保持至少 44×44px。

## 3. 组件与页面改造

### 3.1 全局品牌基础层

在 `apps/admin/src/index.css` 增加品牌 Token、统一阴影、控件过渡曲线、焦点环和有限的关键帧。页面组件优先通过 Tailwind 语义类消费 Token，禁止在业务页面散落品牌十六进制值。

新增 Admin 公共品牌资产目录：

```text
apps/admin/public/brand/
├── petcare-symbol-color.svg
├── petcare-symbol-reverse.svg
├── petcare-logo-stacked-color.svg
└── petcare-logo-stacked-reverse.svg
```

### 3.2 登录页

- 使用品牌 Logo、深色品牌背景和浅色表单表面构成明确的品牌入口。
- 密码登录/验证码登录使用双 Tab 滑块：滑块在两个选项之间平移，Tab 保留 `role="tab"`、`aria-selected` 和键盘操作。
- 登录表单区域使用固定的最小内容高度，切换时执行 opacity + translate 动画，避免布局跳动。
- 手机号、账号、密码、验证码输入框统一焦点环、错误边框和辅助说明。
- 图形验证码区域包含加载骨架、失败重试和“点击刷新”可见提示；图片按钮有 hover/active 状态。
- 发送验证码按钮显示默认、发送中、倒计时和失败后的可重试状态；倒计时保留文字，不单靠颜色区分。
- 登录提交按钮提供 pending 状态，禁止重复提交并保持按钮尺寸稳定。

### 3.3 Layout、Header 和 Sidebar

- Sidebar 使用反白 Symbol 与品牌名称，品牌区、工作区和系统状态区层级更清晰。
- 菜单 hover、父级展开、子菜单选中和移动端抽屉分别提供轻量颜色/透明度/高度过渡，不改变权限过滤结果。
- Header 的通知、用户信息和退出按钮统一可操作状态；移动端菜单按钮保持 44px 触控尺寸。
- Layout 主内容保持 `h-screen` + 内容区独立滚动；页面进入时只对主内容容器做一次淡入和轻微位移。

### 3.4 业务页面

以下页面全部继承相同的页面标题、筛选区、卡片、表格和分页交互规则：

- Dashboard
- 用户管理及认证审核
- 订单管理及投诉与纠纷
- 内容管理、悬赏、帖子、课堂文章
- 权限管理
- 系统设置

统一处理：

- 首次查询和重新查询使用轻量 skeleton；保留上一页数据时不闪烁整个页面。
- 空状态、错误状态和保存/发布状态提供明确文字、图标和下一步操作。
- 表格行 hover 仅改变背景和边框，不移动列内容。
- 筛选器、分页和弹窗按钮补齐 hover/active/focus/disabled 状态。
- 保存、发布、发送等异步操作期间锁定重复提交，并显示进行中反馈。

## 4. 技术边界与数据流

- 不改变现有 React Router、AuthProvider、权限 Gate、API 和共享类型。
- 不通过前端动画隐藏权限错误；权限路由和服务端鉴权保持现状。
- 不引入 Framer Motion、GSAP 等新运行时依赖；动效由 Tailwind 类和少量全局 CSS 关键帧实现。
- Logo 通过静态 `public/brand` 路径引用，避免页面运行时访问文档目录。
- 动画状态只依赖页面已有的 loading、error、pending、expanded 和 active 状态，不新增业务状态。

## 5. 测试与验收

### 自动化测试

- 登录页测试覆盖 Tab 滑块状态、密码/SMS 表单切换、验证码刷新、发送中/倒计时/失败重试和 pending 禁用。
- Sidebar/Header/Layout 测试覆盖品牌元素、菜单展开状态和交互类名，不改变权限可见性断言。
- 各业务页面至少保留加载、空数据、错误和成功列表状态测试。
- Admin TypeScript、Vitest、ESLint、生产构建和样式策略检查全部通过。

### 手工验收

- 375px、768px、1024px、1440px 宽度下无横向溢出，内容区独立滚动。
- 键盘可完成登录方式切换、验证码刷新、发送验证码和提交登录。
- Chrome/Edge 下 hover 与 active 状态明确，鼠标指针不会保持默认箭头于可点击控件。
- 开启系统减少动态效果后，页面仍可完成全部操作且无明显布局跳动。
- Logo 使用正确版本、比例和安全区，不出现拉伸、变色或额外容器。

## 6. 非目标

- 不重做业务页面的信息架构和字段布局。
- 不修改服务端接口、权限目录、数据库或登录业务规则。
- 不为本次视觉优化增加新的品牌图稿或第三方动画库。
