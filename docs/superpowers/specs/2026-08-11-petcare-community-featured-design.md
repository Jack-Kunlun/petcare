# PetCare 社区精选页设计规格

## 状态与交付物

- 设计文件：`mwpHHcx0VAutpPTIhGYGqC`
- 页面归属：`50 · Community & Content`
- Section：`01 · Community`
- 目标画板：`Community / Featured`
- 评审长图：`Community / Featured / Full Page`
- 画板基准：`375×812`
- 方案状态：已批准，待 Figma 实施

本次在现有 PetCare Design System 上新增社区业务页面，不创建新的一级 Figma Page，不重新定义品牌色、字体、圆角、阴影、图标或 Bottom TabBar。

## 目标

社区精选页需要成为真实宠物主人分享日常与养宠经验的内容入口，同时保持 PetCare 已确认的专业、克制和可信赖气质。页面视觉比例为：

- 60% 专业克制；
- 30% 温暖生活方式；
- 10% 宠物趣味。

页面应适合持续纵向浏览，但不能变成宠物版小红书、短视频平台、朋友圈复制品或服务营销页。

## 非目标与保留边界

本次不增加：

- 热门话题、热搜、排行榜或推荐 Banner；
- 商城、优惠券、积分、签到或会员活动；
- 悬赏、订单、附近服务等其他业务模块；
- 直播、短视频入口或复杂发布快捷菜单；
- 新的公共组件库或 Community 专用基础组件。

本次优先完成页面级设计。待 Community Featured、Classroom、Nearby 和详情页形成稳定复用后，再依据真实重复模式剥离 `PostCard` 等业务组件。

## 已确认的设计方向

采用“均衡内容流”方案：用户身份、正文、真实摄影和轻量互动保持平衡。没有媒体时不保留占位容器；多图采用稳定 Grid，不使用瀑布流；图片不追求过度沉浸，保证首屏至少可浏览一条完整帖子并看到下一条内容的一部分。

未采用以下方向：

- 摄影优先方案：容易接近小红书式内容产品，并降低单屏浏览效率；
- 文字论坛方案：实现简单，但生活感和宠物摄影表现不足；
- 通用 UI 数据库建议的橙色 Claymorphism：与当前 PetCare Token、克制气质及明确禁止的橙色主视觉冲突。

## 页面结构与滚动模型

### Community / Featured

- 尺寸：`375×812`
- Body：真实 `Vertical Scroll`
- Bottom TabBar：固定在底部，高度沿用现有 `72px`
- Floating Publish Button：固定，`56×56px`
- 内容视口：位于 Header/内容区域与 Bottom TabBar 之间
- 页面左右主边距：`16px`

内容顺序固定为：

1. Top Safe Area
2. 社区 Header
3. 社区业务 Tabs
4. 社区今日活跃概览
5. 社区精选 Feed
6. Bottom Content Padding
7. Bottom Safe Area
8. 固定 Floating Publish Button
9. 固定 Bottom TabBar

### Community / Featured / Full Page

评审长图完整包含同一份 Header、Tabs、活跃概览和 6 条真实 Feed 示例。Full Page 不是第二套页面结构，所有内容规则与 Default 一致，只展开完整纵向内容。

## 顶部区域

### 社区 Header

- 高度按现有移动页头体系组织；页面顶部到 Header 为 `16px`。
- 左侧标题“社区”：`22px`、Medium/600、Primary Text。
- 右侧仅保留现有 Search Outline Icon。
- 搜索入口视觉容器为 `40×40px`，前端触控目标扩展至至少 `44×44px`。
- Header 使用 Horizontal Auto Layout、Space Between、Align Center。
- 不增加通知、消息、设置、扫码或更多入口。

### 社区业务 Tabs

- 业务状态：`社区精选 / 萌宠课堂 / 附近动态`。
- 使用三等分 Segmented Control，整体高度 `48px`，内边距 `4px`，圆角 `12px`。
- Active 为 Light Primary Surface + Primary Blue 文字，`14px`、Medium/600。
- Inactive 为透明背景 + Secondary Text，`14px`、Medium/500。
- 只使用文字，不增加图标。
- 三个 Tab 是同一页面的业务状态，不创建新的一级页面。

## 社区今日活跃概览

活跃概览保留三项数据：

- 社区今日活跃：`1,286 人`
- 新增：`328`
- 互动：`2.4k`

这些数值在当前设计中作为后续真实数据接入的可替换数据位，不代表已经确认统计口径。前端接入前必须由产品和数据侧明确统计定义。

视觉规范：

- 浅暖色或 Brand Light Surface；
- 圆角 `16px`，内边距 `16px`；
- 不使用明显阴影；
- 主数字 `24px`、Medium/600；
- 辅助数字 `16px`、Medium/600；
- 单位和 Label 使用 `12–14px` Secondary Text；
- 整体视觉重量必须低于帖子 Feed。

## Feed 内容规划

Full Page 使用 6 条真实内容示例，覆盖不同用户、区域、发布时间和互动状态：

