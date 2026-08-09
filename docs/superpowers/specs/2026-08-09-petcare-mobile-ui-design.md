# PetCare 移动端全量 UI 设计规格

**日期：** 2026-08-09

**交付目标：** 在 Figma Design 中建立可编辑、可复用、可验收的 PetCare 移动端全量设计稿。

**目标团队：** `yunfeng zheng's team`

**建议文件名：** `PetCare Mobile Design System`

## 1. 目标与权威来源

本次工作只负责 UI、交互表达和设计系统，不实现业务代码。设计权威按以下顺序解释：

1. `docs/10-brand-system/PetCare-Brand-Book-v1.0.md` 与 `deliverables/`：品牌视觉、资产、语气和无障碍规则。
2. `docs/01-requirements/04-prototype-specification.md`：页面信息架构、内容层级、路由与流程。
3. 本规格：解决前两者未覆盖或互相冲突的设计落地问题。

当前小程序代码不作为视觉权威，也不限制本次设计。原型采用 **v45 品牌基线 + v46 登录行为**：保留 v45 的页面架构与品牌映射，同时采用 v46 的微信登录、手机号授权合并及登录后切换首页行为。

## 2. 非目标与真实性边界

- 不修改业务代码、API、数据库、路由配置或原型原文。
- 不虚构支付成功、实时视频已连接、定位已授权或身份已认证等真实能力；设计稿使用“示例状态”标记。
- 不重绘 Logo，不重新生成既有 Hero 摄影，不创造新的品牌主色或字体体系。
- 不把兼容重定向 `/home`、`/rewards` 设计成独立业务页面。
- 不为每个页面机械复制完整深色版本。

## 3. 视觉方向

核心感受为 **可信、温暖、专业、现代、克制**。

- 以中性浅背景和白色内容面承载信息，品牌蓝用于主要操作和秩序，薄荷绿用于陪伴、完成和进度，琥珀色仅用于价格、悬赏和有限提示。
- 使用柔和但清晰的层级：细边框、低对比阴影、12–20px 圆角和充足留白；避免拟物、重玻璃态、夸张渐变和过度卡片化。
- 摄影保持真实家庭、自然光、安心照护状态；Logo 只承担识别，不作为主视觉。
- 导航和功能图标统一使用 SVG 线性图标，不使用 Emoji。
- 动效以 150–300ms 的轻微透明度、位移或缩放反馈为主，尊重减少动态设置。

## 4. Figma 文件结构

| 页面                       | 内容                                                       |
| -------------------------- | ---------------------------------------------------------- |
| `00 Cover & Guide`         | 封面、版本、设计原则、阅读说明、主流程索引                 |
| `01 Foundations`           | 色彩变量、字体、栅格、间距、圆角、阴影、图标、媒体、安全区 |
| `02 Components`            | 基础组件、业务组件、交互与状态变体                         |
| `03 Auth & Main Tabs`      | 登录、首页、悬赏大厅、社区、消息、我的                     |
| `04 Bounty`                | 悬赏列表/地图、发布三步、成功、悬赏详情                    |
| `05 Orders & Care`         | 订单列表、订单详情、照护 SOP、实时监控、聊天               |
| `06 Pets & Profile`        | 宠物、个人资料、收藏、关注、评价                           |
| `07 Content & Assets`      | 课堂/社区文章、优惠券、钱包、帮助、客服、关于              |
| `08 States & Dark Samples` | 空、加载、错误、权限、离线、404，以及深色样例              |
| `09 Prototype Flows`       | 五条可点击主流程和流程入口                                 |
| `99 Archive`               | 设计过程中被替换但需要保留追溯的画板                       |

页面与 Frame 使用 `域/页面/状态` 命名，例如 `Bounty/Publish Step 2/Validation Error`。组件使用 `类别/名称` 命名，变量使用 `primitive/`、`semantic/`、`component/` 三层结构。

## 5. 画板与布局基线

