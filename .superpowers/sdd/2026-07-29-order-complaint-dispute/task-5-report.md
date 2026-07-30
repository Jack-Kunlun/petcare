# Task 5 报告

## 状态

PASS

已完成后台投诉案件分页与详情查询、原子认领、案件转交、初裁、终裁、执行任务生成，以及投诉处理员专用 RBAC 守卫。

## 范围确认

本任务按用户批准包含以下原简报外调整：

- 在共享类型中新增 `ClaimComplaintRequest`、`TransferComplaintRequest` 及契约测试。
- 扩展 `ComplaintQueryService`，提供后台分页与详情查询；后端路由采用 `/admin/complaints`，前端后续使用 `/orders/complaints`。
- 以 `DisputeResolverGuard` 保护投诉后台接口：有效超级管理员全局放行，有效普通管理员必须拥有 `dispute.resolve`；其他后台接口仍由 `AdminGuard` 保持仅超级管理员语义。
- 新增独立 `admin-complaint.controller.spec.ts`，控制器测试不混入服务测试。

`complaint-dispute.module.ts` 及 `AppModule` 接线仍按约定留给 Task 6。

## 实现摘要

- 认领使用事务和 `updateMany` 的状态/版本条件更新，确保并发认领仅一个请求成功。
- 转交仅允许当前处理人或超级管理员执行，目标必须是仍有效且具备纠纷处理资格的管理员，并记录转交理由事件。
- 后台详情根据当前管理员身份计算允许动作，列表支持分页和筛选。
- 初裁开启严格 72 小时二次申诉窗口；终裁关闭案件。
- 裁决校验整数分金额、金额守恒和信用分范围，并在同一事务写入裁决、案件状态、事件和非零执行任务。
- 执行任务采用稳定幂等键；结算对象始终取订单服务方。
- 专用守卫每次从数据库读取当前有效角色并覆盖令牌角色，避免陈旧 JWT 中的 `super_admin` 角色造成越权。

## TDD 证据

- 共享契约先因缺少认领/转交接口而编译失败，补充契约后通过。
- 后台查询测试先因缺少分页与管理员详情方法失败，实现后通过。
- 认领与转交测试先因服务方法缺失失败，实现并发、权限与事件行为后通过。
- 裁决测试先因服务缺失失败，随后逐步覆盖重复裁决、非法数值、72 小时窗口、终裁关闭、订单服务方结算及幂等任务。
- 控制器测试先因控制器/DTO 缺失失败，实现路由、守卫、参数转发、DTO 校验及 HTTP 200 后通过。
- RBAC 测试先因专用守卫缺失失败；普通 RBAC 管理员登录、原 `AdminGuard` 语义和陈旧令牌角色均经历红绿循环。

## 最终验证

- `@petcare/shared-types` build：通过。
- Server 投诉域 Jest：6 个套件、110 项测试通过。
- Server Auth Jest：12 个套件、71 项测试通过。
- Shared Types Vitest：3 个文件、9 项测试通过。
- Server 投诉域与 Auth ESLint：通过。
- Server typecheck：通过。
- Shared Types ESLint 与 typecheck：通过。
- `git diff --check`：通过。

## 自审

按 `code-review` 技能分别完成 Spec 与 Standards 审查：

- Spec 审查：PASS。
- Standards 审查：无剩余硬性违反；已修复裁决理由 DTO 上限不一致与陈旧 JWT 角色信任问题。
- 保留判断项：投诉处理员资格条件及管理员动作上下文在服务间存在少量重复。当前保持局部实现，避免在 Task 5 扩展为跨服务授权抽象；后续若权限规则继续增长，可提取共享策略。

## 提交

本报告与 Task 5 实现位于同一提交；最终 SHA 见任务交付。

## 修复轮次 1/5

### 修复内容

- 将裁决的状态/版本条件更新移到裁决行创建之前。同级并发裁决只有一个事务能抢占案件状态，失败方返回 `COMPLAINT_STATE_CONFLICT`（409），且不会尝试插入重复裁决；事务内后续创建失败仍会回滚状态更新。
- 保留非相关 Prisma `P2002` 原样抛出，不进行宽泛错误翻译。
- 转交目标若为投诉方或被投诉方，返回 `COMPLAINT_PARTY_CANNOT_BE_ASSIGNEE`（400），不再查询或写入分配。
- 非零结算要求订单存在真实 `providerId`，否则返回 `DISPUTE_SETTLEMENT_PROVIDER_REQUIRED`（400）；结算任务不再回退到被投诉方。

### 红绿证据

- 红：竞态测试中 `updateMany` 返回 0 后，旧实现仍调用 `disputeDecision.create`；绿：原子抢占失败后不再写入裁决、事件或执行任务。
- 红：有效管理员身份的订单投诉方/被投诉方仍可成为转交目标；绿：两类当事方均被明确拒绝。
- 红：`providerId` 为空且结算金额非零时旧实现成功并回退到被投诉方；绿：在任何写入前返回 400。
- 回归：服务方即投诉方时，结算任务仍精确指向真实服务方。

### 验证

最终验证结果与修复提交 SHA 见本轮任务交付。
