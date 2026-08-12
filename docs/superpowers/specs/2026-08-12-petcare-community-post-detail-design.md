# PetCare 社区帖子详情页设计规格

## 状态与交付物

- 设计文件：`mwpHHcx0VAutpPTIhGYGqC`
- 页面归属：`50 · Community & Content`
- Section：`02 · Post`
- 主画板：`Community / Post / Detail / Default`
- 评审长图：`Community / Post / Detail / Full Page`
- 状态区域：`Community / Post / Detail / State Area`
- 画板基准：`375×812`
- 已确认方案：A，小美发布的“三图 / 日常护理”社区动态
- 方案状态：已批准，待 Figma 实施

本次只新增社区帖子详情，不修改 `01 · Community` 或 `03 · Article`，不创建新的一级 Figma Page，也不扩张公共组件库。

## 页面目标

页面需要让用户明确感到自己正在查看真实宠物主人发布的完整动态，而不是专业养宠文章。核心路径为：查看作者与宠物生活内容、浏览三张真实 UGC 图片、点赞或分享、阅读评论、参与回复、继续浏览更多社区动态。

## 与专业文章详情的边界

`Community / Post / Detail` 以作者、关注关系、自然正文、UGC 图片和互动为主要层级；不使用 H2/H3、文章 Callout、专业阅读元数据或复杂富文本。`Article / Detail` 保持专业知识阅读定位，两者不得仅通过替换标题和图片形成差异。

## 主稿内容

- 作者：小美
- 时间与区域：昨天 · 徐汇区
- 关注状态：默认“关注”
- 正文：完整展示第一次给糯米修脚毛的真实经历，不截断、不显示“全文”入口
- 图片：3 张真实宠物生活摄影，采用当前 Feed 已确认的等宽三列 Gallery，Gap `4px`、Radius `8px`；点击任意图片进入 Image Preview
- 互动数据：`73 赞 / 12 评论 / 3 分享`
- 主稿点赞状态：Default
- 评论：至少 4 条连续列表，其中一条展示单层回复
- 推荐区域：文案使用“更多社区动态”，展示 3 条 Compact Community Card

演示文案与互动数字是可替换数据位，不代表生产统计口径。

## 页面结构

完整滚动内容顺序固定为：

1. Top Safe Area
2. Navigation Header
3. Author Header
4. Post Content
5. Media Gallery
6. Interaction Summary
7. Interaction Bar
8. Comments
9. 更多社区动态
10. Bottom Safe Area

页面不显示 Bottom TabBar，也不增加固定底部评论栏。

## 导航与作者区域

- Navigation Header：左侧 Back，中间“动态详情”，右侧 Share；不增加搜索、消息、设置、收藏或 More。
- Author Header：`40px` Avatar；姓名 `16px / 600`；时间与区域 `12px` Hint Text。
- Follow：视觉高度 `32px`，外部触控目标至少 `44px`；Default 使用 Light Primary Surface + Primary Blue，Following 使用 Neutral Surface + Secondary Text。
- Header 到 Author 为 `16px`，Author 到正文为 `16px`。

## 正文与媒体

- 正文使用 `16px` Content Body Token、Primary Text，可自然分段，支持自然 Emoji。
- 不增加未知业务话题、@关系或营销性标签。
- 正文到媒体为 `16px`。
- 三图 Gallery 延续 Community Feed 的真实 UGC 摄影感；不使用统一商业摄影、卡通宠物或广告素材。
- 图片容器和所有关联布局使用 Auto Layout，不通过手工 XY 维持间距。

## 互动区域

- 媒体下方使用轻量文本展示 `73 赞 / 12 评论 / 3 分享`，字号 `12–14px`、Secondary Text，不做统计 Card。
- Interaction Bar 左对齐排列 Like、Comment、Share；图标 `20px`，文字 `12–14px`，Item Gap `20px`，实际触控目标至少 `44px`。
- Liked 只改变 Heart 形态、颜色和数量，不增加红色背景。
- Header Share 打开 Share Panel；Interaction Bar 的 Share 作为标准互动入口保留，不增加第三个大 Share Button。

