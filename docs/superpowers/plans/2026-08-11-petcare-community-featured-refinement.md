# PetCare Community Featured Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变业务结构的前提下，将现有 Community / Featured 精修为更轻、更紧凑、更自然的真实宠物社区 Feed，并同步 Full Page。

**Architecture:** 直接修改 `50 · Community & Content → 01 · Community` 中现有 Full Page 主内容，再用同一结构同步 375×812 滚动视口。保留页面级 Auto Layout，不新增一级页面、业务模块或公共 PostCard 组件。

**Tech Stack:** Figma Design、Figma Plugin API、现有 PetCare Variables、Assets & Icons、Noto Sans SC。

## Global Constraints

- 仅修改 Figma file `mwpHHcx0VAutpPTIhGYGqC` 的 Section `441:2`。
- 保留 `Community / Featured` 与 `Community / Featured / Full Page` 两个画板及现有六条动态。
- 使用 4px Grid、偶数尺寸；仅 `1px` Border 例外。
- 不创建新的一级 Figma Page、业务模块或公共组件集。
- 不修改摄影内容、Bottom TabBar 五项结构和 Community Active 状态。
- 两个画板必须保持相同内容、样式和布局规则。

---

### Task 1: 顶部 Header、Tabs 与 Activity 减重

**Figma nodes:**

- Modify: `441:4` Community / Top Stack
- Modify: `441:5` Community / Header
- Modify: `441:12` Community Tabs
- Modify: `441:19` Community / Active Overview

**Interfaces:**

- Consumes: Existing Semantic Tokens and Icon/Search instance.
- Produces: 343px wide top stack with 16/16/20 vertical rhythm.

- [ ] 将 Header 高度收紧为 40px，Search hit area 改为 40×40px，移除明显白色 Card 与高对比 Border。
- [ ] 将 Tabs 外框高度改为 44px，三个 Tab 等宽；Active 使用极浅 Primary Surface，Inactive 保持 Secondary Text。
- [ ] 将 Activity 高度由 112px 压缩至 88px，主数字保留 22px，辅助数字降为 16px 与 Hint Label。
- [ ] 设置 Header → Tabs 16px、Tabs → Activity 16px、Activity → Feed 20px。
- [ ] 截图 `441:4`，确认顶部视觉焦点低于首条 Feed。

### Task 2: Feed Card、正文与媒体规范统一

**Figma nodes:**

- Modify: `443:5` Community / Featured Feed
- Modify: six `Post Card / *` descendants

**Interfaces:**

- Consumes: Existing six post content records and UGC image hashes.
- Produces: Six cards with consistent 16px external gap and compact 12px internal rhythm.

- [ ] 将六张 Card 的 Border 降为 Very Light Border，保持 White Surface、16px Radius、16px Padding、无 Shadow。
- [ ] 统一正文最多 4 行；仅 Long Text 保留 `全文`，正文到全文为 4px。
- [ ] 保持单图 311×233、Radius 12px；双图 Gap 8px、Radius 8px；三图改为 Gap 4px、Radius 8px。
- [ ] 统一 User Header → Content、Content → Media、Media/Content → Interaction 为 12px。
- [ ] 重算每张 Card 与 Feed 高度，确认卡片间距全部为 16px。
- [ ] 分别截图单图、双图、三图、纯文字和长文本卡片。

### Task 3: Follow 与 Interaction 视觉统一

**Figma nodes:**

- Modify: all `Follow Visual` frames under `443:5`
- Modify: all `Post / Interaction Bar` frames under `443:5`

**Interfaces:**

- Consumes: Existing live Heart, Comment and Share icon instances.
- Produces: Low-emphasis follow controls and aligned 20px visual interaction glyphs inside 44px hit areas.

- [ ] Default Follow 改为 Light Primary Surface，无明显 Outline；Following 改为 Neutral Light Surface + Secondary Text，无蓝色 Outline。
- [ ] 保持 Follow 视觉 64×32px、外部 64×44px hit area，并通过 Header Auto Layout 垂直居中。
- [ ] 将 Heart、Comment、Share 的可见 Glyph 统一为 20px 与一致 stroke；保留 44×44px hit area。
- [ ] 保持 Icon → Count 4px、Interaction Item Gap 20px；Share 延续只显示图标。
- [ ] 确认 Liked 仅 Heart 和 Count 使用 Warm/Danger Accent。

### Task 4: 双画板同步、Fixed Layers 与最终验收

**Figma nodes:**

- Modify: `441:3` Community / Featured / Full Page
- Modify: `452:632` Community / Featured
- Modify: `452:633` Vertical Scroll Viewport
- Modify: `452:597`, `452:805` Bottom TabBars
- Modify: `452:628`, `452:836` Publish FABs

**Interfaces:**

- Consumes: Refined Full Page top stack and feed from Tasks 1-3.
- Produces: One long review frame and one 375×812 real scrolling screen with matching content.

- [ ] 用精修后的主内容替换 Default viewport 中旧 clone，保持 Vertical overflow、375×740 viewport。
- [ ] 将 FAB 固定在 x=303，底边距 TabBar 顶部 16px；不使用 Spacer 人工抬高。
- [ ] 将 Full Page 最后一条 Post 到尾部安全区设为 24px，再接 Bottom TabBar。
- [ ] 确认两个 TabBar 均为 375×72、Community Active、仅顶部 1px Divider、Tab Item 之间无 Divider。
- [ ] 运行结构回读：两个精确画板、各 6 条 Post、0 missing main component、0 detached、0 visible overflow、Noto Sans SC、无新增 Component/Component Set。
- [ ] 截图 Default、Full Page、顶部区和关键卡片；逐项对照精修规格 24 条验收项。
