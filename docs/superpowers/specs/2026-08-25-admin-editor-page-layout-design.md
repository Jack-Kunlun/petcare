# Admin 编辑与配置页面统一布局设计

## 目标

统一 PetCare Admin 现有长表单、配置、审核和可恢复详情页的页面骨架，不改变 API、权限、字段、数据模型、保存、发布、恢复或审核语义。

- 稳定结构：Admin Shell → 编辑页 Header → 内容 → 可选底部重复操作。
- 标题、返回、状态、说明和主要操作在长页面顶部持续可达。
- 容器宽度、间距、控件高度和 section 外观统一。
- 未保存内容保护覆盖页内链接、侧栏、浏览器后退、刷新和关闭。
- 指定桌面分辨率及窄屏下没有遮挡、横向溢出或操作不可达。

## 已验证现状

- 全局 Header 位于正常文档流，高 64px；Sidebar 在桌面端占据正常布局宽度 256px。
- Layout 的 main 是唯一业务页滚动容器，编辑页 sticky Header 应相对 main 使用 top-0。
- 业务页不得增加 padding-top、margin-left 等 Shell 补偿。
- PageTransition 保留的 transform 会让内部 fixed Dialog 产生错误包含块，应从共享动画根因移除。
- 当前 BrowserRouter 模式不支持 React Router 7 的 useBlocker；完整路由保护需要迁移为 createBrowserRouter 与 RouterProvider。

## 范围

### 本次迁移

| 页面             | 宽度             | 形态                         |
| ---------------- | ---------------- | ---------------------------- |
| 文章新建/编辑    | default / 1200px | 表单编辑                     |
| 官网内容编辑     | default / 1200px | 结构化编辑、保存、预览、发布 |
| 系统设置编辑     | wide / 1440px    | 长配置、保存、发布           |
| RBAC 新建/编辑   | default / 1200px | 权限配置                     |
| RBAC 详情        | default / 1200px | 详情与关联管理员配置         |
| 服务者认证详情   | default / 1200px | 审核                         |
| 投诉详情         | wide / 1440px    | 详情与处置工作台             |
| 官网历史详情     | narrow / 960px   | 只读快照与恢复               |
| 系统设置历史详情 | narrow / 960px   | 只读快照与恢复               |

### 本次不迁移

- 用户、订单、帖子、悬赏等纯列表页。
- 官网内容和系统设置概览页。
- 个人中心：资料和密码是两个独立保存流程，不能伪装为一个页级提交。
- 当前不存在的用户编辑、订单编辑、帖子审核、悬赏审核路由。
- 业务 Dialog 全面重构、字段重组、权限策略和保存并发策略。

## 方案

采用三个小型共享入口：

- EditorPageLayout：Header、宽度、sticky、状态和可选 footer。
- FormSection：section 标题、说明、操作、圆角、边框和内边距。
- useUnsavedChanges：dirty、beforeunload 和路由 blocker；共享确认 Dialog 由布局渲染。

不采用路由元数据注册页头，避免页面 mutation 状态跨层同步。不只抽 CSS 类，因为它不能统一 DOM 和离开保护。

## Shell 与 Token

全局定义并由 Header、Sidebar、Layout 和 EditorPageLayout 消费：

    --admin-header-height: 4rem;
    --admin-sidebar-width: 16rem;
    --editor-width-narrow: 60rem;
    --editor-width-default: 75rem;
    --editor-width-wide: 90rem;

- main 增加 min-w-0，并阻止页面级横向溢出。
- PageTransition 只保留不会形成 containing block 的轻量 opacity 动画。
- Shell 继续统一提供响应式内容 padding。

## EditorPageLayout

稳定 DOM：

    section.editor-page
    ├── header.editor-page__header
    │   ├── 返回入口
    │   ├── 标题、说明、状态与未保存提示
    │   └── 页级操作
    ├── div.editor-page__content
    └── footer.editor-page__footer（可选）

- Header 在 main 内 sticky top-0；窄屏时标题和操作换行。
- 只展示页面已有动作，不发明新业务按钮。
- 长页面可在 footer 重复主要动作，历史和预览等辅助动作只放顶部。
- 操作间距 12px；普通编辑控件与页级按钮高 40px。
- 审核和移动端关键点击目标可保持至少 44px。
- disabled、pending、focus-visible、hover 和 cursor 状态一致。

## FormSection

- 圆角 12px、内边距 24px、section 间距 24px。
- 支持标题、说明和 section 级操作，不包含业务字段或提交逻辑。
- 只迁移页面最外层重复 Card；嵌套 CMS 区块和复杂编辑器保持原结构。

## 未保存保护

路由入口迁移为 createBrowserRouter 与 RouterProvider，保持 URL、权限 Gate、懒加载和 Layout 层级不变。

useUnsavedChanges 负责：

- dirty 时注册 beforeunload。
- dirty 时用 useBlocker 拦截应用内跳转和浏览器后退。
- 暴露 blocker 状态、reset 和 proceed。

页面仍决定何时变脏、何时保存成功并清理 dirty。共享层不读取表单数据，也不参与 mutation。

共享确认 Dialog 使用已安装的 Radix Dialog，提供“继续编辑”和“放弃修改”，并满足初始焦点、Escape、焦点圈和屏幕阅读器语义。

## 页面迁移规则

- 文章：共享 Header 替换手写 sticky，保留取消、保存和锁定逻辑。
- 官网：顶部返回、历史、预览、保存、发布；底部可重复保存和发布。
- 设置：顶部返回、历史、保存、发布；底部重复保存和发布。
- RBAC 编辑：顶部返回/取消和保存；权限树不变。
- RBAC 详情：顶部保留返回、编辑，并在有权限时提供关联管理员保存。
- 认证/投诉：顶部呈现当前允许的审核或处置动作，原确认 Dialog 与业务条件不变。
- 历史详情：顶部返回和恢复，快照保持只读。

## 响应式、验证与报告

- 验证 1920×1080、1920×1200、1600×900、1440×900、1366×768。
- 额外检查窄屏 Header 换行、移动 Sidebar、键盘焦点和减少动态效果。
- 自动化覆盖共享布局、Router/离开确认、代表性编辑页、审核页和历史恢复页。
- 运行 Admin ESLint、lint:styles、TypeScript、Vitest、生产构建、相关 Playwright 和 git diff --check。
- 最终报告列出已迁移、未迁移、删除的重复实现、新共享组件和未处理技术债。

## 验收标准

- 范围内页面使用共享骨架，不再自行实现页头宽度和 sticky 补偿。
- 顶部可看到当前页面已有核心动作。
- dirty 时侧栏、页内链接、浏览器后退、刷新和关闭均受保护。
- 五组目标分辨率没有遮挡、裁切或页面级横向滚动。
- API、权限、字段和业务状态流不变。
