# PetCare Settings & Support 页面设计规格

**日期：** 2026-08-12  
**状态：** 已确认  
**Figma 文件：** `mwpHHcx0VAutpPTIhGYGqC`  
**设计归属：** `70 · Profile & Pets → 06 · Settings & Support`

## 1. 目标与范围

在不改变现有 Figma 一级页面与视觉体系的前提下，补齐 PetCare 的支持、品牌信息与法律文档阅读体验。本次交付七张页面稿：

1. `About / Default`
2. `Legal / Privacy Policy`
3. `Legal / Service Agreement`
4. `Help / Default`
5. `Legal / Loading`
6. `Help / Search Empty`
7. `Help / FAQ Expanded`

`Legal` 是 Frame 业务命名，不是新的 Figma Page。本次不设计 `Contact / Default`，只保留已有或后续目标入口。

## 2. 已核实前提与边界

- `70 · Profile & Pets` 当前只有 `01 · Profile`、`02 · User Info`、`03 · Pets`、`04 · Social`；新分区直接命名为 `06 · Settings & Support`，不移动已有内容，也不为编号连续而虚构 `05`。
- 当前 `02 · Components` 可验证复用的相关资产包括 Logo、Back、Search、Chevron、基础图标与部分反馈组件；不能假设 Cell、Accordion 或 LegalDocument 主组件已经存在。
- 遵循此前“先确认页面、再剥离组件”的决定。本次使用页面级 Auto Layout 模式，不新增公共 Component Master；后续页面稳定后再评估 `LegalDocument`、`FAQItem`、`CellGroup` 等组件剥离。
- 项目没有提供正式隐私政策和服务协议法务正文。Legal 页面只建立可替换的阅读版式，示例章节必须标明“待法务确认”，不得作为上线文本。

## 3. 全局视觉与尺寸规则

- 所有标准视口宽度为 `375px`，短页默认高度 `812px`；长文页面同时保留真实纵向滚动视口和完整长图。
- 使用 4px Grid 与偶数尺寸体系。除 `1px` Border 外，不使用 3、5、13、15、17 等奇数设计尺寸。
- Typography 仅使用 12、14、16、18、20、22、24px。
- Spacing 优先使用 4、8、12、16、20、24、28、32、40px。
- Icon 使用 16、20、24、32px；Control Height 使用 32、40、44、48、56px。
- Surface 以 White、Light Neutral、Light Primary Blue 为主；四页禁止暖黄、浅橙、米黄色大面积内容背景。
- Primary Blue 仅用于链接、当前状态与轻量品牌强调；Mint 仅用于安心、成功等明确语义；Amber 原则上不使用。
- 所有页面使用同一二级 Navbar：左侧 44×44 返回热区，中间 16/18px SemiBold 标题，右侧 44px 空白占位；无 Bottom TabBar。
- 页面主体使用 Auto Layout，不使用透明 Spacer、空 Frame 或大量绝对定位制造间距。

## 4. About / Default

### 4.1 页面结构

`Navbar → Brand Identity → 品牌介绍 → 品牌价值 → 协议与支持入口 → 版本信息 → 版权信息 → 32px Bottom Safe Content`

### 4.2 Brand Identity

- 使用已批准 `Brand/Logo Stacked` Color 版本，保持比例，不重绘、不改色。
- Logo 保持克制，不做巨大 Hero、渐变 Banner、Glow 或立体效果。
- 展示 `PetCare / 宠伴` 与品牌主张“让每一次照护，都更安心”。
- 容器使用 White Surface、16px Radius、24px Padding、1px Very Light Border。

### 4.3 品牌介绍与价值

- 标题“关于 PetCare”：18px / 600。
- 正文使用已提供的产品定位文案，14px 正文，不扩写公司历史、融资、团队、地址或荣誉。
- “我们相信”采用 2×2 轻量 Grid：Connection、Trust、Care、Companion。统一 Neutral/White Surface 与小面积 Primary Blue 强调，不使用四色彩卡。

### 4.4 支持入口与底部信息

- 入口依次为：服务协议、隐私政策、帮助中心、联系我们。
- 每行 52px，14px / 500 标签，16px Chevron，不加入彩色功能图标。
- 版本号显示为 `v1.0.0（设计占位）`，明确不是最终业务数据。
- 底部只显示 `© PetCare`，不虚构公司主体名称。

## 5. Legal Document System

### 5.1 共用结构

隐私政策和服务协议共用同一页面级布局：

`Fixed Navbar → Vertical Scroll Viewport → Document Header → Legal Meta → Placeholder Notice → Legal Body → Final Section → 32px Bottom Safe Content`