- 主设计画板：`375 × 812`。
- 内容采用 4 列移动端栅格，左右安全边距 16px，列间距 12px。
- 状态栏、微信胶囊区和底部安全区作为独立 Overlay/Component，不把内容压入系统不可触区域。
- 页面默认垂直滚动；横向滚动仅用于 Banner、筛选 Chip 和明确的横滑内容列表。
- 底部导航固定 5 项，仅出现在 `/`、`/bounty`、`/community`、`/messages`、`/profile`。
- 子页面统一使用顶部返回导航，不显示底部 Tab；主 Tab 间使用平级切换语义。
- 最小触控区域 `44 × 44px`，相邻触控目标至少保留 8px 可辨间距。

## 6. Design Tokens

### 6.1 色彩

| Token                      | Light     | 用途                  |
| -------------------------- | --------- | --------------------- |
| `primitive/primary/50`     | `#EEF2FF` | 浅品牌面              |
| `primitive/primary/100`    | `#DCE5FF` | 选中背景              |
| `primitive/primary/500`    | `#4A6CF7` | 主色                  |
| `primitive/primary/600`    | `#3F5FE0` | 强调/交互态           |
| `primitive/primary/700`    | `#3552C8` | Active/信息状态       |
| `primitive/care/50`        | `#ECFBF8` | 柔和陪伴面            |
| `primitive/care/500`       | `#5BC8AF` | 产品 UI 辅助色        |
| `primitive/logo-mint`      | `#5BC9B9` | 仅批准的 Logo artwork |
| `primitive/accent/500`     | `#F6B343` | 价格与悬赏提示        |
| `semantic/text/primary`    | `#1F2937` | 产品正文              |
| `semantic/text/strong`     | `#202632` | Hero/高强调标题       |
| `semantic/text/secondary`  | `#667085` | 辅助文本              |
| `semantic/surface/canvas`  | `#F8FAFC` | 页面背景              |
| `semantic/surface/default` | `#FFFFFF` | 卡片和控件            |
| `semantic/border/default`  | `#E6EAF0` | 分隔和边框            |
| `semantic/success/default` | `#16866E` | 完成/通过             |
| `semantic/warning/default` | `#B26A00` | 需关注                |
| `semantic/danger/default`  | `#C23B43` | 失败/危险             |

Dark mode 建立变量模式：Canvas `#0F172A`、Surface `#172033`、Elevated `#202A3E`、Text Primary `#F8FAFC`、Text Secondary `#CBD5E1`、Border `#334155`、Primary `#6F8BFF`、Care `#73D6C0`。媒体、地图和视频不施加整体暗色滤镜。

### 6.2 字体

- 中文：Source Han Sans SC；不可用时依次回退 PingFang SC、Microsoft YaHei、sans-serif。
- 英文与数字：Montserrat；不可用时回退 Arial。
- 时间戳、订单号和等宽数据：JetBrains Mono。
- 等级：Display 40/48、H1 32/40、H2 24/32、H3 20/28、Title 16/24、Body Large 16/26、Body 14/22、Caption 12/18。
- 正文不得小于 14px；12px 仅用于非关键说明、标签和时间。

### 6.3 尺寸、圆角与阴影

- 间距：4、8、12、16、20、24、32、40、48、64、80、96px。
- 圆角：4、8、12、16、20、24、9999px；控件默认 8px，卡片默认 12px，重点面板 20px。
- 阴影：`none`、`xs`、`sm`、`md`、`lg`；常规卡片最多 `sm`，浮动操作和底板最多 `md`。
- 阴影不能作为可点击性的唯一提示，边框、位置、文案和按压态共同表达交互。

## 7. 组件体系

### 7.1 基础组件

