# 后台系统设置实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可审计、可回滚并能为新订单生成稳定快照的 SOP、评分阈值和费率配置闭环。

**Architecture:** 后端采用“领域强类型模型 + 共享发布内核”，共享内核只管理版本、草稿、发布、差异、幂等和审计，三个领域适配器各自负责校验和数据映射。Admin 通过 `@petcare/shared-types` 契约和按领域拆分的 API 访问配置控制台；订单创建在单个事务中读取已发布配置并写入不可变快照。

**Tech Stack:** TypeScript 6、NestJS 11、Prisma 7、PostgreSQL、React 19、React Router、TanStack Query、Tailwind CSS v4、Jest、Vitest、Playwright。

## Global Constraints

- 首期只实现 SOP 配置、评分阈值和费率设置；不实现定时发布、双人审批、通知模板、基础数据和密钥管理。
- 发布立即生效；每个配置键最多一个草稿和一个当前发布版本。
- 历史恢复只能复制为新草稿后重新发布，禁止修改或删除已发布历史。
- 比例统一使用整数万分比，评分统一使用整数百分值，金额统一使用整数分，禁止 `Float`。
- SOP 每个现有服务类型必须恰好 5 步；违规规则只提供结构化指引，不产生自动扣款或信用分变更。
- Admin 和 Server 的请求、响应、业务值及分页类型统一定义在 `@petcare/shared-types`，每个字段和公共函数必须有中文 JSDoc。
- 列表响应固定为 `list`、`total`、`page`、`pageSize`。
- Admin API 统一位于 `apps/admin/src/api/system-settings/`；页面目录使用 `index.tsx`、`Edit.tsx`、`Detail.tsx`。
- Admin 样式优先使用 Tailwind CSS v4 静态工具类，默认字号 14px；只有 Tailwind 无法合理表达时才使用 SCSS。
- 不创建 Prisma migration；仅修改 schema。数据库 reset 和 seed 只能在用户再次明确授权后执行。
- 所有写操作必须进行服务端校验、权限校验、乐观并发检查并写入审计事件。

---

## 文件结构

- `packages/shared-types/src/api/system-settings.ts`：三个配置领域、发布生命周期、差异、历史、概览和错误码的公共契约。
- `apps/server/src/auth/permissions.decorator.ts`、`permission.guard.ts`：声明并执行 permission code 授权。
- `apps/server/src/modules/system-settings/publishing/`：共享版本发布内核、仓储接口和审计接口。
- `apps/server/src/modules/system-settings/{sop,rating-threshold,fee}/`：领域校验、映射及 DTO。
- `apps/server/src/modules/system-settings/`：控制器、概览查询和模块装配。
- `apps/server/src/modules/order/order-config-snapshot.service.ts`：读取发布配置并生成订单快照。
- `apps/admin/src/api/system-settings/`：概览和三个领域 API。
- `apps/admin/src/pages/Settings/`：配置控制台、编辑页、历史详情及可复用发布交互。

### Task 1: 建立共享配置契约

**Files:**

- Create: `packages/shared-types/src/api/system-settings.ts`
- Create: `packages/shared-types/src/api/system-settings.spec.ts`
- Modify: `packages/shared-types/src/api/index.ts`

**Interfaces:**

- Produces: `SystemConfigDomain`, `SystemConfigStatus`, `SystemConfigVersion<T>`, `SystemConfigDraft<T>`, `SystemConfigDiff`, `SopConfig`, `RatingThresholdConfig`, `FeeConfig`, `SaveSystemConfigDraftRequest<T>`, `PublishSystemConfigRequest`, `RestoreSystemConfigRequest`, `SystemSettingsOverviewResponse`。

- [ ] **Step 1: 编写失败的契约测试**

