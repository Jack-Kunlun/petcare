# PetCare Settings & Support 统一精修设计规格

**日期：** 2026-08-13  
**状态：** 待用户复核  
**Figma 文件：** `mwpHHcx0VAutpPTIhGYGqC`  
**设计归属：** `70 · Profile & Pets → 06 · Settings & Support`

## 1. 目标与范围

对现有 Settings & Support 七张 Frame 做统一 UI Refinement，不改变业务架构、不新增业务页面、不调整一级 Figma Page：

1. `About / Default`
2. `Legal / Privacy Policy`
3. `Legal / Service Agreement`
4. `Help / Default`
5. `Legal / Loading`
6. `Help / Search Empty`
7. `Help / FAQ Expanded`

本轮目标是减少 Card 感、改善 Legal 长文阅读、提高 Help 信息扫描效率、统一页面节奏与原型关系。允许重建 Frame 内部页面级 Auto Layout，但不得重建 PetCare Design System，也不得新增公共 Component Master。

## 2. 已核实现状

- 七张 Frame 均已存在，标准尺寸为 375×812。
- About 品牌区当前为 343×210 的带边框白色 Card；Brand Values 为 2×2 边框卡片；版本信息为独立 Card。
- 两张 Legal 页面当前含重复 Document Title 和用户可见的 `Legal Copy Placeholder` 提示；正文虽为 16px，但章节节奏与列表结构仍偏密。
- Help FAQ 和分类各为单一白色 Group，方向正确；FAQ Expanded 的 Chevron 尚未表达展开方向。
- Search Empty 当前插画为 96×96，整宽 343×44 Primary Button 视觉过重。
- 画布当前正式稿横向间距 80px，状态稿垂直间距 200px；Prototype Note 与状态稿处于同一排列区域。
- `Contact / Default` 顶层目标 Frame 尚不存在。登录页两份协议当前共用一个文本节点，无法直接分别绑定两个跳转目标。

## 3. 全局约束

- 保留 `70 · Profile & Pets → 06 · Settings & Support` 层级与七张 Frame 名称。
- 标准视口 375×812；主体左右 Padding 16px；Navbar 到首内容 16px；Section 到 Section 28px；Section Title 到 Content 12px；底部安全内容 32px。
- 继续使用 4px Grid 与偶数尺寸。除 1px Border 外，不引入奇数布局尺寸。
- Typography 仅使用 12、14、16、18、20、22、24px。
- Surface 仅使用 White、Light Neutral、Light Primary Blue 与现有 Background Token；禁止暖黄、浅橙、米黄内容 Surface。
- 本组页面不使用 Shadow；层级依赖 Typography、Spacing、Background 和轻量 Divider。
- 保留现有 Design System Token、Navbar、Logo/Symbol、SearchInput、Icon、Skeleton 等实例关系，禁止 detach。
- 本轮使用页面级同步构造方式统一 Legal/Help 内部模式，不建立 `LegalDocument`、`FAQItem`、`AboutCell` 等新的公共 Master。页面稳定后另行评估组件剥离。

## 4. Navbar 统一

- 七张页面使用相同 72px 二级 Navbar：24px Safe Top + 48px 内容行。
- 左侧 Back 使用 44×44 点击热区，Glyph 20或24px。
- 标题 16px / 600，居中；左右 Padding 16px；右侧保持 44px 空白。
- 仅保留底部 1px Light Divider，不增加 Search、More、Share 或其他无意义操作。
- About 与 Help 返回 Profile；Legal 正文返回 About；Help 状态页返回 Help Default。

## 5. About / Default 精修

### 5.1 Brand Identity

- 将现有带边框大 Card 改为开放式 Vertical Auto Layout。
- 使用批准的 PetCare Symbol，不重新生成、不重绘、不改比例；避免 Stacked Logo 与独立品牌文字重复。
- 信息层级：Symbol → `PetCare` → `宠伴` → `让每一次照护，都更安心`。
- `PetCare` 使用 20px / 600；`宠伴` 与品牌主张使用 12或14px Secondary Text。
- 上下 Padding 24px，整体 Center；允许极轻 Neutral Surface，但不显示明显 Border 或 Shadow。

### 5.2 品牌介绍

- 保留“关于 PetCare”及现有产品定位，不新增企业资料。
- 标题 18px / 600；正文 14px，使用当前 Body Token，拆成最多 2个自然段，避免一整块密集文字。

### 5.3 Brand Values

- 保留 Connection、Trust、Care、Companion 的 2×2 结构。
- 改为 Very Light Neutral Surface 的轻量说明块：Radius 12px、Padding 12px，无强 Border、无 Shadow。
- 英文关键词 14px / 600 / Primary Blue；中文说明 12px Secondary。
- 视觉应表现为品牌价值说明，而不是功能入口宫格。

### 5.4 Links 与底部信息

- Support Links 使用单一 CellGroup，Cell 高度 52px，Label 14px / 500，Chevron 16px，行间仅 1px Divider，最后一行无 Divider。
- 保留服务协议、隐私政策、帮助中心、联系我们。
- 版本号取消独立 Card，改为底部轻量文字行；Version 12px Secondary，Copyright 12px Hint。

## 6. Legal System 精修

### 6.1 正式页面结构

两张 Legal 正式页同步重建为同一结构：

`Fixed Navbar → Vertical Scroll Viewport → Legal Meta → Legal Body → Bottom Safe Content`

- 删除 Viewport 内的重复 Document Title。
- 删除 `Legal Copy Placeholder`、章节占位说明、待法务确认说明等所有设计说明 UI。
- 法务占位说明移动到 Section 右侧固定 Annotation 区，不属于正式 Screen。
- 两页保持相同 Navbar、正文宽度、字体、Meta、章节结构、列表规则、Link Style 与 Bottom Spacing，仅替换文档内容。

