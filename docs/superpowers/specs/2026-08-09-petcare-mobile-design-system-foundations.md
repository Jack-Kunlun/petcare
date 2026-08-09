# PetCare 移动端设计系统规范完善方案

## 目标

在不改变现有 Figma Page、Section、Frame 层级，不修改已确认的 Login、Home 页面视觉，不迁移业务页面组件的前提下，完善可持续维护的移动端 Foundations 和 Design Token 体系。

本期只处理规范层。`02 · Components` 继续只保留 Assets & Icons；Button、Input、Cell、Card、Navbar、Tabbar 等组件仅定义契约，待后续页面稳定后再逐页剥离和复用。

## 当前基线

- Figma 文件：`mwpHHcx0VAutpPTIhGYGqC`
- 页面层级：保留现有 14 个 Page 及顺序，不采用外部文档建议的另一套 Page 分类。
- Foundations：保留现有 Colors、Typography、Spacing、Radius、Shadow、Icons、Grid & Layout、Photography、Design Tokens 九个 Section。
- Variables：保留现有 `Primitives`、`Semantic Colors`、`Dimensions` 三个集合及既有变量 ID。
- Components：保留 Brand、Hero、Navigation Icons、Functional Icons 和 Brand Elements；不新增业务或基础组件集。
- 已确认页面：Login、Home 不在本期迁移或视觉调整范围内。

## 设计系统分层

统一采用以下稳定分层：

1. Primitive Token：品牌批准的原始颜色和尺度。
2. Semantic Token：页面与组件使用的语义角色。
3. Component Contract：记录组件应使用哪些 Semantic Token、尺寸和状态，但本期不创建对应组件集。
4. Runtime Adapter：由不同前端运行时映射到各自变量。

Figma 和业务页面不得直接依赖第三方组件库的视觉变量。Wot UI v2 仅作为 `apps/uniapp` 的运行时适配层；Taro/Taroify 使用同一品牌和语义层，但采用各自实现方式。

## Token 策略

### Primitives

- 保留已批准的 Primary、Care、Accent、Success、Danger、Neutral、Dark 和 Logo Mint。
- 不为了满足形式上的 50–950 完整色阶而自动生成未经品牌审核的颜色。
- 只新增支持明确语义缺口所需的原始值，例如透明遮罩。
- Logo Mint 继续作为 artwork 专用色，不映射为通用 UI Care 色。

### Semantic Colors

保留现有命名和 ID，补齐以下语义角色，并全部通过 Alias 指向 Primitive：

- Text：tertiary、placeholder、disabled、inverse、brand。
- Surface：secondary、tertiary、mask。
- Border：light。
- Action：primary-disabled。
- Interaction：hover、pressed、selected、disabled。
- Icon：tertiary、disabled、inverse。

Light 和 Dark 两个模式必须都有明确值，不允许复制 Hex 代替 Alias。

### Dimensions

保留现有尺度，补齐：

- `spacing/0 = 0`
- `radius/0 = 0`
- 控件高度 36、44、48
- 页面水平 Padding 16
- 关键内容最大宽度 `screen - 32`
- Motion duration 0、160、240、320ms，以及标准 easing 文档

所有可点击区域最小 44×44px；图标视觉尺寸与点击区域分离。

## Typography

新增移动端标准文字样式：

- Display/Large 32/40 Semibold
- Heading/Large 24/32 Semibold
- Heading/Medium 20/28 Semibold
- Title/Large 18/26 Semibold
- Title/Medium 16/24 Medium
- Body/Large 16/24 Regular
- Body/Medium 14/22 Regular
- Body/Small 13/20 Regular
- Label/Medium 14/20 Medium
- Label/Small 12/18 Medium
- Caption 12/18 Regular

现有非标准样式只重命名为 `Legacy/*` 或保留为品牌/数字专用样式，不改变当前页面的实际字号、字重和行高。本期不批量替换 Login、Home 的样式绑定。

## Foundations 文档完善

在现有九个 Section 内补充，不新增 Page 或顶层 Section：

- Colors：Primitive、Semantic、Light/Dark、对比度和禁止用途。
- Typography：标准样式、品牌英文、数据字体和 Legacy 迁移表。
- Spacing：4px 基准、页面/卡片/表单间距规则。
- Radius：0/4/8/12/16/20/24/Full 及组件用途。
- Shadow：None/SM/MD/LG 的使用限制。
- Icons：16/20/24/32 视觉尺寸、44px 点击区域、统一描边。
- Grid & Layout：375×812 基准及 320/360/390/414 适配规则。
- Photography：继续沿用批准资产及安全区规则。
- Design Tokens：分层架构、Motion、Accessibility、组件契约、Runtime Adapter 和验收清单。

## Wot UI v2 Adapter

以仓库当前 `@wot-ui/ui@2.3.1` 为适配基线，记录但不直接创建为 Figma 品牌变量。例如：

- `color/action/primary` → `--wot-button-primary-bg`
- `color/action/primary-pressed` → `--wot-button-primary-bg-active`
- Button Large 44/48 设计契约 → `--wot-button-height-large`
- `color/text/primary` → `--wot-input-inner-color`
- `color/text/placeholder` → `--wot-input-inner-placeholder-color`
- `color/text/disabled` → `--wot-input-disabled-color`
- `color/status/danger` → `--wot-input-error-color`

Wot UI 不支持或需要复杂 DOM、SVG、Mask、非标准交互的结构必须标记为 Custom Component，不强行伪装为 Token 覆盖。

## 验收标准

- 14 个 Page 的名称、顺序和数量不变。
- Foundations 保持九个顶层 Section。
- Components 仍只包含 Assets & Icons。
- Login、Home 的节点结构、尺寸和视觉不变。
- 新增 Semantic Token 100% 使用 Alias，变量 Scope 明确且无 `ALL_SCOPES`。
- 新增文字样式完整、命名一致、字体可用。
- 文档不存在未经批准的品牌色、随机间距或随机字号。
- 375px 基准、320–414px 适配、44px 点击区域、Light/Dark 和错误恢复路径均有明确说明。
- 最终通过变量、样式、节点数量、页面层级和截图复核。

## 本期明确不做

- 不重排或新增 Figma Page。
- 不重设计 Login、Home。
- 不迁移现有业务页面。
- 不新增 Button、Input、Cell、Card 等组件集。
- 不引入 Material、iOS 或第三方 UI Kit 的视觉语言。
- 不修改前端代码或直接生成 Wot UI/Taroify 主题文件。