## 评论区

- 标题为“全部评论 12”，`18px / 600`。
- 评论输入由当前用户 `36px` Avatar、`40–44px` 圆角输入框和轻量 Send 构成；空输入时 Disabled 或 Hidden，有文字时使用 Primary Blue。
- Comment Item 是连续列表，不使用独立 Card；姓名 `14px / 600`，时间 `12px`，正文 `14px`，操作 `12px`。
- Divider 仅从文字内容左侧开始，或使用 `16px` 间距，不铺设大量横线。
- 回复最多展示一层，格式为“用户 回复 用户：内容”，不设计多层嵌套树。
- 评论区与互动区域间距为 `28–32px`。

## 更多社区动态

- 使用 Light Neutral Surface，Padding `24px 16px`。
- 展示 3 条 Compact Community Card，每条包含作者 Avatar、短摘要、宠物缩略图和互动数。
- 不重复完整大 PostCard，不使用黄色、浅橙色或推荐 Banner。
- 评论区到推荐区域为 `32px`。

## 状态设计

状态区只展示局部状态，不复制完整 Full Page：

1. Default：主稿默认状态
2. Liked：Heart + Count 轻量变化
3. Following：关注按钮变为已关注
4. Comment Empty：保留 Comment Input，展示“还没有评论 / 来聊聊你的养宠经历吧”
5. Comment Sending：保留输入内容并显示轻量发送进度
6. Image Preview：深色预览层、当前图片、`1 / 3`、`44px` 关闭操作
7. Loading：Post Detail Skeleton 与独立评论 Skeleton，不使用全屏 Spinner

## 设计系统与实现约束

- 使用现有 PetCare Semantic Token、Noto Sans SC、图标系统与已批准 UGC 图片。
- 页面主色为 White、Light Neutral、Light Primary Blue；禁止浅黄色帖子背景、浅橙评论块、黄色互动区域和 Warm Surface Recommendation。
- 布局遵循 4px Grid 和偶数尺寸体系，必要的 `1px` Divider 例外。
- Author Row、Follow、Content、Media Grid、Interaction、Comment Input、Comment Item、Reply 和 Compact Recommendation 均使用 Auto Layout。
- 本轮不创建重复基础组件或新的公共 Component Set；优先使用现有 Assets & Icons，待更多页面稳定后再剥离业务组件。
- 普通浏览者为默认视角，不展示编辑、删除或作者 More Menu。

## Figma 验收标准

- `50 · Community & Content` 下新增且仅新增 `02 · Post` Section，不改变 `01 · Community` 与 `03 · Article`。
- 存在一张 `375×812` 的 `Community / Post / Detail / Default`，内部为真实 Vertical Scroll。
- 存在同内容的 `Community / Post / Detail / Full Page` 完整长图。
- 默认稿无 Bottom TabBar、无固定底部评论栏。
- 主稿完整显示作者、关注、完整正文、3 图 Gallery、互动数据、Interaction Bar、至少 4 条评论和 3 条更多社区动态。
- 状态区精确覆盖 Liked、Following、Comment Empty、Comment Sending、Image Preview、Loading；不复制完整长图。
- 不存在专业文章 H2/H3、Callout 或阅读型推荐卡；不与 Article Detail 同构。
- 无暖黄色或浅橙色 Surface，无可见横向溢出、无模板/规格注释泄漏、无丢失主组件或分离实例。
- 所有关键触控目标至少 `44×44px`，同类对齐与间距在 Default、Full Page 和状态区保持一致。

## 已知风险

- 当前公共组件库经过主动收缩，本轮页面级实现会优先保持结构清晰，不以组件数量作为完成标准。
- Feed 中已有头像与摄影素材是否包含可独立复用的原始图片填充，需要 Figma 实施阶段核对；若无法复用，使用同一文件中的已批准真实 UGC 素材，不生成商业化或卡通替代图。
- 分享面板、真实回复输入、图片手势浏览与发送失败恢复属于后续交互实现验证范围，不在本次静态主稿中展开完整业务流程。