```typescript
import {
  SYSTEM_CONFIG_ERROR_CODE,
  SYSTEM_CONFIG_STATUS,
  type FeeConfig,
  type RatingThresholdConfig,
  type SopConfig,
} from "./system-settings";

describe("system settings contracts", () => {
  it("使用整数表达评分、费率和金额", () => {
    const rating: RatingThresholdConfig = {
      evaluationWindow: 30,
      minimumSampleSize: 5,
      warningScore: 350,
      suspensionScore: 300,
      retrainingRequirement: "完成平台重新培训并通过管理员审核",
    };
    const fee: FeeConfig = {
      platformCommissionBps: 1000,
      rewardServiceFeeCents: 200,
      withdrawalFeeBps: 100,
      minimumWithdrawalFeeCents: 100,
    };
    expect(Number.isInteger(rating.warningScore)).toBe(true);
    expect(Object.values(fee).every(Number.isInteger)).toBe(true);
  });

  it("固定发布状态和稳定错误码", () => {
    expect(SYSTEM_CONFIG_STATUS).toEqual({
      DRAFT: "draft",
      PUBLISHED: "published",
      SUPERSEDED: "superseded",
    });
    expect(SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT).toBe("SYSTEM_CONFIG_VERSION_CONFLICT");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @petcare/shared-types test -- system-settings.spec.ts`
Expected: FAIL，提示 `./system-settings` 不存在。

- [ ] **Step 3: 实现完整强类型契约并导出**

```typescript
export const SYSTEM_CONFIG_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  SUPERSEDED: "superseded",
} as const;

export type SystemConfigStatus = (typeof SYSTEM_CONFIG_STATUS)[keyof typeof SYSTEM_CONFIG_STATUS];

export interface SaveSystemConfigDraftRequest<TConfig> {
  /** 客户端最后读取到的乐观锁版本。 */
  revision: number;
  /** 待保存的强类型领域配置。 */
  config: TConfig;
  /** 本次修改的业务摘要。 */
  changeSummary: string;
}

export interface PublishSystemConfigRequest {
  /** 待发布草稿的乐观锁版本。 */
  revision: number;
  /** 防止重复发布的唯一请求键。 */
  idempotencyKey: string;
}
```

同时逐字段定义并注释 SOP 五步、违规规则、评分阈值、费率、概览、字段级差异和分页历史类型；从 `api/index.ts` 导出。

- [ ] **Step 4: 运行契约测试和类型检查**

Run: `pnpm --filter @petcare/shared-types test -- system-settings.spec.ts && pnpm --filter @petcare/shared-types typecheck`
Expected: PASS。

- [ ] **Step 5: 提交共享契约**

```bash
git add packages/shared-types/src/api/system-settings.ts packages/shared-types/src/api/system-settings.spec.ts packages/shared-types/src/api/index.ts
git commit -m "feat(settings): 定义系统设置共享契约"
```

### Task 2: 建立配置版本数据模型和初始数据

**Files:**

- Modify: `apps/server/prisma/schema.prisma`
- Modify: `apps/server/src/seed/seed-initial-data.ts`
- Modify: `apps/server/src/seed/seed-initial-data.spec.ts`
- Create: `apps/server/src/seed/seed-system-settings.ts`
- Create: `apps/server/src/seed/seed-system-settings.spec.ts`
- Modify: `apps/server/prisma/seed.ts`

**Interfaces:**

- Produces Prisma models: `SystemConfigVersion`, `SopConfigStep`, `SopViolationRule`, `RatingThresholdConfig`, `FeeConfig`, `SystemConfigAuditEvent`；并在 `Order` 上产生快照字段和版本引用。

- [ ] **Step 1: 编写失败的 seed 测试**

```typescript
it("创建系统设置权限和默认发布配置", async () => {
  await seedInitialData(prisma, options, passwordService);
  await seedSystemSettings(prisma, "admin-1");

  expect(state.permissionCodes).toEqual(
    expect.arrayContaining([
      "system.view",
      "system.sop_config",
      "system.threshold_config",
      "system.fee_config",
      "system.publish",
    ]),
  );
  expect(state.feeVersions[0]).toMatchObject({
    status: "published",
    platformCommissionBps: 1000,
    rewardServiceFeeCents: 200,
    withdrawalFeeBps: 100,
    minimumWithdrawalFeeCents: 100,
  });
});
```

