# PetCare Settings & Support Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `06 · Settings & Support` 内完成七张页面的统一视觉精修、长文阅读优化、画布整理与可实现原型修复。

**Architecture:** 保留七张业务 Frame 和现有 Design System，通过页面级 Auto Layout 同步重建 About、Legal、Help 的内部布局。两张 Legal 使用同一构造逻辑确保结构同构，但不创建公共组件 Master；所有设计说明迁移到 Section 右侧 Annotation。

**Tech Stack:** Figma Design、Figma Plugin API、PetCare Variables/Text Styles/Components、375px 微信小程序设计基准。

## Global Constraints

- Figma fileKey 固定为 `mwpHHcx0VAutpPTIhGYGqC`。
- 目标保持 `70 · Profile & Pets → 06 · Settings & Support`，不得新增 Figma Page 或业务 Frame。
- 七张 Frame 名称和 375×812 尺寸保持不变。
- 使用 Noto Sans SC、4px Grid、偶数尺寸、16px 页面 Padding；不使用暖色 Surface 或 Shadow。
- 不修改 PetCare Design System，不新增公共 Component Master，不 detach 现有实例。
- Legal 用户界面不显示设计占位说明；法务内容仍是版式示例，不可视为正式条款。

---

### Task 1: 建立精修基线与画布布局

**Files:**

- Reference: `docs/superpowers/specs/2026-08-13-petcare-settings-support-refinement-design.md`
- Target: Figma Section `629:247`

**Interfaces:**

- Consumes: 当前七张 Frame、Prototype Note、现有 Token 与组件实例。
- Produces: 正式稿 160px 横向间距、状态稿 240px 纵向间距和独立右侧 Annotation 区。

- [ ] 回读七张 Frame、注释、变量、字体、组件和 reaction，保存精修前结构指标。
- [ ] 扩展 Section 边界，重新排列正式稿与状态稿，不改变 Frame 名称和尺寸。
- [ ] 将旧 Prototype Note 替换为统一 `Design Notes / Legal & Prototype` 说明块，并放在右侧固定区域。
- [ ] 回读 Section 直接子节点，确认无覆盖、无状态稿/注释混排。

### Task 2: 精修 About / Default

**Files:**

- Reference: `docs/superpowers/specs/2026-08-13-petcare-settings-support-refinement-design.md`
- Target Frame: `629:249`

**Interfaces:**

- Consumes: `Brand/Symbol` Color、Back、Chevron 与语义 Token。
- Produces: 开放式品牌区、轻量 Values、统一 CellGroup、弱化版本信息。

- [ ] 重建 Brand Identity 为 Symbol、PetCare、宠伴、品牌主张的开放式 Auto Layout。
- [ ] 将品牌介绍拆成两个自然段并保持 14px Body。
- [ ] 将 Brand Values 改为无强边框的 Very Light Neutral 2×2 说明块。
- [ ] 重建 Support Links Divider 与底部 Version/Copyright 文本流，保持现有原型目标。
- [ ] 执行 Logo 比例、Padding、Card/Border、实例与截图检查。

### Task 3: 同步精修 Legal 正式页面

**Files:**

- Reference: `docs/superpowers/specs/2026-08-13-petcare-settings-support-refinement-design.md`
- Target Frames: `629:250`、`629:251`

**Interfaces:**

- Consumes: Back、颜色/文本 Token、两组现有章节名称。
- Produces: 两张同构的开放式 Legal 长文滚动页。

- [ ] 使用单一页面构造函数同步重建两张 Legal 正式页。
- [ ] 删除重复 Document Title 和 Viewport 内所有 Placeholder/Design Note。
- [ ] 建立 Meta、H1、Paragraph 和编号/内容双列 List Auto Layout，正文16px。
- [ ] 保留现有章节含义，仅替换版式示例正文，不生成正式法律条款。
- [ ] 回读两页结构、章节样式、列表缩进、滚动高度与内部边界，确认同构。
- [ ] 截取首屏和完整长图进行目检。

### Task 4: 精修 Legal Loading

**Files:**

- Reference: `docs/superpowers/specs/2026-08-13-petcare-settings-support-refinement-design.md`
- Target Frame: `629:253`

**Interfaces:**

- Consumes: Legal 正式页 Meta/Section 节奏。
- Produces: 与真实文档结构相匹配的纯 Skeleton Loading。

- [ ] 重排 Meta Skeleton、Heading Skeleton、不同长度 Paragraph Lines 和 Section Gap。
- [ ] 检查 Loading 中不存在真实正文、Spinner 或 Placeholder 文案。
- [ ] 截图核对 Skeleton 节奏与正式 Legal 页面一致。

### Task 5: 精修 Help 三种状态

**Files:**

- Reference: `docs/superpowers/specs/2026-08-13-petcare-settings-support-refinement-design.md`
- Target Frames: `629:252`、`629:254`、`629:255`

**Interfaces:**

- Consumes: Input/Search、Back、Chevron、Search/Heart/Brand 图标与语义 Token。
- Produces: 统一 Help Default、FAQ Expanded、Search Empty。

- [ ] 统一 Search、Section Title、FAQ、分类与 Support Cell 的间距和 Cell 高度。
- [ ] 将 Expanded Chevron 旋转为展开方向，并增加 Answer 顶部/底部呼吸。
- [ ] 重建 Search Empty 为 72–80px Search + Pet 图形、40px Hug Soft Button 和 Text Action。
- [ ] 回读 Search 对齐、FAQ/分类 Group、展开高度、动作热区和滚动内容。
- [ ] 截取三个 Help 状态并目检。

### Task 6: 修复 Prototype 与完成终验

**Files:**

- Reference: `docs/superpowers/specs/2026-08-13-petcare-settings-support-refinement-design.md`
- Target: Settings & Support、Profile 来源入口、Login 协议说明。

**Interfaces:**

- Consumes: 七张精修 Frame、现有 Profile/Login 节点。
- Produces: 有效 reaction、透明协议热区、最终结构与视觉证据。

- [ ] 复核并修复 Profile、About、Legal、Help 的有效同页导航路径。
- [ ] 在不改变 Login 视觉的情况下，为服务协议和隐私政策分别建立 44px 高透明点击热区并连接对应 Legal Frame。
- [ ] Contact 目标仍缺失时仅保留 Annotation，不链接到内部 Cell。
- [ ] 运行七页命名/尺寸、Auto Layout、Padding、字体、色彩、Shadow、实例、热区、溢出、Legal 占位文案与原型审计。
- [ ] 截取整个 Section、七张页面和高风险节点，完成最终目检后回报验证结果与剩余风险。
