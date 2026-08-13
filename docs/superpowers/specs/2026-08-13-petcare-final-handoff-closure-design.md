# PetCare Figma 最终开发交付收口规格

## 1. 目标与边界

本轮将当前 PetCare Figma 文件从“核心开发可启动”收口到“可正式交付、开发低追问、后续可维护”。工作只基于现有设计、变量、组件和业务文档，不重新定义 Design System，不调整一级 Page，不重做已确认视觉。

本轮包含：

- 补齐收藏与关注入口依赖的正式详情页。
- 同步业务源页面、`90 · Prototype` 与 `98 · Ready for Dev`。
- 修正 Overlay 定位、遮罩及关闭行为。
- 设置开发状态并增加必要的开发标注。
- 消化会影响实现一致性的组件、排版和交互技术债。
- 更新原型规格的路由、字段、状态和交互说明。

不包含：会员、成长、商城、排行、营销、复杂通知设置或其他未定义业务扩展。

## 2. 信息架构

保留现有 14 个一级 Page 及顺序。新增正式页面均放入 `70 · Profile & Pets / 04 · Social`，不创建新的一级 Page。

5 个入口映射到 4 个权威详情页：

| 入口               | 正式页面                       | 建议路由          |
| ------------------ | ------------------------------ | ----------------- |
| Favorite Service   | `Service / Detail / Default`   | `/services/:id`   |
| Favorite Caregiver | `Caregiver / Detail / Default` | `/caregivers/:id` |
| Follow Caregiver   | `Caregiver / Detail / Default` | `/caregivers/:id` |
| Follow Store       | `Store / Detail / Default`     | `/stores/:id`     |
| Follow Creator     | `Creator / Profile / Default`  | `/creators/:id`   |

照护者收藏与关注共用同一个详情源，不复制两套页面。

## 3. 页面设计

### 3.1 Service / Detail / Default

固定结构：

1. Navigation Header：Back、标题“服务详情”、Favorite Action。
2. 服务摘要：服务名称、类型、评分、订单量、基础价格、服务者。
3. 服务内容：服务范围、单次时长、可服务宠物、包含与不包含事项。
4. 服务流程：预约、确认、履约记录、完成反馈。
5. 服务保障：实名认证、过程记录、异常上报、平台保障。
6. 服务者摘要：头像、姓名、认证、评分、进入照护者详情。
7. 评价摘要：评分分布、两条代表评价、查看全部。
8. 固定底部操作：联系服务者、立即预约。

状态：Default、Loading、Unavailable、Favorite On/Off。静态交付以 Default 为正式页面，其余状态由组件或开发标注说明，避免复制整页。

### 3.2 Caregiver / Detail / Default

固定结构：

1. Navigation Header：Back、标题“照护者主页”、Follow/More。
2. 公开资料：头像、姓名、认证、所在区域、评分、完成订单数、响应速度。
3. 专业能力：擅长服务、宠物类型、经验年限、服务半径。
4. 可预约服务：最多三个服务摘要，进入对应服务详情。
5. 信任信息：认证、培训、履约记录、平台信用说明。
6. 用户评价：评分摘要与代表评价。
7. 固定底部操作：发消息、查看可约服务。

收藏与关注入口均进入该页面。Follow 状态直接切换；取消关注使用既有 ActionSheet。

### 3.3 Store / Detail / Default

固定结构：

1. Navigation Header：Back、标题“门店详情”、Follow/More。
2. 门店摘要：Logo、门店名、认证、评分、营业状态。
3. 营业信息：地址、距离、营业时间、联系电话、地图入口。
4. 服务范围：主要服务分类和起步价。
5. 门店介绍：环境、团队、服务承诺。
6. 评价摘要：评分和代表评价。
7. 固定底部操作：联系门店、查看服务。

不增加促销 Banner、团购、商品商城或会员体系。

### 3.4 Creator / Profile / Default

固定结构：

1. Navigation Header：Back、标题“创作者主页”、Follow/More。
2. 公开资料：头像、昵称、身份、区域、简介。
3. 数据摘要：关注者、内容数、累计互动。
4. 内容方向：养宠知识、生活记录等轻量标签。
5. 代表内容：三条已发布内容，进入现有 Post 或 Article Detail。
6. 固定底部操作：关注/已关注；不增加私信能力，除非后续业务明确开放。

## 4. 组件与技术债收口

### 4.1 迁移原则

- `02 · Components` 是组件结构和 Variant 的唯一来源。
- `10–70` 业务页是视觉源；Prototype 和 Ready for Dev 只同步，不独立修改。
- 每类模式按“比较 → 少量替换 → 截图回归 → 扩大替换”执行。
- 不批量 Detach，不删除仍被引用的 Master，不用近似组件覆盖已确认视觉。

### 4.2 必须处理的高频债务