1. **单图 / PetCare 服务体验**：小萌，2 小时前，静安区；记录上门喂养过程，默认关注状态。
2. **双图 / 宠物公园日常**：大壮，5 小时前，浦东新区；金毛与其他宠物互动，已关注状态。
3. **多图 / 日常护理经验**：小美，昨天，徐汇区；换季梳毛方式，3 图 Grid。
4. **纯文字 / 养宠交流**：阿布的家，昨天，长宁区；不渲染媒体容器。
5. **长文本 / 新手经验**：团子妈妈，2 天前，普陀区；正文限制 4–6 行并展示“全文”。
6. **单图 / 附近生活**：豆豆爸爸，3 天前，杨浦区；展示 Liked 状态，但 Featured 不展示距离。

UGC 文案优先表现真实生活，不把全部内容写成 PetCare 服务宣传。用户正文允许自然 Emoji，但任何结构性图标继续使用现有 Icon System。

## Post Card 结构

每条帖子仅使用一层独立卡片：

1. User Header
2. Post Content
3. 可选 Media
4. Interaction Bar

视觉规范：

- White Surface；
- 圆角 `16px`；
- 内边距 `16px`；
- `1px` Light Border；
- 不使用明显阴影；
- 卡片间距 `16px`；
- 不在 Feed 外再增加大型白色容器。

内部纵向节奏：

- User Header → Content：`12px`
- Content → Media：`12px`
- Media → Interaction：`12px`
- 无媒体时 Content → Interaction：`12px`

### User Header

- Avatar：`40×40px`，使用真实用户头像；无头像时复用既有 Empty State。
- 用户名：`14px`、Medium/600、Primary Text。
- 时间与区域：`12px`、Secondary/Hint Text，用户名到 Metadata 为 `4px`。
- 右侧关注按钮：高度 `32px`，水平内边距 `12px`，圆角 `16px`。
- Default 使用 Light Primary Surface + Primary Blue；Following 使用 Neutral Surface + Secondary Text。
- 关注按钮不使用强 CTA、高饱和蓝、粉色或红色。

### Post Content

- 字号 `14px`，沿用现有 Body Line Height Token。
- Feed 中最多展示 4–6 行。
- 长正文超限后展示轻量“全文”入口。
- 正文或媒体进入帖子详情；头像和昵称进入用户主页；关注、点赞、评论和分享保留各自独立点击区域。

### Media

- 单图统一使用 `4:3` 比例，Fill Container，圆角 `12px`。
- 两图使用 2 Columns。
- 三图使用 3 Columns。
- 四图使用 `2×2`。
- 图片间距 `8px`，单元圆角 `8px`。
- 不使用瀑布流，不混用随机图片比例。
- 摄影方向为真实宠物生活、家庭环境、宠物公园、主人互动和服务记录；避免卡通、商业棚拍和明显广告摄影。

### Interaction Bar

- 左对齐排列：Heart、Message Circle、Share。
- 图标使用既有 Rounded Outline Icon，视觉尺寸 `20px`，实际点击目标至少 `44px`。
- 文本 `12px` Secondary Text，Item Gap `20px`。
- 三项不平均铺满卡片，不做成底部工具栏。
- Liked 仅改变 Heart 与 Like Count 的暖色状态，不使用大面积红色背景。

## Floating Publish Button

- 尺寸 `56×56px`，圆形，Primary Blue。
- Plus Icon `24px`、白色。
- 允许极轻 Shadow，不使用渐变、Glow 或彩色阴影。
- Right `16px`，距离 Bottom TabBar 顶部 `16px`。
- 点击进入 `Community / Post / Publish`，当前页不弹出复杂内容类型菜单。
- Feed 尾部预留足够 Bottom Content Padding，避免遮挡图片和 Interaction Bar。

## Bottom TabBar

- 直接复用首页、悬赏大厅和我的页面的同一套结构与图标主组件。
- 五项：`首页 / 悬赏大厅 / 社区 / 消息 / 我的`。
- Community 为 Active。
- Icon `24px`，Label `14px`，Icon 到 Label 为 `4px`。
- Active 使用 Primary Blue + Medium/600；Inactive 使用 Secondary Tab Token + Regular/400。
- Tab Item 之间没有 Divider；整个 TabBar 只保留顶部 `1px` Divider。

## 设计系统与组件策略

- 颜色继续使用现有 Primitive → Semantic → Component Token 绑定。
- 中文继续使用已批准且可用的 `Noto Sans SC`。
- 新增布局尺寸遵循 4px Grid 和偶数尺寸体系；必要的 `1px` Border 例外。
- Search、Plus、Heart、Chat、Send/Share 语义图标优先复用现有 Icon System。
- Bottom TabBar 使用现有导航图标实例，不重绘 Community 专用版本。
- 本轮不扩张公共组件库。页面稳定后再评估 `PostCard / Text`、`PostCard / Single Image`、`PostCard / Multi Image` 与 `Default / Liked` 是否值得抽离。

## 可访问性与落地要求

