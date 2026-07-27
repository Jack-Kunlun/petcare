# Issue 跟踪系统：GitHub

本仓库的 Issue 和产品需求使用 GitHub Issues 管理。所有操作通过 `gh` CLI 完成。

## 操作约定

- 创建 Issue：`gh issue create --title "..." --body "..."`
- 查看 Issue：`gh issue view <编号> --comments`
- 列出 Issue：`gh issue list --state open --json number,title,body,labels,comments`
- 评论 Issue：`gh issue comment <编号> --body "..."`
- 添加标签：`gh issue edit <编号> --add-label "..."`
- 移除标签：`gh issue edit <编号> --remove-label "..."`
- 关闭 Issue：`gh issue close <编号> --comment "..."`

在当前仓库目录中执行命令，`gh` 会根据 Git 远程地址自动识别 `Jack-Kunlun/petcare`。

## 是否将 Pull Request 作为需求入口

**否。**

外部 Pull Request 默认不进入需求分流流程。如需改变此行为，可直接修改本文件。

GitHub 的 Issue 和 Pull Request 共用编号空间。遇到含义不明确的 `#42` 时，先执行：

```bash
gh pr view 42
```

如果不是 Pull Request，再执行：

```bash
gh issue view 42
```

## 技能要求“发布到 Issue 跟踪系统”时

创建一个 GitHub Issue。

## 技能要求“获取相关工单”时

执行：

```bash
gh issue view <编号> --comments
```

## Wayfinder 操作约定

Wayfinder 使用一个 GitHub Issue 作为任务地图，并使用子 Issue 表示具体任务。

- 地图标签：`wayfinder:map`
- 子任务标签：
  - `wayfinder:research`
  - `wayfinder:prototype`
  - `wayfinder:grilling`
  - `wayfinder:task`
- 优先使用 GitHub 原生子 Issue 和依赖关系。
- 如果仓库不支持这些能力，则使用任务列表和 `Blocked by: #<编号>` 表示依赖。
- 领取任务：`gh issue edit <编号> --add-assignee @me`
- 完成任务：发布结果评论，然后关闭对应 Issue。
