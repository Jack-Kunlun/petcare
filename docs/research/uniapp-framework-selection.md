# PetCare 新跨端客户端框架选型

> 调研日期：2026-08-09
> 范围：微信等小程序、H5、Android/iOS App；Vue 3 + TypeScript；Wot UI 最新版；UnoCSS。
> 资料范围：仅官方文档、官方 GitHub 仓库与官方 npm 包元数据。

> **决策更新（2026-08-11）**：~~迁移期间保留现有 Taro 项目可发布~~。项目已决定直接删除 Taro 项目，接受原功能暂时缺失，后续只在 UniApp 中重建。这是为了避免双客户端、双依赖和双工具链长期并行，并非认定 Taro 本身不可用。

## 结论

推荐 **方案 2：Vitesse Uni App**，但实际起点应直接选 uni-helper 官方 `create-uni` 提供的 **`wot-starter-v2`** 模板，而不是先创建裸 Vitesse 再手工接 Wot UI。

理由：它在三者中最符合 PetCare 的约束——已经集成 Vue 3、TypeScript、Vite、文件路由、自动导入和跨端 UnoCSS，同时 `wot-starter-v2` 明确集成 `@wot-ui/ui@2`；相较裸 uni-app 少了重复搭脚手架的工作，相较 unibest 又少了请求层、登录拦截、i18n、z-paging、Git hooks 等会与现有 monorepo 规范和共享 API 契约重叠的强意见配置。[Vitesse 功能清单](https://github.com/uni-helper/vitesse-uni-app#%E7%89%B9%E6%80%A7)；[`create-uni` 模板清单](https://github.com/uni-helper/create-uni#%E6%A8%A1%E6%9D%BF%E5%88%97%E8%A1%A8)

建议命令：

```bash
pnpm create uni@latest
# 选择 wot-starter-v2
```

如果团队明确希望“业务基础设施也由模板决定”，并接受按 unibest 的路由、请求、登录、i18n 和工具链约定开发，则方案 3 是更快的第二选择。方案 1 只适合团队希望完全自行维护工程底座，或模板依赖发生不可接受的兼容问题时作为退路。

## 重要前提

“一次编写，全端可用”应理解为**共享大部分业务代码**，不能理解为不做平台适配。uni-app 官方明确说明各平台存在无法跨平台的能力，并提供条件编译；Vue 语法在 App 和小程序端也并非全部可用。因此上线标准应至少包含 H5、微信开发者工具、Android 和 iOS 的独立构建及关键链路回归。[条件编译说明](https://uniapp.dcloud.net.cn/tutorial/platform.html)；[Vue 3 平台差异](https://uniapp.dcloud.net.cn/tutorial/vue3-basics.html)

App 端也不能完全摆脱 HBuilderX：unibest 官方文档明确写明 App 运行和发布离不开 HBuilderX；其命令行构建产物仍需导入 HBuilderX 运行或云打包。这个限制来自 uni-app App 工具链，换模板不会消失。[unibest 快速开始](https://www.unibest.tech/base/2-start)；[unibest 运行与发布](https://github.com/feige996/unibest#-%E8%BF%90%E8%A1%8C%E6%94%AF%E6%8C%81%E7%83%AD%E6%9B%B4%E6%96%B0)

## 对比

| 维度                  | 裸 uni-app                             | Vitesse Uni App / wot-starter-v2                                                        | unibest                                                                                                |
| --------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 定位                  | DCloud 官方跨端框架本体                | uni-helper 社区的轻量现代化模板                                                         | 功能完整、意见较强的应用模板与 CLI                                                                     |
| 目标端                | uni-app 本身覆盖 H5、小程序、App       | 继承 uni-app；模板依赖中包含 H5、App 与多种小程序编译包                                 | 官方列出 H5、iOS、Android 及多种小程序支持，但最终还取决于所选 UI 库                                   |
| UnoCSS                | 需自行接入、维护跨端 preset 与构建配置 | 原生集成 `@uni-helper/unocss-preset-uni`、UnoCSS、icons 与 transformers                 | 原生集成同一跨端 preset，并额外带 legacy color 兼容、安全区规则等配置                                  |
| Wot UI 最新版         | 需自行配置组件解析和 H5 样式           | `create-uni` 已提供明确集成 `@wot-ui/ui@2` 的 `wot-starter-v2`                          | CLI 已新增 `wot-ui-v2` 选项，并自动注入 resolver/H5 样式配置                                           |
| 内置能力              | 最少，控制力最高                       | 文件路由、布局、组件/API 自动导入、i18n、ESLint、Vitest                                 | 再加 Pinia、请求封装/拦截、登录拦截、i18n、z-paging、OpenAPI、完整 Git/格式化工具链等                  |
| 对 PetCare 的主要代价 | 工程初始化和长期维护工作最多           | 需把其 lint/hooks 适配根 monorepo，但改造面较小                                         | 与现有 `@petcare/shared-types`、`apps/*` API 规范、根 Husky/lint-staged 重叠；删改模板默认层的成本更高 |
| 维护信号              | 官方框架持续更新                       | Vitesse 主仓库最近可见提交为 2026-03-04；`create-uni` 2026-04 的版本新增 Wot UI v2 模板 | 新仓库活跃、约 1,800 次提交；官方模板元数据为 4.4.1（2026-05-22）                                      |

维护信号来源：[Vitesse commits](https://github.com/uni-helper/vitesse-uni-app/commits/main/)；[`create-uni` releases](https://github.com/uni-helper/create-uni/releases)；[unibest 官方仓库](https://github.com/feige996/unibest)；[unibest `package.json`](https://github.com/feige996/unibest/blob/base/package.json)。提交次数或星数不等同于工程质量，仅用于判断项目不是明显停止维护。

## Wot UI 与 UnoCSS 核对

- 截至调研日，npm 显示最新包为 `@wot-ui/ui@2.2.0`，包方声明覆盖微信、支付宝、钉钉小程序、H5 和 App；同时官方提供 `@wot-ui/unocss-preset`。[@wot-ui/ui npm](https://www.npmjs.com/package/@wot-ui/ui)；[@wot-ui/unocss-preset npm](https://www.npmjs.com/package/@wot-ui/unocss-preset)
- Wot 官方生态同时列出 Vitesse 和 unibest，但这只是兼容性/生态信号，不代表 Wot 团队为模板本身提供维护担保。[Wot UI 官方仓库](https://github.com/wot-ui/wot-ui#%E7%94%9F%E6%80%81)
- 两个模板都使用 `@uni-helper/unocss-preset-uni` 处理小程序/App 的选择器和平台差异；不能直接把普通 Web UnoCSS 配置原样搬入。[Vitesse UnoCSS 配置](https://github.com/uni-helper/vitesse-uni-app/blob/main/uno.config.ts)；[unibest UnoCSS 配置](https://github.com/feige996/unibest/blob/base/uno.config.ts)

## 主要风险与落地护栏

1. ~~**不要同时迁移全部旧小程序。** 先选登录、列表、详情、下单前置流程做纵向试点，并保持现有 Taro 项目可发布，验证完成后再决定迁移节奏。~~ 当前决策改为直接弃用 Taro，功能只在 UniApp 中重建。
2. **固定版本而不是永久追 `latest`。** 创建时使用最新模板，但合入后锁定 uni-app、Wot UI、UnoCSS 和相关 preset；升级走独立 PR，并在四个目标环境回归。
3. **只保留一个工程治理入口。** 新应用继续纳入 PetCare 根 pnpm workspace、Turborepo、ESLint、Prettier、Husky；移除或改造模板自己的 hooks，避免重复执行和规则冲突。
4. **沿用现有契约。** API 参数/响应继续来自 `@petcare/shared-types`，不要采用模板示例在客户端重复声明类型。请求封装应薄适配现有后端，不让模板反向决定服务端契约。
5. **建立平台能力清单。** 登录、支付、地图/定位、上传、推送、隐私授权、后台运行、深链和文件系统逐项标注 H5/微信/Android/iOS 实现，平台专有代码集中放置并使用条件编译。

## 建议的验收门槛

- 同一业务试点可分别构建 H5、微信小程序、App Android、App iOS。
- Wot UI 主题、暗色模式和 UnoCSS 样式在四端视觉一致，无 H5 样式漏载或小程序非法选择器错误。
- 共享类型直接来自 `@petcare/shared-types`，无重复 DTO。
- 根级 lint、style lint、type-check 和生产构建均通过。
- 在真机完成登录、网络异常、权限拒绝、前后台切换和安全区适配测试。
