# 官网首页内容闭环实施计划

**目标：** 在现有 Website Content 发布内核上完成新版首页内容的 Admin、Server 与 Website 闭环。

## 1. 共享契约与服务端模板

- [x] 为 `home_experience` 增加共享区分联合类型与契约测试。
- [x] 为嵌套内容增加运行时校验和素材 ID 解析。
- [x] 更新首页 seed，并只兼容缺少新区块的旧首页模板。
- [x] Admin 读取旧草稿时补齐当前模板，保存后生成正常新修订。

## 2. 公共素材闭环

- [x] 批量解析发布与预览快照中的托管图片。
- [x] 发布预热缓存写入已解析素材，并升级缓存键避免旧空素材缓存。
- [x] 覆盖公开读取、预览和发布预热测试。

## 3. Admin 与 Website

- [x] 增加 `home_experience` 强类型编辑器并纳入穷尽映射。
- [x] 让 `HomeExperience.astro` 消费动态区块，旧快照保留兼容降级。
- [x] 更新 Website 渲染契约与首页接入测试。

## 4. 验证与提交

- [x] 运行 shared-types、Server Website Content、Admin editor/Edit、Website renderer 的聚焦测试。
- [x] 运行四个受影响工作区的类型检查、Admin/Website 样式门禁及生产构建。
- [x] 执行 `git diff --check`、检查提交范围并提交到 `codex/website-admin-content-loop`。
