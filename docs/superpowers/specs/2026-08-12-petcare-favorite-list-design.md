# PetCare 我的收藏页面设计规格

## 状态与交付物

- Figma 文件：`mwpHHcx0VAutpPTIhGYGqC`
- 页面归属：`70 · Profile & Pets`
- Section：`04 · Social`
- 页面入口：`Profile / Default → 我的收藏`
- 页面基准：`375×812`
- 已确认方案：A

交付画板：

1. `Favorite / List / All`
2. `Favorite / List / All / Full Page`
3. `Favorite / List / Article`
4. `Favorite / List / Bounty`
5. `Favorite / List / Service`
6. `Favorite / List / Caregiver`
7. `Favorite / List / Empty`
8. `Favorite / List / Loading`

本次不创建一级 Figma Page，不修改已确认的 Profile 页面，不增加推荐、排行、批量管理或购物收藏夹能力。

## 设计策略

当前 Figma 公共组件库经过主动收缩，实际不存在规格假设的 `ArticleCard / Compact`、`BountyCard / Compact`、`ServiceCard / Compact` 和 `CaregiverCard` 公共组件。此次复用的是现有业务页面的视觉语言、Token、图标和布局规则，而不是为满足组件数量重新建立不稳定的公共组件体系。

四类内容使用页面级统一 Compact Card 骨架：White Surface、Light Border、Radius `12px`、Padding `12px`、高度紧凑、右上角 `20px` Active Favorite Icon。各类型只替换业务内容区域，不创建 `FavoriteArticleCard` 等重复公共组件。待对应页面与收藏场景稳定后，再决定是否提取 `Context = Favorite` Variant。

## 页面结构

固定顺序：

1. Top Safe Area
2. Navigation Header
3. Collection Type Tabs
4. Favorite Content List / State
5. Bottom Safe Area

- 页面支持 Vertical Scroll。
- 不显示 Bottom TabBar。
- Navigation Header 左侧 Back，中间“我的收藏”，右侧保留 `44×44px` 空位维持标题居中。
- 不显示搜索、编辑、管理、批量删除或 More。

## Tabs

- 固定五项：`全部 / 文章 / 悬赏 / 服务 / 保姆`。
- 使用五等分 Text Tabs，整体高度 `44px`。
- 文字 `14px`；Active 为 Primary Blue、Medium/600 和 `2px` Indicator；Inactive 为 Secondary Text、Medium/500。
- 不使用大面积 Segmented Control。
- Header 与 Tabs 在 Loading、Empty 和所有分类状态中保持正常。

## All 混排页

All 按最近收藏时间倒序展示 6 条，不按业务类型分组：

1. 文章：猫咪日常护理指南
2. 悬赏：柯基上门喂养
3. 服务：专业上门洗护
4. 照护者：林可
5. 文章：幼犬喂养注意事项
6. 悬赏：金毛遛狗陪护

`All / Full Page` 展开同一份完整内容；`All` 使用同步的 `375×812` Vertical Scroll Viewport。演示内容与收藏时间是可替换数据位，不代表生产数据。

## 统一 Compact Card

所有卡片共享：

- 宽度 `343px`。
- White Surface、`1px` Light Border、Radius `12px`。
- Padding `12px`，列表 Gap `12px`。
- 内容信息区与 Favorite Action 使用 Horizontal Auto Layout、Space Between、Align Center。
- Favorite Action 为 `44×44px` hit area，内部 `20px` Filled Bookmark/Heart；Active 使用 Primary Blue，不使用红色、黄色或圆形暖色背景。
- 点击卡片主体进入对应详情；点击 Favorite Action 立即取消收藏，并显示 Toast“已取消收藏”，不弹 Confirm Dialog。

### 文章

- `72×72px` 封面。
- 标题 `16px / 600`，摘要 `14px` Secondary、最多 2 行。
- 分类、阅读信息与收藏时间使用 `12px` Hint Text。

### 悬赏

- 使用紧凑宠物缩略图。
- 展示宠物、服务类型、服务时间、距离、价格和收藏时间。
- 金额可使用少量 Amber Text，不使用暖色背景。