- 正文左右 Padding 16px，不套窄 Card。
- Document Title：22px / 600。
- Meta：12px Hint Text，内容为 `更新日期：YYYY-MM-DD`、`生效日期：YYYY-MM-DD`。
- 正文：16px，采用适合长文阅读的行高；段落间距 16px。
- 一级标题：18px / 600，章节前距 28或32px，标题到正文 12px。
- 二级标题：16px / 600，前距 20或24px，后距 8px。
- 支持普通段落、有序/无序列表、1./1.1/（1）编号、链接和强调文本。
- 法律链接使用 Primary Blue，不叠加粗体与下划线。
- 不设置“我已阅读”或“同意”按钮。

### 5.2 法务占位约束

- 页面顶部使用 Light Primary Blue/Light Neutral 轻量 Callout，明确标识“Legal Copy Placeholder / 待法务确认”。
- 隐私政策可用章节：信息的收集和使用、信息的存储与保护、信息共享与披露、用户权利、未成年人保护、政策更新、联系我们。
- 服务协议可用章节：服务说明、用户权利与义务、平台服务规则、费用与支付、服务变更与取消、责任说明、协议更新、联系我们。
- 章节仅用于验证版式，不构成最终法律条款；不得填写赔偿、违约、管辖、保险、退款期限等未确认规则。

### 5.3 Legal / Loading

- 保留正常 Navbar。
- 内容区显示 Document Title、Meta 与多段 Text Skeleton。
- 不使用全屏 Spinner，不复制完整长页。

## 6. Help System

### 6.1 Help / Default

结构为：

`Navbar → Search → 常见问题 → 帮助分类 → 联系客服 → 32px Bottom Safe Content`

- Search 复用 `Input/Search`，高度 44px、Radius 12px、20px Search Icon、14px Placeholder“搜索你遇到的问题”。
- FAQ 使用轻量 Accordion 行，不使用一问一张大 Card。问题行最小高度 52px，14px / 500，Chevron 16px。
- 默认问题覆盖发布需求、查看服务进度、联系照护者、宠物资料、取消订单和服务记录，不填写未定义的赔偿或退款政策。
- 帮助分类使用紧凑 Cell List：账号与资料、宠物管理、悬赏与订单、服务过程、社区与内容、其他问题；图标如使用，只用统一 20px Rounded Outline。
- 联系客服为轻量 Cell：“还有问题？”/“联系客服”/Chevron，目标为 `Contact / Default`，不设计巨大 CTA、客服 Banner 或机器人插画。

### 6.2 Help / FAQ Expanded

- 保持 Default 页面结构，只展开一个 FAQ 示例。
- Answer 使用 14px Secondary Text，直接在 White/Neutral Surface 中阅读；不使用蓝色或黄色大块背景。

### 6.3 Help / Search Empty

- Search 保持显示，并呈现一个真实查询词。
- 空状态标题“没有找到相关问题”，描述“换个关键词试试，或者联系客服”。
- 操作仅保留一个 44px 主要按钮“清除搜索”和一个 Text Action“联系客服”。
- 空状态图形使用 Primary Blue/Mint 的轻量支持元素，不使用暖黄色插画。

## 7. 原型路径

- `Profile / Default → 关于我们 → About / Default`
- `About / Default → 隐私政策 → Legal / Privacy Policy`
- `About / Default → 服务协议 → Legal / Service Agreement`
- `Profile / Default → 帮助中心 → Help / Default`
- `Help / Default → 联系客服 → Contact / Default（目标占位）`
- 登录页《服务协议》与《隐私政策》入口应分别指向两张 Legal 页面；Legal 页面登录前后均可访问。

若目标节点的现有结构无法安全写入 Prototype reaction，不通过破坏实例或脱离组件强行添加；在本分区用明确 Prototype Target 注释记录，并在终验报告列出。

## 8. 交付与验收标准

- `06 · Settings & Support` 下恰好存在 7 张主交付 Frame，命名与本规格一致。
- About 具有品牌辨识度但不营销，不含虚构企业资料。
- 两张 Legal 页面使用同构布局与一致 Typography，拥有真实 Vertical Scroll；正文明确为法务占位。
- Help 包含搜索、FAQ、分类、客服入口及两个必要状态。
- 所有页面无 Bottom TabBar，主要操作热区不小于 44×44px。
- 不存在暖黄/浅橙大面积 Surface，不存在奇数布局尺寸，不存在字体漂移。
- 复用实例保持 mainComponent 关系；页面内容无用户可见裁切、重叠或横向溢出。
- 完成整区截图与高风险页面截图目检，并运行结构审计后才能宣告完成。