- Button：Primary、Secondary、Tertiary、Destructive、Icon；Default、Pressed、Disabled、Loading。
- Input：Text、Textarea、Search、Amount、Date/Time、Address、Upload；Default、Focused、Filled、Error、Disabled。
- Navigation：App Bar、Back Bar、5-Tab Bar、Segmented Tabs、Filter Chips、Pagination Dots。
- Feedback：Toast、Inline Alert、Dialog、Bottom Sheet、Skeleton、Progress、Badge、Empty State、Error State。
- Content：Card、List Item、Avatar、Tag、Price、Rating、Media Thumbnail、Article Metadata。

### 7.2 业务组件

- 服务进度卡、悬赏卡、订单卡、宠物卡、宠托师身份卡。
- SOP 时间轴、照护证据流、实时监控播放器、聊天气泡与发送状态。
- 优惠券、钱包余额卡、交易明细、评价卡、社区帖子、课堂文章卡。
- 定位授权面板、地图标记、地图底部信息板、图片上传队列。

所有变体必须使用组件属性表达，不为每个页面复制独立组件。价格、状态、认证和风险不得只靠颜色区分。

## 8. 页面范围

### 8.1 原型正式范围

- 主 Tab：`/`、`/bounty`、`/community`、`/messages`、`/profile`。
- 悬赏：`/bounty?mode=map`、`/bounty/publish/step1`、`step2`、`step3`、`success`、`/reward/:id`。
- 内容：`/community/article/:id`、`/article/:id`。
- 订单与照护：`/orders`、`/order/:id`、`/monitor/:orderId`、`/chat/:userId`。
- 宠物：`/pets`、`/pets/add`、`/pets/:id`、`/pets/:id/edit`。
- 社交与个人：`/favorites`、`/follows`、`/reviews`、`/profile/info`、`/profile/info/edit`。
- 资产与支持：`/coupons`、`/wallet`、`/help`、`/contact`。
- 兼容入口：`/home`、`/rewards` 仅表现为重定向说明，不制作业务画板。

### 8.2 必要补充页面

- Auth：微信登录、手机号授权、授权拒绝、登录失败、会话恢复。
- Community Publish：因为社区主页面存在发布入口，补充发布动态的单页表单与成功反馈。
- About：因为“我的”存在关于入口，补充品牌介绍、协议和版本信息页面。
- Public User Profile：因为社区头像存在用户主页入口，补充公开资料、关注和内容列表页面。
- System：404、无权限、网络离线、服务暂不可用。

补充页面在 Figma 中标注 `Design completion`，表示这是对既有入口的 UI 完整化，不代表路由或后端已经实现。

## 9. 关键状态覆盖

全量交付预计 70–90 个 Frame，按风险选择状态，而非为每页复制全部组合。

- 全局：默认、加载、空、错误、离线、无权限、禁用、操作中、成功反馈。
- Auth：首次授权、拒绝、失败、手机号已绑定、会话恢复。
- 首页：有/无进行中服务、Banner 位置、定位成功/拒绝、消息未读。
- 悬赏大厅：列表/地图、筛选展开、无结果、定位失败、底板收起/展开。
- 发布：未选择、字段错误、图片上传中/失败、协议未勾选、提交中、防重复、成功。
- 悬赏详情：可接单、自己发布、已接单、已完成、已取消/不存在。
- 消息与聊天：未读/已读、空、发送中、发送失败、对方离线。
- 订单：待支付、待服务、进行中、已完成、已取消，以及对应操作权限。
- 监控：连接中、LIVE、暂停、断流、无权限；媒体旁保留文字状态和恢复路径。
- 社区与内容：关注/取消关注、点赞、评论发送、附近位置未授权、无评论。
- 宠物与资料：空列表、编辑预填、校验错误、上传失败、删除确认、保存反馈。
- 优惠券/钱包：可用/已用/过期、空态、余额不足、提现禁用/进行中。

## 10. 可点击原型

1. **首次登录：** 登录 → 手机号授权 → 成功 → 首页。
2. **发布悬赏：** 首页/大厅 → Step 1 → Step 2 → Step 3 → 成功 → 悬赏详情。
3. **服务履约：** 订单列表 → 订单详情 → 实时监控 → 联系宠托师 → 返回订单。
4. **宠物管理：** 我的 → 宠物列表 → 新增/编辑 → 宠物详情 → 删除确认。
5. **社区互动：** 社区 → 文章详情 → 关注/点赞/评论 → 用户公开主页。

