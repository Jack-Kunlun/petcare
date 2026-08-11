# UniApp 最小业务壳设计

## 目标

将 `apps/uniapp` 从官方功能演示模板收敛为 PetCare 可继续开发的最小跨端业务壳，降低依赖体积、构建配置复杂度和无关示例的维护成本。

目标平台仅包括：

- H5
- 微信小程序
- Android App
- iOS App

## 保留范围

- Vue 3 与 UniApp 核心运行时。
- H5、微信小程序和 App Plus 平台适配。
- Wot UI 组件库与 UnoCSS 原子化样式。
- TypeScript、ESLint、Prettier、Vitest 及现有工作区工程规范。
- Uni Manifest、Pages、Components 与 Auto Import 等最小必要构建插件。
- `App.vue`、`main.ts` 和一个首页。
- 首页保留最小 Wot UI 组件与 UnoCSS 样式，用作基础集成冒烟验证。

启动链路收敛为：

```text
createSSRApp -> App.vue -> pages/index/index.vue
```

## 删除范围

- `echarts`、`uni-echarts`、`zrender`、Vite 集成和全部图表示例分包。
- `subPages`、`subEcharts`、`subAsyncEcharts` 下的全部官方演示页面。
- Alova、Alova Mock、Pet Store Mock、API 生成示例及对应开发依赖。
- Pinia、持久化插件、主题 Store 和相关演示组合式函数。
- `@wot-ui/router` 与示例路由；没有业务路由前使用 UniApp 原生导航。
- 自定义 TabBar、About 页、示例 Layout、DemoBlock 和全局反馈演示组件。
- VueUse、vue-i18n、uni-ku、Carbon 图标集合等当前无业务消费者的依赖。
- 支付宝、百度、京东、快手、飞书、QQ、抖音、小红书、快应用和 Harmony 等非目标平台依赖与脚本。

## 工程配置

- `vite.config.ts` 移除演示 Resolver、图表插件、Router/Pinia/Alova 自动导入和无用目录扫描。
- `package.json` 仅保留四个目标端脚本及工作区标准生命周期脚本。
- `pages.config.ts` 移除自定义 TabBar 配置，仅保留全局页面样式。
- `uno.config.ts` 保留 UniApp 与 Wot UI Preset；没有实际图标消费者时移除 Icon Preset。
- 更新 `pages.json`、自动导入声明和组件声明，使生成结果不再引用已删除功能。
- 更新锁文件，确保被删除依赖不再作为 UniApp 直接依赖存在。

## 业务壳页面

首页只表达三件事：

1. PetCare 应用名称。
2. 跨端业务壳已就绪的简短说明。
3. 一个 Wot UI 组件和少量 UnoCSS 类，用于证明两套基础设施可用。

首页不包含示例导航、外部文档链接、主题切换、Mock 数据或预设业务模块。

## 验证

本次不执行四端构建或 E2E，不启动数据库、Redis、Docker 或其他服务。

必须通过：

- UniApp Prettier 检查。
- UniApp ESLint。
- `vue-tsc --noEmit`。
- UniApp Vitest，允许当前业务测试数为零。
- 工作区与 UniApp 工程配置策略测试。
- `git diff --check`。
- 全仓搜索确认已删除依赖、页面名和演示目录无残余引用。

## 非目标

- 不迁移 Taro 业务代码。
- 不提前设计 PetCare 状态管理、请求层或路由封装。
- 不新增替代 ECharts 的图表库。
- 不创建未来可能使用但当前没有消费者的抽象或依赖。
