# PetCare Favorite List Implementation Plan

> **For agentic workers:** Execute inline and sequentially. Do not parallelize writes to the same Figma file.

**Goal:** 在 `70 · Profile & Pets` 中完成 8 张“我的收藏”交付画板，包括混排滚动页、四个分类页、Empty 和 Loading。

**Architecture:** 新增 `04 · Social` Section，以 `Favorite / List / All / Full Page` 作为混排内容权威，克隆到 `375×812` Vertical Scroll Viewport。分类页复用同一 Header、Tabs 和统一页面级 Compact Card 结构，只切换 Active Tab 与内容数据。

**Tech Stack:** Figma Design、Figma Plugin API、PetCare Semantic Tokens、Noto Sans SC、现有 Assets & Icons。

## Global Constraints

- 不修改 `01 · Profile`、`02 · User Info`、`03 · Pets`。
- 不创建一级 Figma Page 或新的公共卡片组件集。
- 所有默认画板 `375×812`，无 Bottom TabBar。
- 五个 Text Tabs 固定为全部、文章、悬赏、服务、保姆。
- 页面级 Compact Card 宽 `343px`，Favorite Action 为 `44×44px`，内部图标 `20px`。
- 禁止暖黄色、浅橙色和米黄色 Surface。

---

### Task 1: 建立 Section 与八张画板

- [ ] 在现有三个 Section 下方创建 `04 · Social`。
- [ ] 创建 All、All Full Page、Article、Bounty、Service、Caregiver、Empty、Loading 八张画板。
- [ ] 验证画板命名、尺寸、间距及与现有设计无重叠。

### Task 2: 构建 All 权威长图与滚动稿

- [ ] 构建 Back / 我的收藏 / Right Empty Navigation Header。
- [ ] 构建五等分 Text Tabs，All Active，Indicator `2px`。
- [ ] 按收藏时间倒序构建 6 张混排 Compact Card。
- [ ] 验证四类内容仍可区分，同时 Surface、Border、Radius、Padding、Favorite Action 一致。
- [ ] 克隆权威长图到 All 的 `375×812` Vertical Scroll Viewport。
- [ ] 截图检查首屏信息密度与完整长图尾部留白。

### Task 3: 构建分类与状态画板

- [ ] Article、Bounty、Service、Caregiver 各构建 3 张同类卡片并切换 Active Tab。
- [ ] Empty 保留 Header/Tabs，展示统一轻量 Heart + Pet Outline 空状态。
- [ ] Loading 保留 Header/Tabs，展示 4 条 Favorite Content Skeleton。
- [ ] 截图检查各页同类对齐、卡片高度、文本行数和页面留白。

### Task 4: 最终验收

- [ ] 检查精确 8 张画板和尺寸。
- [ ] 检查 All 与 Full Page 内容同步、Vertical Scroll 和 6 条混排内容。
- [ ] 检查分类页各 3 条、Tabs Active 和 Indicator。
- [ ] 检查所有卡片 343px、Favorite Action 44px、图标 20px。
- [ ] 检查无 TabBar、推荐模块、批量管理、暖色 Surface、Detached Instance、规格注释泄漏和非预期溢出。
- [ ] 获取 Section 总览与高风险画板截图；所有检查为真后才能宣告完成。
