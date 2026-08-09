# PetCare Mobile Design System Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This task must be executed inline in the current session; do not dispatch subagents.

**Goal:** 完善 PetCare Figma 移动端 Foundations、变量、文字样式和运行时适配规范，同时保持现有文件层级、Assets & Icons、Login 和 Home 不变。

**Architecture:** 继续使用现有 `Primitives → Semantic Colors → Dimensions` 基础架构，通过 Alias 补充缺失语义，不重建或重命名既有变量。规范文档嵌入现有九个 Foundations Section；组件仅记录契约，不创建 Component Set。Wot UI v2.3.1 与 Taroify 都属于运行时 Adapter，不成为 Figma 品牌变量命名来源。

**Tech Stack:** Figma Plugin API、Figma Variables、Text Styles、Effect Styles、Auto Layout、PetCare Brand Book、Wot UI v2.3.1 CSS Variables。

## Global Constraints

- Figma fileKey 固定为 `mwpHHcx0VAutpPTIhGYGqC`。
- 14 个 Page 的数量、名称和顺序必须保持不变。
- `01 · Foundations` 保持九个顶层 Section。
- `02 · Components` 继续只包含 Assets & Icons，不新增基础或业务组件集。
- Login、Home 的节点结构、尺寸、样式和视觉不得改变。
- 新增 Semantic Color 必须使用 Primitive Alias，且所有变量明确设置 Scope，不得出现 `ALL_SCOPES`。
- 不自动生成未经品牌审核的完整色阶。
- 所有 Figma 写入必须小批次执行，每批写入后读回验证；错误后停止、诊断再重试。

---

### Task 1: 建立执行状态与只读基线

**Files:**

- Create: `.superpowers/sdd/2026-08-09-petcare-mobile-design-system-foundations-state.json`
- Reference: `docs/superpowers/specs/2026-08-09-petcare-mobile-design-system-foundations.md`

**Interfaces:**

- Produces: 页面、变量、样式、组件和已确认页面的基线计数及节点 ID，供最终验收比较。

- [ ] 写入状态文件，记录 14 个 Page、九个 Foundations Section、三组变量、10 个文字样式、5 个 Effect Styles、4 个 Component Sets 和 36 个 standalone components。
- [ ] 记录 Login `165:2`、Home `265:3` 的节点 ID、尺寸和只读截图基线。
- [ ] 通过只读 Figma 调用复核状态文件中的当前值。

### Task 2: 补齐变量体系

**Files:**

- Modify: Figma collections `Primitives`、`Semantic Colors`、`Dimensions`
- Update: `.superpowers/sdd/2026-08-09-petcare-mobile-design-system-foundations-state.json`

**Interfaces:**

- Consumes: 已有 Primitive IDs、Light/Dark mode IDs、现有 Semantic 和 Dimensions 命名约定。
- Produces: 可供后续页面和组件使用的新增 Alias Token 与尺寸 Token。

- [ ] 在 `Primitives` 中只添加透明遮罩所需的批准中性色透明值，Scope 设为空数组。
- [ ] 在 `Semantic Colors` 中添加 Text、Surface、Border、Action、Interaction、Icon 缺失角色，所有 Light/Dark 值使用 Alias。
- [ ] 在 `Dimensions` 中添加 `spacing/0`、`radius/0`、36/44/48 控件高度、page padding 16 和 Motion durations。
- [ ] 为新增变量写入 `var(--pc-...)` WEB code syntax 并设置精确 Scope。
- [ ] 读回验证无重复名称、无断裂 Alias、无 `ALL_SCOPES`，并记录新增变量 ID。

### Task 3: 建立移动端标准文字样式

**Files:**

- Modify: Figma local Text Styles
- Update: `.superpowers/sdd/2026-08-09-petcare-mobile-design-system-foundations-state.json`

**Interfaces:**

- Produces: 11 个移动端标准文字样式，同时保留品牌英文和数据专用样式。

- [ ] 核对 Noto Sans SC 可用字重，使用 `SemiBold` 的实际可用等价字重。
- [ ] 将会与标准命名冲突但值不同的现有样式重命名为 `Legacy/*`，不更改其字体属性。
- [ ] 创建 Display、Heading、Title、Body、Label、Caption 共 11 个标准样式。
- [ ] 保留 `Brand/English` 和 `Data/Mono`，不修改其属性。
- [ ] 读回验证名称唯一、字号/行高/字重准确，Login/Home 视觉属性不变。

### Task 4: 完善现有 Foundations 九个 Section

**Files:**

- Modify: Figma page `01 · Foundations` (`7:2`)
- Update: `.superpowers/sdd/2026-08-09-petcare-mobile-design-system-foundations-state.json`

**Interfaces:**

- Consumes: Task 2 变量和 Task 3 文字样式。
- Produces: 在现有层级内可阅读、可维护、可交付的规范画布。

- [ ] 更新 Colors 文档，展示现有品牌 Primitive、补齐后的 Semantic、Light/Dark 和禁止用途。
- [ ] 更新 Typography 文档，展示 11 个标准样式、品牌/数据专用样式和 Legacy 迁移说明。
- [ ] 更新 Spacing、Radius、Shadow 文档，明确推荐值和禁止随机值。
- [ ] 更新 Icons 文档，说明 16/20/24/32 视觉尺寸、44×44 触控区域和语义色。
- [ ] 更新 Grid & Layout 文档，说明 375×812 基准、320/360/390/414 响应式和 Auto Layout 规则。
- [ ] 更新 Photography 文档，引用批准资产、安全区和可访问性规则。
- [ ] 更新 Design Tokens 文档，加入分层架构、Motion、Accessibility、Component Contract、Taroify/Wot Adapter 和检查清单。
- [ ] 保持九个 Section ID、顺序和顶层层级不变，重排高度时确保间隔统一且无重叠。

### Task 5: 最终验收

**Files:**

- Update: `.superpowers/sdd/2026-08-09-petcare-mobile-design-system-foundations-state.json`
- Reference: `docs/superpowers/specs/2026-08-09-petcare-mobile-design-system-foundations.md`

**Interfaces:**

- Produces: 可复查的变量、样式、页面层级、视觉和剩余风险证据。

- [ ] 验证 14 个 Page 和九个 Foundations Section 的名称、数量、顺序和 ID 不变。
- [ ] 验证 Components 仍为 4 个 sets、36 个 standalone components，且没有新增业务组件。
- [ ] 验证新增 Semantic 全部使用有效 Alias，变量 Scope 无 `ALL_SCOPES`。
- [ ] 验证 11 个标准文字样式完整，Legacy、Brand、Data 样式边界清楚。
- [ ] 截图检查九个 Foundations Section，无裁切、重叠、乱码或模板文案泄漏。
- [ ] 对比 Login、Home 基线，确认节点结构、尺寸和视觉未改变。
- [ ] 更新状态文件为 complete，并记录所有写入批次、错误恢复和剩余风险。