- 正文与背景对比度至少达到 `4.5:1`。
- 主要触控目标至少 `44×44px`；32px 关注按钮和 40px 搜索容器通过外部 hit area 扩展。
- 状态不能只依赖颜色；关注状态保留文字差异，点赞状态保留图标形态和计数变化。
- 图片需要有可用替代文本；装饰性图片应明确标记。
- Loading 后续使用 Post Card Skeleton，不使用全屏 Spinner。
- Nearby Empty 后续使用轻量空状态，不使用巨大卡通插画。

## Figma 验收标准

- `50 · Community & Content` 下只新增 `01 · Community` Section，不创建一级页面。
- 精确存在一张 `Community / Featured` 和一张 `Community / Featured / Full Page`。
- Default 为 `375×812`，具有真实 Vertical Scroll 视口、固定 TabBar 和固定 FAB。
- Full Page 包含 6 条帖子，至少覆盖 2 条单图、1 条多图、1 条纯文字和1 条长文本。
- 页面中不存在热门榜单、Banner、商城、订单或悬赏内容。
- Header 只有 Search；Tabs 为三个等宽文字项。
- 活跃概览展示三项数据，但不压过 Feed。
- Post Card 只有一层容器，卡片间距 `16px`，内部主间距 `12px`。
- Follow、Liked、Text Only、Single Image、Multi Image 状态在长图中可见。
- Bottom TabBar 每张画板仅一个，Community Active，FAB 不遮挡最后一条内容。
- 所有字体为 `Noto Sans SC`；无丢失主组件、无分离实例、无可见横向溢出、无模板或规格注释泄漏。

## 剩余风险

- `328 新增` 与 `2.4k 互动` 尚未确认统计口径，当前只作为可替换演示数据。
- 社区摄影需要足够真实且有差异，不能通过一组风格高度统一的素材制造虚假的 UGC 感。
- 当前公共组件库经过主动收缩，页面首版应优先复用 Assets & Icons；不得为了追求实例数量重新恢复被清理的组件体系。
- Figma 静态稿不能验证真实图片加载、长文折叠、分享面板和滚动性能，这些需在 Wot UI v2 实现阶段验证。

## 2026-08-11 精修补充规格

本轮属于原位 Visual Refinement，不改变 Community / Featured 的业务结构，也不新增一级 Figma Page、业务模块或公共组件集。`Community / Featured` 与 `Community / Featured / Full Page` 必须同步更新。

### 顶部区域

- 页面顶部到 Header 为 `16px`，Header 到 Tabs 为 `16px`。
- Search 使用 `40×40px` hit area、`20px` 图标、Transparent / Very Light Surface；弱化边框且不使用 Shadow。
- Tabs 高度收紧为 `40px` 或 `44px`，三个文字项等宽；Active 仅使用极浅 Primary Surface，外容器仅保留 Very Light Border 或 Surface 差异。
- Activity 保留 `社区今日活跃 / 1,286 人 / 328 新增 / 2.4k 互动`，但压缩高度并降低 Mint 饱和度；`1,286` 为唯一主统计，辅助数字降级。
- Activity 到首条 Feed 固定 `20px`。

### Feed 与内容规则

- Card 继续使用 White Surface、`16px` Radius、`16px` Padding、无 Shadow；Border 改为 Very Light Border。
- Card 间距固定 `16px`；内部 User Header → Content、Content → Media、Media → Interaction 均为 `12px`。
- 关注视觉高度 `32px`，外部保留 `44px` hit area；Default 改为 Light Primary Surface + Primary Blue，无明显 Outline；Following 改为 Neutral Light Surface + Secondary Text，无蓝色 Outline。
- 正文统一最多显示 `4` 行。只有超过 4 行的内容显示 `全文`，正文到全文间距固定 `4px`；短正文不显示全文。
- 单图固定 `4:3`、Radius `12px`；双图为等宽 2 Columns、Gap `8px`、Radius `8px`；三图为等宽 3 Columns、Gap `4px`、Radius `8px`；四图后续统一使用 `2×2`、Gap `4px`。
- Interaction 使用统一 `20px` Rounded Outline 图标、`12px` Count、Icon 到 Count `4px`、Item Gap `20px`、左对齐；Share 继续保持当前只显示图标的模式，以避免改变既有 Interaction 结构。

### Fixed Layers 与尾部安全区

- FAB 保持 `56×56px`，Right `16px`，底边距 TabBar 顶部 `16px`，作为滚动视口同级固定层。
- 最后一条 Post 到 Bottom Content Safe Area 为 `24px`，不得通过透明 Spacer 或巨大 Margin 抬高 FAB。
- Bottom TabBar 继续复用当前五项结构，Community Active；五个 Tab Item 之间不得出现 Divider，仅容器顶部保留 `1px` Divider。

### 本轮验收补充

- Header、Tabs 与 Activity 的视觉重量均低于首条 Feed 内容。
- 两个画板的 Feed 内容、状态和几何规则完全同步。
- 不新增公共 PostCard Component；保留当前页面级 Auto Layout，待更多社区页面稳定后再抽离。
- 所有新增或调整尺寸遵守 4px Grid 和偶数尺寸体系，必要的 `1px` Border 例外。