### 6.2 Meta 与正文

- Meta 直接作为正文首内容：更新日期、生效日期，12px Hint，间距4px。
- Navbar 到 Meta 16px；Meta 到第一章节 24px。
- 正文 16px，使用当前 Legal/Reading Body 行高；段落之间 16px。
- 一级章节标题统一为同一行：`01 信息的收集和使用`，18px / 600；前内容到 H1 为 28或32px，H1 到正文为12px。
- 二级标题 16px / 600；Before 24px，After 8px。
- 列表使用独立 Auto Layout 行：编号列 + 内容列，不通过手工空格缩进；支持 `1.`、`1.1`、`（1）` 等层级。
- 正文保持开放式连续阅读，任何章节不得放入 Card。

### 6.3 Legal / Loading

- 保留 Navbar，Skeleton 与真实正文互斥。
- Skeleton 结构对应正式页面：Meta Skeleton、Heading Skeleton、多组不等长 Paragraph Lines、Section Gap。
- 不显示真实 Legal Body，不使用 Full Screen Spinner。

## 7. Help System 精修

### 7.1 Search

- 继续复用 `Input/Search`，343×44，Radius 12px，Search Icon 20px，Icon 到 Text 8px，左右 Padding 12或16px。
- Search 为 White/Search Surface + 1px Very Light Border，无 Shadow，不表现为大 Card。
- Search 到“常见问题”Section 为24px。

### 7.2 FAQ 与分类

- 常见问题是第一视觉重点：标题 18px / 600，标题到 FAQ 12px。
- FAQ 保持一个 White Surface Group，Radius 16px，无 Shadow；内部为 Question Row + Divider。
- Question Row 最小高度52px，Horizontal Padding16px，Question 14px / 500，Chevron16px，垂直居中。
- FAQ Expanded 只改变内容高度和 Chevron 状态，不改变宽度、Radius、背景或字号。
- 展开 Chevron 改为 Down/Up 方向；Answer 左右 Padding16px、顶部 8或12px、底部16px，14px Secondary，使用 Body 行高。
- FAQ Group 到“问题分类”标题 28px；分类标题18px / 600，标题到列表12px。
- 分类继续使用轻量 Cell List，Cell 52px、Label14px / 500、Chevron16px，不增加左侧彩色图标。
- Help 完整滚动内容底部保留轻量 Support Cell：“还有问题？”/“联系客服”/Chevron。

### 7.3 Search Empty

- Search 下方留 64–96px 后进入空状态，整体居中偏上，避免巨大垂直断层。
- 插画使用 72–80px Minimal Search + Pet 图形：放大镜结合 Paw/猫耳等轻量宠物语义，使用 Very Light Primary Blue、Neutral 与少量 Mint；禁止暖色和复杂多色。
- Title `没有找到相关问题` 使用16px / 600；插画到标题20px。
- Description 使用14px Secondary，标题到描述8px，最多两行。
- “清除搜索”降为 40px Hug Contents Soft Button，Horizontal Padding20px，Light Primary Surface + Primary Blue Text，不再 Fill Container。
- “联系客服”保留14px / 500 Primary Blue Text Action；两个 Action 间距12px。

## 8. 画布与 Annotation

- 保持正式稿上排、状态稿下排的分类。
- 正式稿 Top Align，横向 Gap 统一为160px；状态稿与正式稿垂直 Gap 统一为240px。
- 扩展 Section 宽度以容纳右侧固定说明区；Annotation 不与任何状态 Frame 混排。
- 建立统一 `Design Notes / Legal & Prototype`：记录 Legal 正文为版式占位、Contact 目标缺失、Login 协议热区处理。

## 9. Prototype

- 保持并复核 Profile → About、Profile → Help、About → Privacy、About → Service Agreement、About → Help。
- Help → Contact 仅在 `Contact / Default` 顶层 Frame 存在后建立；当前保留明确 Target Annotation，不链接到 Profile 内部 Cell。
- 登录页保持视觉不变，在协议说明文本上叠加两个透明 44px 高点击热区，分别导航至 Privacy 和 Service Agreement；不得改变文本、排版或登录页已确认视觉。
- Legal Back 返回 About；Help 状态 Back 返回 Help Default。

## 10. 验收标准

- 七张 Frame 名称、尺寸和业务结构保持不变，无新增业务页面。
- About 品牌区无明显 Card Border，Symbol 比例正确，无重复 `PetCare` 字标层级。
- Brand Values 不表现为功能入口宫格；版本信息不再是独立 Card。
- Legal 正式 Viewport 中没有任何 Placeholder/Design Note 文案，也没有重复 Document Title。
- 两张 Legal 页面结构同构，正文16px，章节/段落节奏舒展，无章节 Card、重叠或手工空格列表。
- Legal Loading 与正式正文互斥，Skeleton 层级对应真实文档。
- Help Search 图标/文字居中；FAQ/分类为单 Group List；Expanded Chevron 方向正确，Answer 无裁切。
- Search Empty 插画72–80px并含轻量宠物语义；Soft Button 40px且不 Fill Container。
- 所有主体左右 Padding16px；无暖色 Surface、无 Shadow、无字体漂移、无小于44px的交互热区。
- 现有实例保持 mainComponent，0 detach；正式页面无可见裁切、重叠或横向溢出。
- 画布间距规整，Annotation 位于右侧固定说明区。
- 完成结构审计、Prototype 审计、整区和高风险页面截图目检后才能宣告完成。
