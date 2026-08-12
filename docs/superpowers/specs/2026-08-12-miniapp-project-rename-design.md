# Miniapp 项目更名设计

## 目标

将 PetCare 跨端客户端的项目身份从 `uniapp` 统一更名为 `miniapp`，消除目录名、workspace 包名、根命令和工程契约中的命名歧义。项目仍使用 UniApp、Vue 3、Wot UI 和 UnoCSS，不改变框架、业务行为或平台能力。

## 更名边界

本次采用完整硬更名，不保留旧名称兼容别名：

- `apps/uniapp` 更名为 `apps/miniapp`。
- `@petcare/uniapp` 更名为 `@petcare/miniapp`。
- 根命令 `dev:uniapp:*`、`build:uniapp:*` 更名为 `dev:miniapp:*`、`build:miniapp:*`。
- lint-staged、提交范围分类、workspace 契约、仓库策略和客户端工程契约同步使用新路径与新包名。
- `pnpm-lock.yaml` 的 workspace importer 同步为 `apps/miniapp`。
- README、AGENTS 和现行架构、部署、开发规范文档使用“Miniapp 项目，技术框架为 UniApp”的表述。

以下技术标识不得更名：

- UniApp 框架名称及其 API、CLI 和平台概念。
- `@dcloudio/uni-*`、`@uni-helper/*`、`uni_modules`、`uni-pages.d.ts` 等依赖或工具约定。
- 源码中描述框架限制、虚拟模块或条件导出的 UniApp 注释。

## 历史资料边界

既有 `docs/superpowers` 规格与实施计划、`docs/research` 调研材料记录了当时真实的目录和决策，不做批量回写。现行开发入口文档必须更新，历史资料保留原文，避免把过去的执行记录伪装成当前状态。

## 实施方式

1. 先更新工程契约测试，使其期望 `apps/miniapp`、`@petcare/miniapp` 和 `*:miniapp:*` 命令，并确认旧实现触发失败。
2. 使用 Git 感知的目录移动保留文件历史，再更新 package、根脚本、lint-staged、提交范围和忽略规则。
3. 更新现行文档；保留所有 UniApp 技术标识。
4. 更新 lockfile，不升级依赖或引入新包。
5. 扫描活动配置中残留的旧项目路径、包名和根命令；历史文档中的旧引用不作为残留缺陷。

## 验收

- Git 将客户端目录识别为从 `apps/uniapp` 移动至 `apps/miniapp`。
- workspace 包名为 `@petcare/miniapp`。
- 根开发与构建脚本只暴露 `miniapp` 命名，不保留 `uniapp` 别名。
- lint-staged 与受影响 workspace 检查能识别 `apps/miniapp`。
- 仓库策略、workspace、提交范围、Miniapp 工程和最小业务壳契约测试通过。
- `pnpm --filter @petcare/miniapp lint`、`typecheck` 和 `test` 通过。
- Prettier 和 `git diff --check` 通过。
- 不运行四端构建、E2E、数据库、Redis 或其他服务。

## 风险控制

- **误改框架标识：** 只替换项目路径、包名和命令命名，不做全仓字符串替换。
- **历史资料失真：** 历史规格、计划和调研保留原文，只更新现行文档。
- **生成文件路径漂移：** 更新 Prettier、ESLint 和仓库策略中的生成文件保护路径，但不手工改变生成内容。
- **依赖漂移：** lockfile 只接受 workspace importer 更名所需变化。