- [ ] **Step 2: 运行 seed 测试确认失败**

Run: `pnpm --filter @petcare/server test -- seed-system-settings.spec.ts seed-initial-data.spec.ts --runInBand`
Expected: FAIL，缺少 `seedSystemSettings` 和新权限。

- [ ] **Step 3: 修改 Prisma schema**

实现蛇形表名/字段名映射、`status`/`configKey`/`businessVersion`/`revision`/操作者/发布时间/来源版本/幂等键/变更摘要；使用 PostgreSQL 部分唯一索引无法直接由 Prisma 表达时，不依赖隐式约束，改由 `SystemConfigPointer(configKey @id, publishedVersionId)` 与事务串行更新保证当前版本唯一，草稿使用 `@@unique([configKey, draftSlot])` 且仅草稿写固定 `draftSlot="active"`。领域数据使用一对一强类型表；SOP 步骤和违规规则使用关联表。

订单新增：

```prisma
sopConfigVersionId String? @map("sop_config_version_id")
feeConfigVersionId String? @map("fee_config_version_id")
feeSnapshot        OrderFeeSnapshot?
```

`OrderSop` 新增不可变的 `instruction`、`expectedDurationMinutes`、`minimumPhotoCount`、`videoRequired` 和序列化违规指引字段。

- [ ] **Step 4: 实现幂等初始配置 seed**

为 `feeding`、`walking`、`playing` 分别创建五步已发布 SOP；创建评分阈值和费率已发布版本、指针及审计事件。重复执行不能增加版本数。新增 `system.fee_config`、`system.publish`，保留已有权限并把全部权限关联到 `super_admin`。

- [ ] **Step 5: 格式化、生成客户端并运行测试**

Run: `pnpm --filter @petcare/server exec prisma format && pnpm --filter @petcare/server prisma:generate && pnpm --filter @petcare/server test -- seed-system-settings.spec.ts seed-initial-data.spec.ts --runInBand`
Expected: PASS；Prisma client 成功生成。

- [ ] **Step 6: 提交模型和初始数据**

```bash
git add apps/server/prisma/schema.prisma apps/server/prisma/seed.ts apps/server/src/seed
git commit -m "feat(settings): 建立配置版本模型和默认数据"
```

### Task 3: 建立 permission code 授权守卫

**Files:**

- Create: `apps/server/src/auth/permissions.decorator.ts`
- Create: `apps/server/src/auth/permission.guard.ts`
- Create: `apps/server/src/auth/permission.guard.spec.ts`
- Modify: `apps/server/src/auth/auth.module.ts`
- Modify: `apps/server/src/auth/auth.service.ts`
- Modify: `apps/server/src/auth/auth.service.spec.ts`

**Interfaces:**

- Produces: `@RequirePermissions(...codes: string[])`；`PermissionGuard`；`AuthService.getCurrentUserAuthorization(userId)` 返回角色与 permission code。

- [ ] **Step 1: 编写守卫失败测试**

```typescript
it("允许拥有全部声明权限的管理员", async () => {
  reflector.getAllAndOverride.mockReturnValue(["system.view", "system.publish"]);
  authService.getCurrentUserAuthorization.mockResolvedValue({
    roles: ["config_admin"],
    permissions: ["system.view", "system.publish"],
  });
  await expect(guard.canActivate(contextFor("admin-1"))).resolves.toBe(true);
});

it("拒绝缺少任意声明权限的管理员", async () => {
  reflector.getAllAndOverride.mockReturnValue(["system.publish"]);
  authService.getCurrentUserAuthorization.mockResolvedValue({
    roles: ["config_admin"],
    permissions: ["system.view"],
  });
  await expect(guard.canActivate(contextFor("admin-1"))).rejects.toThrow("缺少系统设置操作权限");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @petcare/server test -- permission.guard.spec.ts --runInBand`
Expected: FAIL，守卫和装饰器不存在。

- [ ] **Step 3: 实现装饰器和守卫**