- `Button`：将页面级 49 个遗留 Frame 映射到现有 Primary、Secondary、Outline、Text、Danger Ghost 的 Size/State；确有业务专用复合按钮时保留为局部 Pattern 并说明原因。
- `Navbar`：将 20 个视觉等价 Header 迁移到正式 Navbar；标题、左右操作、透明/实体背景通过属性表达。
- `Tabs`：将 4 个等价 Tabs 迁移到正式 Tabs；不以页面名创建重复组件。
- `SegmentedControl` 与 `FAB`：只迁移视觉、尺寸和交互均等价的实例。
- Favorite Compact Card：提取通用骨架和 Article/Bounty/Service/Caregiver 内容 Variant，Favorite Action 保持独立触控区。
- 详情页重复结构：服务摘要、公开资料、评分摘要、固定底部操作优先复用现有正式基础组件；稳定且重复的结构再形成 Pattern。

### 4.3 排版债务

- 正文和 UI 文案优先接入现有 Text Style；不得新建第二套字体体系。
- `13px → 14px`、`15px → 16px`、`17px → 18px`，仅在不破坏布局且语义一致时迁移。
- `10px` 的可读 UI 文案迁移到 `12px`；纯演示性微型标记如确需保留，必须写入组件说明。
- `32px` 品牌展示字号作为明确例外，不纳入普通 UI 字号门禁。
- 文本颜色继续使用现有语义变量；不以 Text Style 迁移为理由改色或改变字号层级。

## 5. Prototype 与 Overlay

- Main Flow 仍以 Login 为唯一官方起点。
- 5 个入口分别连到 4 个新详情页；照护者收藏与关注复用同一目标。
- 新详情页 Back 返回来源页；存在多来源时使用 Back，不强制错误固定目标。
- Service Detail 的服务者摘要进入 Caregiver Detail。
- Store/Creator/Caregiver 的“已关注”操作打开既有取消关注 ActionSheet。
- ActionSheet、BottomSheet、Picker 使用底部定位；Dialog 和 Image Preview 居中。
- 全部 Overlay 启用背景遮罩。非危险选择型 Overlay 允许点击外部关闭；删除、退出、未保存变更等危险确认 Dialog 不允许误触外部关闭。
- 不连接 Archive、Full Page Review 或业务页源稿。

## 6. Ready for Dev 与开发标注

- `98 · Ready for Dev` 只包含正式确认的 `375×812` 页面，不包含 Overlay 源、Full Page、旧稿或对比稿。
- 新详情页完成视觉和交互回归后再同步到 Ready for Dev。
- 对 71 张交付页面设置 Figma Ready for Dev 状态；若页面已处于 Completed，则保留更高状态。
- 开发标注只写实现中无法从画面直接判断的规则：滚动容器、固定元素、数据字段、权限/失败状态、危险操作、复用路由和组件映射。
- 标注放在 Frame 外或使用 Figma 原生 Annotation，不覆盖产品 UI。

## 7. 文档更新

更新 `docs/01-requirements/04-prototype-specification.md`：

- 增加四个详情页的路由、字段、状态和交互。
- 明确收藏/关注五个入口映射。
- 明确照护者收藏与关注共用详情页。
- 明确 Store/Creator 仅表示公开主体页，不扩展商城、团购或私信。
- 明确 Loading、Unavailable、取消关注及返回行为。
- 更新路由映射总表与版本记录。

## 8. 验收标准

- 4 个新权威详情页存在于正确业务 Section，并以 5 个入口完整可达。
- Prototype 与 Ready for Dev 同步；Ready 页面预计从 67 张增加到 71 张。
- Prototype 无缺失目标、跨页目标、Archive/Full Page 目标或死链。
- Overlay 定位、遮罩与外部关闭符合第 5 节。
- Ready 页面组件无断链，所有 Master 位于 `02 · Components`。
- 49 Button、20 Navbar、4 Tabs 等债务经过逐类审计；等价项完成迁移，不等价项有明确保留原因。
- 字体和字号迁移不改变已确认视觉层级，无 13/15/17px 的普通 UI 文案残留。
- 文档、Figma 页面名称、Prototype 目标和开发标注之间不存在冲突。
- 最终截图回归无裁切、溢出、遮挡、错位或设计说明泄漏。

## 9. 风险控制

- 如果某个遗留 Frame 与正式 Component 不像素等价，保留原视觉并记录差异，不强行替换。
- 如果 Figma Plugin API 不支持 Overlay 或 Dev Status 写入，使用 Windows 界面手动完成并截图验证。
- 如果 Figma 套餐或权限不允许 Ready for Dev/Annotation 写入，保留页面和外部开发说明，并把权限限制作为唯一未完成项报告。
- 所有修改均分阶段验证；一旦出现组件级视觉回归，停止扩大迁移范围并先修复源组件。
