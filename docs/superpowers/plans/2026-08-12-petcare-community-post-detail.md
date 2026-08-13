# PetCare Community Post Detail Implementation Plan

> **For agentic workers:** Execute this plan inline in the current session. Do not parallelize writes to the same Figma file.

**Goal:** 在现有 PetCare Figma 文件中完成真实 UGC 社区帖子详情页、完整滚动长图与六个局部状态样例。

**Architecture:** 在 `50 · Community & Content` 页面新增独立 `02 · Post` Section；以一份 Auto Layout Full Page 为内容权威，克隆为 `375×812` Vertical Scroll Default，避免两套稿件漂移。状态只在独立 State Area 中展示，不复制完整页面。

**Tech Stack:** Figma Design、Figma Plugin API、PetCare Semantic Tokens、Noto Sans SC、现有 Assets & Icons。

## Global Constraints

- 不修改 `01 · Community` 与 `03 · Article`。
- 不创建新一级 Figma Page 或公共 Component Set。
- 默认画板 `375×812`，无 Bottom TabBar、无固定底部评论栏。
- 主稿使用小美三图动态；正文完整展示。
- White、Light Neutral、Light Primary Blue 为主，禁止暖黄色和浅橙色 Surface。
- 4px Grid、偶数尺寸、关键触控目标至少 `44×44px`。

---

### Task 1: 建立 Section 并核对现有素材

**Figma nodes:**

- Create: `02 · Post`
- Create: `Community / Post / Detail / Default`
- Create: `Community / Post / Detail / Full Page`
- Create: `Community / Post / Detail / State Area`

- [ ] 读取 `Community / Featured` 中“小美”帖子，记录头像、三张 UGC 图片、互动图标的节点和图片填充。
- [ ] 在 `01 · Community` 与 `03 · Article` 之间或不覆盖现有画布的清晰位置创建 `02 · Post`。
- [ ] 建立 Default、Full Page、State Area 三个容器，返回全部节点 ID。
- [ ] 验证新 Section 不与现有 Section 重叠，且未修改现有业务稿件。

### Task 2: 构建完整 Full Page 与真实滚动 Default

**Consumes:** Task 1 的 Section、画板 ID 与素材填充。

**Produces:** 一份 Full Page 内容权威和一份同步滚动 Default。

- [ ] 构建 Navigation Header：Back、动态详情、Share，三个操作均满足 `44×44px`。
- [ ] 构建 Author Header：小美头像、姓名、时间区域、32px Follow + 44px hit area。
- [ ] 构建完整自然正文与三图 Gallery；不出现 H2/H3、Callout 或“全文”。
- [ ] 构建互动数据和 Like / Comment / Share Interaction Bar。
- [ ] 构建评论输入、至少 4 条连续评论和一层回复。
- [ ] 构建 3 条 Compact“更多社区动态”并补 Bottom Safe Area。
- [ ] 将 Full Page 克隆到 Default 的 `375×812` Vertical Scroll Viewport，保持内容同步。
- [ ] 截图检查 Default 首屏和 Full Page 长图，修复文字截断、对齐、图片裁切与多余留白。

### Task 3: 构建状态区并完成终验

**Consumes:** Task 2 的默认作者、互动、评论和图片视觉规则。

**Produces:** Liked、Following、Comment Empty、Comment Sending、Image Preview、Loading 六个局部状态。

- [ ] Liked 只改变 Heart 和 Count，不增加红色背景。
- [ ] Following 使用 Neutral Surface + Secondary Text。
- [ ] Comment Empty 保留输入并显示轻量空状态。
- [ ] Comment Sending 保留输入文字并显示轻量进度。
- [ ] Image Preview 使用深色预览、`1 / 3` 和 44px 关闭操作。
- [ ] Loading 使用帖子与评论 Skeleton，不使用全屏 Spinner。
- [ ] 运行结构验收：尺寸、Vertical Scroll、内容数量、状态数量、无 TabBar、无暖色 Surface、无 Detached Instance、无非预期溢出。
- [ ] 截图复核 Default、Full Page、State Area；只有全部检查为真才宣告完成。