```typescript
export const PERMISSIONS_METADATA_KEY = "required-permissions";
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, codes);
```

守卫从 access token principal 获取 `sub`，通过 AuthService 查询活动角色及权限；`super_admin` 仍通过实际关联的所有权限授权，不在守卫中硬编码绕过。

- [ ] **Step 4: 运行 auth 测试**

Run: `pnpm --filter @petcare/server test -- permission.guard.spec.ts auth.service.spec.ts admin.guard.spec.ts --runInBand`
Expected: PASS，现有 AdminGuard 行为不回归。

- [ ] **Step 5: 提交权限守卫**

```bash
git add apps/server/src/auth
git commit -m "feat(auth): 支持按权限点保护后台接口"
```

### Task 4: 实现共享发布内核

**Files:**

- Create: `apps/server/src/modules/system-settings/publishing/config-domain.adapter.ts`
- Create: `apps/server/src/modules/system-settings/publishing/config-publishing.service.ts`
- Create: `apps/server/src/modules/system-settings/publishing/config-publishing.service.spec.ts`
- Create: `apps/server/src/modules/system-settings/publishing/config-diff.service.ts`
- Create: `apps/server/src/modules/system-settings/publishing/config-diff.service.spec.ts`
- Create: `apps/server/src/modules/system-settings/system-settings.errors.ts`

**Interfaces:**

- Consumes: Task 1 contracts、Task 2 Prisma models。
- Produces: `ConfigDomainAdapter<TConfig>`；`ConfigPublishingService.getDraft/saveDraft/getDiff/listHistory/publish/restoreAsDraft`。

- [ ] **Step 1: 编写发布生命周期失败测试**

```typescript
it("在一个事务中归档旧版本并发布草稿", async () => {
  prisma.$transaction.mockImplementation((work) => work(prisma));
  await service.publish("fee", {
    revision: 3,
    idempotencyKey: "publish-fee-001",
    actorId: "admin-1",
  });
  expect(adapter.validate).toHaveBeenCalled();
  expect(prisma.systemConfigVersion.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: "superseded" }) }),
  );
  expect(prisma.systemConfigAuditEvent.create).toHaveBeenCalled();
});

it("拒绝陈旧 revision", async () => {
  await expect(
    service.saveDraft("fee", { revision: 2, config, changeSummary: "调整费率" }, "admin-1"),
  ).rejects.toMatchObject({ code: "SYSTEM_CONFIG_VERSION_CONFLICT" });
});

it("重复幂等键返回首次发布结果", async () => {
  prisma.systemConfigVersion.findUnique.mockResolvedValue(publishedVersion);
  await expect(service.publish("fee", request)).resolves.toEqual(publishedVersion);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @petcare/server test -- config-publishing.service.spec.ts config-diff.service.spec.ts --runInBand`
Expected: FAIL，发布服务不存在。

- [ ] **Step 3: 实现领域适配器边界和字段级差异**

```typescript
export interface ConfigDomainAdapter<TConfig> {
  readonly domain: SystemConfigDomain;
  load(versionId: string, tx: PrismaTransaction): Promise<TConfig>;
  persist(versionId: string, config: TConfig, tx: PrismaTransaction): Promise<void>;
  validate(config: TConfig): void;
  summarize(config: TConfig): Record<string, string | number | boolean>;
}
```

差异项固定输出 `path`、`label`、`before`、`after`、`changeType`，数组按稳定业务键比较，避免仅按下标制造噪声。

- [ ] **Step 4: 实现事务发布、乐观锁、幂等和审计**

所有状态改变都通过 `$transaction`；保存时 `updateMany({ where: { id, revision }, data: { revision: { increment: 1 } } })` 并检查 count；发布先复验领域数据，再更新旧版本、草稿、指针和审计。发布失败在事务外补充失败审计，且不得改变发布指针。

- [ ] **Step 5: 运行发布内核测试**

Run: `pnpm --filter @petcare/server test -- config-publishing.service.spec.ts config-diff.service.spec.ts --runInBand`
Expected: PASS，覆盖唯一草稿、冲突、幂等、回滚和审计。

