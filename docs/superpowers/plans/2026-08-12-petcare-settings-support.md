# PetCare Settings & Support Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 PetCare Figma 文件的 `70 · Profile & Pets → 06 · Settings & Support` 中完成七张支持、品牌与法律阅读页面。

**Architecture:** 使用现有 Design System 变量、文本样式、Logo、Back、Search 与图标实例搭建页面级 Auto Layout。About、Help、Legal 各自共享内部页面模式，但本阶段不发布新的公共组件 Master；两张 Legal 页面由同一构造逻辑生成，避免视觉分叉。

**Tech Stack:** Figma Design、Figma Plugin API、PetCare 本地 Variables/Text Styles/Components、375px 微信小程序设计基准。

## Global Constraints

- Figma fileKey: `mwpHHcx0VAutpPTIhGYGqC`。
- 目标一级页面必须保持 `70 · Profile & Pets`，不得创建新 Figma Page。
- 新分区必须命名 `06 · Settings & Support`，不得移动或覆盖已有 `01`–`04` 分区。
- 七张 Frame 名称必须与规格完全一致。
- 所有标准视口宽 375px；短页高 812px；Legal 长文采用 Vertical Scroll 并保留完整长图内容结构。
- 4px Grid、偶数尺寸、Noto Sans SC、White/Neutral/Light Primary Blue Surface、无 Bottom TabBar。
- 不编造企业资料、正式日期、联系方式或可上线法律条款。
- 不新增公共 Component Master；只复用现有实例和页面级 Auto Layout。

---

### Task 1: 建立分区与设计系统映射

**Files:**

- Reference: `docs/superpowers/specs/2026-08-12-petcare-settings-support-design.md`
- Target: Figma `70 · Profile & Pets`

**Interfaces:**

- Consumes: 现有变量、文本样式、Logo/Back/Search/Chevron 等组件。
- Produces: `06 · Settings & Support` Section 及七张空白 375px Frame。

- [ ] 核对目标页面、现有分区边界、变量、字体与所需组件变体。
- [ ] 在已有内容下方建立 `06 · Settings & Support`，按四列、两行排列七张主 Frame，横向间距 80px，纵向间距 200px。
- [ ] 为七张 Frame 设置准确名称、375px 宽、Light Neutral 页面背景和 clipsContent。
- [ ] 回读节点 ID、尺寸、位置与分区直接子节点，确认没有覆盖现有分区。

### Task 2: 完成 About / Default

**Files:**

- Reference: `docs/superpowers/specs/2026-08-12-petcare-settings-support-design.md`
- Target Frame: `About / Default`

**Interfaces:**

- Consumes: `Brand/Logo Stacked`、`Icon/Back`、`Icon/Chevron Right`、颜色与文本 Token。
- Produces: 完整 About 页面和三个可导航的支持/协议入口。

- [ ] 建立 72px 二级 Navbar，复用 Back 实例，中间标题“关于我们”，右侧保留 44px 空白。
- [ ] 建立克制的品牌识别区、品牌介绍、2×2 Brand Values。
- [ ] 建立服务协议、隐私政策、帮助中心、联系我们四行轻量入口及版本/版权信息。
- [ ] 运行布局审计，核对 Logo 比例、52px Cell、16px Chevron、32px Bottom Safe Content 和无暖色 Surface。
- [ ] 截取 `About / Default` 单页图并目检。

### Task 3: 完成 Legal 两页与 Loading 状态

**Files:**

- Reference: `docs/superpowers/specs/2026-08-12-petcare-settings-support-design.md`
- Target Frames: `Legal / Privacy Policy`、`Legal / Service Agreement`、`Legal / Loading`

**Interfaces:**

- Consumes: Back 实例、文本/颜色变量、统一 Legal 页面级构造模式。
- Produces: 两张同构法律长文滚动页及一张文本骨架加载页。

- [ ] 为隐私政策建立固定 Navbar、375×740 Vertical Scroll Viewport 与完整文档内容 Frame。
- [ ] 填入标题、日期占位、法务确认提示、章节标题、正文、列表和链接示例；所有内容明确为版式占位。
- [ ] 克隆同一结构生成服务协议，仅替换标题、文档类型和章节示例，不修改布局规则。
- [ ] 建立 `Legal / Loading`：Navbar 保持显示，正文使用 Title/Meta/Text Skeleton。
- [ ] 回读两张长文页的节点结构、滚动方向、内容高度、Typography 和同构尺寸。
- [ ] 截取两张完整长文、一个视口和 Loading 状态进行目检。

### Task 4: 完成 Help 默认与两个状态

**Files:**

- Reference: `docs/superpowers/specs/2026-08-12-petcare-settings-support-design.md`
- Target Frames: `Help / Default`、`Help / Search Empty`、`Help / FAQ Expanded`

**Interfaces:**

- Consumes: `Input/Search`、Back、Chevron、Search、基础图标与颜色 Token。
- Produces: Help 默认、搜索空结果、FAQ 展开三种状态。

- [ ] 建立 Help Navbar 与 44px Search 实例，覆盖真实 Placeholder/Query 文案。
- [ ] 建立六条轻量 FAQ、六条紧凑分类与轻量客服入口。
- [ ] 克隆默认结构生成 FAQ Expanded，仅展开一条答案并保持其他内容顺序。
- [ ] 生成 Search Empty，保留搜索框，显示空状态、一个主要操作与一个文本操作。
- [ ] 核对 FAQ 行高、Chevron、Search 对齐、操作热区、无彩色宫格与无暖色 Surface。
- [ ] 截取三个 Help 状态并目检。

### Task 5: 原型连接与最终验收

**Files:**

- Reference: `docs/superpowers/specs/2026-08-12-petcare-settings-support-design.md`
- Target: Figma `06 · Settings & Support` 及安全可编辑的来源节点。

**Interfaces:**

- Consumes: 七张已完成 Frame 与现有 Profile/Login 入口。
- Produces: 可验证的页面路径、结构审计和最终视觉证据。

- [ ] 连接 About 到两张 Legal 与 Help，连接 Help 客服入口到 Contact Target；在不破坏现有结构的前提下连接 Profile/Login 来源入口。
- [ ] 扫描七张 Frame：精确命名、宽高、滚动、Bottom TabBar、字体、暖色 Surface、44px 热区、实例 mainComponent、横向溢出、用户可见规范注释。
- [ ] 验证 Legal 两页布局同构，Legal 文案包含待法务确认标记，About/Help 不含禁止内容。
- [ ] 截取整个 `06 · Settings & Support` 分区与高风险页面进行最终目检。
- [ ] 更新计划状态并回报 Figma 节点链接、交付清单、验证结果与剩余风险。