交互采用 Smart Animate 或即时切换，单次过渡 150–300ms；地图拖动、视频播放和真实支付只用状态示意，不模拟不存在的系统能力。

## 11. 品牌资产规则

- 使用 `deliverables/manifest.json` 中登记的批准资产；保持稳定 ID 和路径语义。
- Compact navigation 使用 Symbol；登录/启动面可使用 stacked Logo。
- Logo 安全区为 0.25H；Header 推荐 32px，紧凑场景 24–32px，品牌场景 48px、最大 64px。
- 不拉伸、旋转、重着色、加阴影、描边、裁切或放在复杂背景上。
- UI 辅助薄荷使用 `#5BC8AF`；Logo 内部专用 mint `#5BC9B9` 不得外溢到通用 UI。
- 中文只能使用已批准 full-lockup 或作为 Logo 外部独立文本，不自由添加中文 wordmark。
- Hero 使用已有 750×340 小程序资产；标题、CTA、轮播控件保持为可编辑界面元素，不烧录进图片。

## 12. 无障碍与内容规则

- 正文对比度至少 4.5:1，大字至少 3:1，图标、边界和焦点至少 3:1。
- 状态同时使用文字、图标和颜色；错误紧邻字段并提供恢复操作。
- 图片、图标和媒体在规格注释中提供替代信息；视频提供文字状态/摘要占位。
- Carousel 包含暂停/播放、当前位置说明，并在减少动态模式停止自动播放。
- 表单保持可见标签，不使用 placeholder 代替标签；提交中避免重复操作。
- 文案保持清晰、温暖、可恢复，不使用夸大承诺或制造焦虑的倒计时。

## 13. 深色模式范围

创建完整 Dark 变量模式，但只制作三个验证样例：

1. 登录页：验证 Logo、表单和授权说明。
2. 首页：验证 Hero、卡片、导航和内容密度。
3. 实时监控：验证视频、状态、SOP 和高风险反馈。

深色样例通过后即可证明 Token 结构可扩展；其余页面不重复交付，以控制无价值画板膨胀。

## 14. 验收标准

- 文件页、Section、Frame、组件和变量命名一致，无 `Frame 123`、`Rectangle 45` 等无语义名称。
- 颜色、字体、间距、圆角和阴影来自变量或样式，不在业务画板随意写裸值。
- 5 个主 Tab、正式子页、必要补充页和五条主流程均可从封面索引访问。
- 所有关键状态有文字、图标和恢复路径，不只有颜色变化。
- 所有触控目标满足 44×44px，页面无意外横向滚动，底部操作避开安全区。
- Logo、Hero 和图形资产遵循批准版本、安全区、裁切和使用禁忌。
- 亮色页面完成全量视觉检查；登录、首页、监控完成 Dark 样例检查。
- 逐页检查文字裁切、遮挡、Auto Layout、约束、组件实例和原型返回路径。
- 交付前输出页面清单、Frame 数量、组件数量、变量集合和已知产品依赖。

## 15. 剩余风险与处理

- 原型标题 v45 与变更记录 v46 不一致：按本规格固定的“v45 品牌基线 + v46 登录行为”执行。
- `/community/publish`、About、公开用户主页缺少完整需求：仅做满足入口闭环的最小 UI，并标注 Design completion。
- 实时视频、定位、支付、提现和认证依赖外部能力：只设计可观察状态、权限与恢复路径，不声称功能可用。
- 字体可能未安装在 Figma 环境：优先检测 Source Han Sans SC 与 Montserrat；不可用时使用已规定回退，不猜测字重名称。
- 无法通过 MCP 自动定位团队内同名项目文件夹时，文件先创建在 `yunfeng zheng's team` Drafts，由用户在 Figma 内移动。