- [ ] **Step 6: 提交发布内核**

```bash
git add apps/server/src/modules/system-settings/publishing apps/server/src/modules/system-settings/system-settings.errors.ts
git commit -m "feat(settings): 实现配置版本发布内核"
```

### Task 5: 实现三个强类型配置领域和 Admin API

**Files:**

- Create: `apps/server/src/modules/system-settings/sop/sop-config.adapter.ts`
- Create: `apps/server/src/modules/system-settings/sop/sop-config.adapter.spec.ts`
- Create: `apps/server/src/modules/system-settings/rating-threshold/rating-threshold.adapter.ts`
- Create: `apps/server/src/modules/system-settings/rating-threshold/rating-threshold.adapter.spec.ts`
- Create: `apps/server/src/modules/system-settings/fee/fee-config.adapter.ts`
- Create: `apps/server/src/modules/system-settings/fee/fee-config.adapter.spec.ts`
- Create: `apps/server/src/modules/system-settings/dto/system-settings.dto.ts`
- Create: `apps/server/src/modules/system-settings/admin-system-settings.controller.ts`
- Create: `apps/server/src/modules/system-settings/admin-system-settings.controller.spec.ts`
- Create: `apps/server/src/modules/system-settings/system-settings-overview.service.ts`
- Create: `apps/server/src/modules/system-settings/system-settings.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- Consumes: 发布内核和公共契约。
- Produces: `/admin/system-settings/overview` 及 SOP、rating-threshold、fee 的 current/draft/diff/history/save/publish/restore API。

- [ ] **Step 1: 编写领域边界失败测试**

```typescript
expect(() => sopAdapter.validate({ ...validSop, steps: validSop.steps.slice(0, 4) })).toThrow(
  "SOP 必须恰好包含 5 个步骤",
);
expect(() =>
  ratingAdapter.validate({ ...validRating, suspensionScore: 350, warningScore: 350 }),
).toThrow("暂停阈值必须严格低于警告阈值");
expect(() => feeAdapter.validate({ ...validFee, platformCommissionBps: 5001 })).toThrow(
  "平台抽成必须在 0 至 5000 万分比之间",
);
```

- [ ] **Step 2: 运行领域测试确认失败**

Run: `pnpm --filter @petcare/server test -- sop-config.adapter.spec.ts rating-threshold.adapter.spec.ts fee-config.adapter.spec.ts --runInBand`
Expected: FAIL，适配器不存在。

- [ ] **Step 3: 实现全部领域校验和持久化**

SOP 校验五步连续、名称 2–20、说明 10–500、时长 1–240、照片 0–20、违规规则完整、重复内容和总时长；评分校验窗口 5–100、样本不超过窗口、分数 100–500、暂停严格低于警告、培训说明非空；费率校验万分比 0–5000、金额非负整数。

- [ ] **Step 4: 编写控制器失败测试**

验证每个路由调用正确领域键，读取要求 `system.view`，保存分别要求领域权限，发布和恢复额外要求 `system.publish`；DTO 通过 `class-validator` 拒绝小数、越界和空摘要。

- [ ] **Step 5: 实现 Swagger DTO、控制器、概览服务和模块装配**

```typescript
@Put("fee/draft")
@RequirePermissions("system.fee_config")
@ApiSuccessResponse(FeeConfigDraftResponseDto)
saveFeeDraft(@Body() dto: SaveFeeConfigDraftDto, @Req() request: AuthRequest) {
  return this.publishing.saveDraft("fee", dto, request.user!.sub);
}
```

所有接口声明返回 DTO 和标准错误；历史列表使用统一分页格式。

- [ ] **Step 6: 运行领域、控制器和构建验证**

Run: `pnpm --filter @petcare/server test -- system-settings --runInBand && pnpm --filter @petcare/server typecheck && pnpm --filter @petcare/server build`
Expected: PASS，Swagger 可生成完整返回 schema。

- [ ] **Step 7: 提交领域 API**

```bash
git add apps/server/src/modules/system-settings apps/server/src/app.module.ts
git commit -m "feat(settings): 提供系统设置领域接口"
```

### Task 6: 将发布配置接入订单和评分资格评估

**Files:**

- Create: `apps/server/src/modules/order/order-config-snapshot.service.ts`
- Create: `apps/server/src/modules/order/order-config-snapshot.service.spec.ts`
- Modify: `apps/server/src/modules/order/order.service.ts`
- Modify: `apps/server/src/modules/order/order.service.spec.ts`
- Modify: `apps/server/src/modules/order/order.module.ts`
- Create: `apps/server/src/modules/provider/provider-rating-eligibility.service.ts`
- Create: `apps/server/src/modules/provider/provider-rating-eligibility.service.spec.ts`
- Create: `apps/server/src/modules/provider/provider.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- Consumes: 当前已发布 SOP、费率和评分阈值。
- Produces: `OrderConfigSnapshotService.createForOrder(serviceType, amount, tx)`；`ProviderRatingEligibilityService.evaluate(providerId)`。