### 服务

- 展示服务名称、类型、服务者、评分、基础价格和收藏时间。
- 不增加 Banner 或促销信息。

### 照护者

- 展示 Avatar、姓名、认证/身份、擅长服务、评分和收藏时间。
- 页面 Tab 按业务要求使用“保姆”，卡片内容优先使用“照护者”语义。

## 分类页

- `Article`、`Bounty`、`Service`、`Caregiver` 各展示 3 条同类 Compact Card。
- 各分类页只改变 Active Tab 和列表内容，Header、Tabs、页面边距与卡片骨架一致。
- 不为各分类制作额外 Full Page，避免重复画布和维护漂移。

## Empty

- Header 与 Tabs 正常显示，默认以 All Active 演示。
- 标题：“还没有收藏内容”。
- 描述：“遇到喜欢的文章、服务或照护者，可以收藏后在这里快速找到”。
- 使用同一轻量 Empty State：Heart + Pet Outline，Light Primary Blue、Light Neutral 和少量 Mint。
- 不使用黄色、橙色大插画，不增加推荐内容。
- 分类空状态复用相同结构，仅在后续状态变体中替换文案。

## Loading

- Header 与 Tabs 正常显示。
- 列表区域展示 4 条 Favorite Content Skeleton，覆盖图片、标题、摘要与 Favorite Action 占位。
- 不使用全屏 Spinner。

## 取消收藏反馈

- 主稿中 Favorite Icon 均为 Active。
- 取消后立即更新 Icon 并从当前筛选列表移除；仅在页面状态区或 Toast 样例中展示“已取消收藏”。
- 不增加确认弹窗；收藏不是危险操作。
- 静态稿不模拟列表退出动画，前端实现使用轻量退出动画并保持滚动位置。

## 视觉与实现约束

- 继承现有 PetCare Brand、Semantic 和 Component Token，字体为 Noto Sans SC。
- 页面背景使用 Light Neutral；卡片为 White；Active Tab 和 Favorite 使用 Primary Blue。
- 禁止浅黄、浅橙、米黄或连续 Amber Light Surface。
- 除 `1px` Border 外，布局遵循 4px Grid 和偶数尺寸。
- 主要字号：`12 / 14 / 16 / 18px`；主要间距：`4 / 8 / 12 / 16 / 24 / 32px`。
- Tabs、卡片、内容信息、Favorite Action、Empty 和 Skeleton 均使用 Auto Layout；禁止依赖手工 XY 维持内部关系。
- Wot UI v2 实现阶段优先映射现有 NavBar、Tabs、Cell/Card、Skeleton、EmptyState 和 Toast 能力，不建立另一套独立样式。

## Figma 验收标准

- `70 · Profile & Pets` 下新增 `04 · Social`，不改变现有 `01 · Profile`、`02 · User Info`、`03 · Pets`。
- 精确存在 8 张交付画板，Default 状态均为 `375×812`。
- All 与 All Full Page 内容、顺序和卡片规则同步；All 具有真实 Vertical Scroll。
- 五个 Tab 文案、Active 样式和 `2px` Indicator 正确。
- All 混排 6 条；四个分类页各 3 条；Empty 与 Loading 各一张。
- 所有卡片宽 `343px`、统一 Surface/Border/Radius/Padding，且仍能辨识业务类型。
- 每张内容卡有一个 `44×44px` Favorite Action，内部图标 `20px`。
- 无 Bottom TabBar、推荐模块、排行榜、批量管理、暖色 Surface 或危险操作确认框。
- 无非预期横向溢出、无模板/规格注释泄漏、无丢失主组件或分离实例。

## 已知风险

- 规格提到的四类 Compact 公共组件当前并不存在；本次按已确认策略先完成页面级模式，不能把“视觉复用”误报为“公共组件实例复用”。
- 服务与照护者的正式详情数据字段尚未在当前规格中给出，静态稿使用与现有业务语言一致的演示数据，前端接入前需以 API 契约为准。
- 取消收藏后的实时列表重排、Toast 时长和动画曲线需在实现阶段验证，Figma 静态稿只表达关键结果状态。