- [ ] **Step 1: 编写订单快照失败测试**

```typescript
it("创建订单时复制发布 SOP 和费率计算结果", async () => {
  await service.createRewardOrder(dto, "owner-1");
  expect(prisma.$transaction).toHaveBeenCalled();
  expect(prisma.orderSop.createMany).toHaveBeenCalledWith({
    data: expect.arrayContaining([
      expect.objectContaining({ stepNumber: 1, instruction: expect.any(String) }),
    ]),
  });
  expect(prisma.orderFeeSnapshot.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ feeConfigVersionId: "fee-v2" }),
  });
});

it("发布新配置后不修改历史订单快照", async () => {
  await publishing.publish("fee", publishRequest);
  expect(prisma.orderFeeSnapshot.updateMany).not.toHaveBeenCalled();
  expect(prisma.orderSop.updateMany).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行订单测试确认失败**

Run: `pnpm --filter @petcare/server test -- order-config-snapshot.service.spec.ts order.service.spec.ts --runInBand`
Expected: FAIL，快照服务不存在或订单未写快照。

- [ ] **Step 3: 在同一事务创建订单与不可变快照**

费率计算显式返回 `commissionAmountCents`、`rewardServiceFeeCents` 和输入金额；按整数规则舍入。订单创建失败时不得残留快照，缺少已发布配置时返回 `SYSTEM_CONFIG_NOT_FOUND`。

- [ ] **Step 4: 编写评分资格失败测试并实现服务**

测试最近 N 条已评价订单、少于最小样本不限制、低于警告产生待办/通知、低于暂停停止接单，以及阈值边界。实现查询时读取当前发布阈值，但不修改历史评价。

- [ ] **Step 5: 运行订单、评分和既有模块测试**

Run: `pnpm --filter @petcare/server test -- order provider-rating-eligibility --runInBand`
Expected: PASS。

- [ ] **Step 6: 提交业务接入**

```bash
git add apps/server/src/modules/order apps/server/src/modules/provider apps/server/src/app.module.ts
git commit -m "feat(settings): 接入订单快照和评分资格评估"
```

### Task 7: 建立 Admin API 层

**Files:**

- Create: `apps/admin/src/api/system-settings/client.ts`
- Create: `apps/admin/src/api/system-settings/overview.ts`
- Create: `apps/admin/src/api/system-settings/sop.ts`
- Create: `apps/admin/src/api/system-settings/rating-threshold.ts`
- Create: `apps/admin/src/api/system-settings/fee.ts`
- Create: `apps/admin/src/api/system-settings/system-settings-api.test.ts`

**Interfaces:**

- Consumes: Task 1 请求响应类型。
- Produces: `fetchSystemSettingsOverview`、`fetch/save/publish/restore` 三个领域配置函数及统一的 409 错误识别函数。

- [ ] **Step 1: 编写失败的 API 测试**

```typescript
it("保存费率草稿时发送 revision 和强类型配置", async () => {
  mockedClient.put.mockResolvedValue({ data: draft });
  await saveFeeDraft({ revision: 2, config: fee, changeSummary: "调整平台抽成" });
  expect(mockedClient.put).toHaveBeenCalledWith(
    "/admin/system-settings/fee/draft",
    expect.objectContaining({ revision: 2, config: fee }),
  );
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @petcare/admin test -- system-settings-api.test.ts`
Expected: FAIL，API 模块不存在。

- [ ] **Step 3: 实现按领域拆分的 API 函数**

所有返回值直接取统一响应拦截后的 `response.data`；`isSystemConfigVersionConflict(error)` 只识别稳定错误码，不匹配中文消息。

- [ ] **Step 4: 运行 API 测试和类型检查**

Run: `pnpm --filter @petcare/admin test -- system-settings-api.test.ts && pnpm --filter @petcare/admin typecheck`
Expected: PASS。

- [ ] **Step 5: 提交 Admin API**

```bash
git add apps/admin/src/api/system-settings
git commit -m "feat(settings): 建立后台系统设置 API 层"
```

### Task 8: 实现配置控制台和领域编辑体验

**Files:**

- Modify: `apps/admin/src/pages/Settings/index.tsx`
- Create: `apps/admin/src/pages/Settings/index.test.tsx`
- Create: `apps/admin/src/pages/Settings/Edit.tsx`
- Create: `apps/admin/src/pages/Settings/Edit.test.tsx`
- Create: `apps/admin/src/pages/Settings/Detail.tsx`
- Create: `apps/admin/src/pages/Settings/Detail.test.tsx`
- Create: `apps/admin/src/pages/Settings/PublishDialog.tsx`
- Create: `apps/admin/src/pages/Settings/ConfigDiff.tsx`
- Create: `apps/admin/src/pages/Settings/SopEditor.tsx`
- Create: `apps/admin/src/pages/Settings/RatingThresholdEditor.tsx`
- Create: `apps/admin/src/pages/Settings/FeeEditor.tsx`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/App.test.tsx`

**Interfaces:**

- Consumes: Task 7 API。
- Produces routes: `/settings`、`/settings/:domain/edit`、`/settings/:domain/history/:versionId`，SOP 使用 `serviceType` 查询参数。

- [ ] **Step 1: 编写概览失败测试**

```typescript
it("展示三个配置领域及草稿待办", async () => {
  renderSettings();
  expect(await screen.findByRole("heading", { name: "系统设置" })).toBeInTheDocument();
  expect(screen.getByText("SOP 配置")).toBeInTheDocument();
  expect(screen.getByText("评分阈值")).toBeInTheDocument();
  expect(screen.getByText("费率设置")).toBeInTheDocument();
  expect(screen.getByText("有未发布草稿")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行概览测试确认失败**

Run: `pnpm --filter @petcare/admin test -- src/pages/Settings/index.test.tsx`
Expected: FAIL，占位页没有配置卡片。

- [ ] **Step 3: 实现响应式配置控制台**

使用 TanStack Query 加载/错误/空状态；卡片展示当前版本、草稿状态、最近发布者和时间；使用语义化 heading、button/link、明显焦点样式和 44px 以上点击目标。

- [ ] **Step 4: 编写并实现三个强类型编辑器**

测试 SOP 服务类型切换与固定五步、评分/费率整数输入和字段错误、保存草稿后 revision 更新。组件只维护领域表单状态，`Edit.tsx` 负责请求和冲突恢复。

- [ ] **Step 5: 编写并实现差异确认、发布和历史恢复**

测试发布前字段级差异与影响说明、二次确认、提交时禁用、成功后失效概览/当前/草稿/历史 query；409 时关闭旧弹窗、保留本地输入、刷新服务端草稿并展示冲突提示。历史详情只读，“复制为新草稿”需要确认且无草稿时才可执行。

- [ ] **Step 6: 注册路由并运行页面测试**

Run: `pnpm --filter @petcare/admin test -- src/pages/Settings src/App.test.tsx`
Expected: PASS，键盘操作和主要状态均覆盖。

- [ ] **Step 7: 运行样式、类型和构建检查**

Run: `pnpm --filter @petcare/admin lint:styles && pnpm --filter @petcare/admin typecheck && pnpm --filter @petcare/admin build`
Expected: PASS，产物中无违规样式。

- [ ] **Step 8: 提交 Admin 页面**

```bash
git add apps/admin/src/pages/Settings apps/admin/src/App.tsx apps/admin/src/App.test.tsx
git commit -m "feat(settings): 实现后台配置控制台"
```

### Task 9: 补齐集成验收、文档和全量验证

**Files:**

- Create: `apps/server/test/system-settings.e2e-spec.ts`
- Create: `apps/admin/e2e/system-settings.spec.ts`
- Modify: `docs/06-api-specification/api-specification.md`
- Modify: `docs/01-requirements/01-prd.md`
- Modify: `docs/09-development-guidelines/05-frontend-structure-and-api-contracts.md`
- Modify: `docs/INDEX.md`

**Interfaces:**

- Consumes: Tasks 1–8 完整闭环。
- Produces: 可复现的 API、UI、订单快照和并发验收证据。

- [ ] **Step 1: 编写 Server E2E 场景**

覆盖：保存并发布 SOP、创建新订单获得新快照、旧订单快照不变、发布费率后新订单获得新计费快照、历史恢复再发布、陈旧 revision 返回 409、缺少权限返回 403、重复幂等键不重复发布。

- [ ] **Step 2: 运行 Server E2E 并修正集成问题**

Run: `pnpm --filter @petcare/server test:e2e -- system-settings.e2e-spec.ts`
Expected: PASS。

- [ ] **Step 3: 编写 Admin Playwright 闭环**

```typescript
test("管理员编辑、比较并发布费率草稿", async ({ page }) => {
  await loginAsDefaultAdmin(page);
  await page.goto("/settings");
  await page.getByRole("link", { name: /费率设置/ }).click();
  await page.getByLabel("平台抽成").fill("12");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await page.getByRole("button", { name: "查看差异并发布" }).click();
  await expect(page.getByText("10% → 12%")).toBeVisible();
  await page.getByRole("button", { name: "确认发布" }).click();
  await expect(page.getByText("发布成功")).toBeVisible();
});
```

- [ ] **Step 4: 运行 Admin E2E**

Run: `pnpm --filter @petcare/admin test:e2e -- system-settings.spec.ts`
Expected: PASS。

- [ ] **Step 5: 更新接口、PRD、规范和文档索引**

记录路由、permission code、稳定错误码、整数单位、发布/恢复流程、订单快照不变量和后续非目标；不写入 `.env` 或任何密钥。

- [ ] **Step 6: 执行全量校验**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm lint:styles && git diff --check`
Expected: 全部命令退出码为 0；Server coverage 无 Jest worker 未优雅退出警告。

- [ ] **Step 7: 检查数据库重置授权边界**

仅输出待执行命令 `pnpm --filter @petcare/server prisma:push --force-reset && pnpm --filter @petcare/server prisma:seed`，不得在没有用户当次明确授权时执行。

- [ ] **Step 8: 提交验收和文档**

```bash
git add apps/server/test/system-settings.e2e-spec.ts apps/admin/e2e/system-settings.spec.ts docs
git commit -m "test(settings): 完成系统设置闭环验收"
```

## 自检结果

- 规格覆盖：三个领域、发布内核、权限、审计、差异、恢复、订单快照、评分资格、Admin 交互、初始数据和非目标均有对应任务。
- 占位符扫描：所有步骤都包含具体文件、接口、代码、命令和预期结果。
- 类型一致性：领域名称固定为 `sop`、`rating-threshold`、`fee`；并发字段固定为 `revision`；发布幂等字段固定为 `idempotencyKey`；分页形状固定为 `list/total/page/pageSize`。
- 风险控制：数据库 reset/seed 与代码实施分离，必须获得当次明确授权；已发布历史不可变，发布和订单快照均在事务中完成。
