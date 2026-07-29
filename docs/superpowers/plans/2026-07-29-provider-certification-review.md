# 宠托师认证审核 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在后台用户管理中实现宠托师认证申请列表、详情、审核通过和填写原因驳回的完整闭环。

**Architecture:** 使用独立的 `ProviderCertificationApplication` 保存每次申请和审核历史，`Provider` 只保存当前生效认证结果。共享契约由 `@petcare/shared-types` 提供，Server DTO 负责校验和 Swagger，Admin API 层负责请求，页面按用户管理子模块组织。

**Tech Stack:** Prisma 7、PostgreSQL、NestJS 11、React 19、React Router、TanStack Query、Tailwind CSS 4、Jest、Vitest。

## Global Constraints

- 不使用 Prisma migration；项目处于建表初期，使用 schema 与 `prisma db push` 同步。
- 请求、响应和业务状态只能定义在 `@petcare/shared-types`。
- Admin API 只能放在 `apps/admin/src/api/`。
- 页面入口使用 `index.tsx`，详情页使用 `Detail.tsx`。
- 驳回原因去除首尾空白后长度必须为 2–500 个字符。
- 只有 `pending` 申请可审核；重复或并发审核返回冲突错误。
- 审核通过与 Provider 状态更新必须位于同一事务。
- 身份资料只返回脱敏结果，审核管理员从 Access Token 获取。
- 所有共享类型字段、状态值、导出函数和公共服务方法必须有中文 JSDoc。

---

### Task 1: 建立认证申请数据模型和共享契约

**Files:**

- Modify: `apps/server/prisma/schema.prisma`
- Create: `packages/shared-types/src/api/provider-certification.ts`
- Modify: `packages/shared-types/src/api/index.ts`
- Test: `packages/shared-types/src/api/provider-certification.spec.ts`

**Interfaces:**

- Produces: `PROVIDER_CERTIFICATION_STATUS`
- Produces: `ProviderCertificationStatus`
- Produces: `AdminProviderCertificationListQuery`
- Produces: `AdminProviderCertificationListItem`
- Produces: `AdminProviderCertificationDetail`
- Produces: `RejectProviderCertificationRequest`
- Produces: `AdminProviderCertificationListResponse`

- [ ] **Step 1: 编写失败的共享契约测试**

```typescript
import { describe, expect, it } from "vitest";
import { PROVIDER_CERTIFICATION_STATUS } from "./provider-certification";

describe("provider certification contract", () => {
  it("exports the complete review statuses", () => {
    expect(Object.values(PROVIDER_CERTIFICATION_STATUS)).toEqual([
      "pending",
      "approved",
      "rejected",
    ]);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @petcare/shared-types test -- provider-certification.spec.ts`

Expected: FAIL，提示模块或导出不存在。

- [ ] **Step 3: 添加 Prisma 模型**

```prisma
model ProviderCertificationApplication {
  id                String    @id @default(uuid())
  applicantId       String    @map("applicant_id")
  realNameMasked    String    @map("real_name_masked")
  idCardMasked      String    @map("id_card_masked")
  idCardFrontUrl    String    @map("id_card_front_url")
  idCardBackUrl     String    @map("id_card_back_url")
  wechatScore       Int?      @map("wechat_score")
  trainingPassed    Boolean   @default(false) @map("training_passed")
  status            String    @default("pending")
  rejectReason      String?   @map("reject_reason")
  reviewedById      String?   @map("reviewed_by_id")
  reviewedAt        DateTime? @map("reviewed_at")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  applicant User  @relation("CertificationApplicant", fields: [applicantId], references: [id], onDelete: Cascade)
  reviewedBy User? @relation("CertificationReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([status, createdAt])
  @@index([applicantId, createdAt])
  @@map("provider_certification_applications")
}
```

同步给 `User` 添加 `certificationApplications` 与 `reviewedCertificationApplications` 两个命名关系。

- [ ] **Step 4: 实现带字段 JSDoc 的共享契约并从包入口导出**

关键签名：

```typescript
export const PROVIDER_CERTIFICATION_STATUS = {
  /** 等待管理员审核。 */
  PENDING: "pending",
  /** 审核通过并授予宠托师认证。 */
  APPROVED: "approved",
  /** 审核驳回，允许用户重新申请。 */
  REJECTED: "rejected",
} as const;

export interface RejectProviderCertificationRequest {
  /** 驳回原因，去除首尾空白后长度为 2–500。 */
  reason: string;
}
```

- [ ] **Step 5: 格式化、生成 Prisma Client 并运行测试**

Run:

```bash
pnpm --filter @petcare/server exec prisma format
pnpm --filter @petcare/server prisma:generate
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/shared-types typecheck
```

Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add apps/server/prisma/schema.prisma packages/shared-types/src/api
git commit -m "feat(certification): 新增宠托师认证申请模型"
```

### Task 2: 实现服务端查询接口

**Files:**

- Create: `apps/server/src/modules/provider-certification/provider-certification.module.ts`
- Create: `apps/server/src/modules/provider-certification/provider-certification.service.ts`
- Create: `apps/server/src/modules/provider-certification/provider-certification.service.spec.ts`
- Create: `apps/server/src/modules/provider-certification/admin-provider-certification.controller.ts`
- Create: `apps/server/src/modules/provider-certification/dto/admin-provider-certification-list-query.dto.ts`
- Create: `apps/server/src/modules/provider-certification/dto/provider-certification-response.dto.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- Consumes: `AdminProviderCertificationListQuery`
- Produces: `ProviderCertificationService.findAdminPage(query)`
- Produces: `ProviderCertificationService.findAdminDetail(id)`

- [ ] **Step 1: 编写列表和详情失败测试**

```typescript
it("returns pending applications before completed applications", async () => {
  prisma.providerCertificationApplication.findMany.mockResolvedValue([]);
  prisma.providerCertificationApplication.count.mockResolvedValue(0);

  await service.findAdminPage({ page: 1, pageSize: 20 });

  expect(prisma.providerCertificationApplication.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      orderBy: [{ reviewedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    }),
  );
});

it("throws RESOURCE_NOT_FOUND when detail does not exist", async () => {
  prisma.providerCertificationApplication.findUnique.mockResolvedValue(null);
  await expect(service.findAdminDetail("missing")).rejects.toMatchObject({
    code: "RESOURCE_NOT_FOUND",
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @petcare/server test -- provider-certification.service.spec.ts --runInBand`

Expected: FAIL，服务或方法尚不存在。

- [ ] **Step 3: 实现查询服务**

使用显式 `select` 返回申请人安全字段、脱敏身份资料和审核管理员摘要。关键词匹配手机号、账号、昵称；
状态筛选仅接受共享状态常量。列表按 `reviewedAt desc nulls first` 让未审核记录稳定排在最前，
再按 `createdAt desc` 排列同组申请，禁止依赖状态字符串的字母顺序。

- [ ] **Step 4: 实现 DTO、Controller 和模块注册**

```typescript
@ApiTags("admin-provider-certifications")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, AdminGuard)
@Controller("admin/provider-certifications")
export class AdminProviderCertificationController {
  @Get()
  findAll(@Query() query: AdminProviderCertificationListQueryDto) {
    return this.service.findAdminPage(query);
  }

  @Get(":id")
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.findAdminDetail(id);
  }
}
```

响应 DTO 必须实现共享接口并由 `ApiSuccessResponse` 声明 Swagger 返回类型。

- [ ] **Step 5: 运行相关测试、类型和 Swagger 测试**

Run:

```bash
pnpm --filter @petcare/server test -- provider-certification swagger-responses --runInBand
pnpm --filter @petcare/server typecheck
```

Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add apps/server/src
git commit -m "feat(certification): 新增认证申请查询接口"
```

### Task 3: 实现通过和驳回审核

**Files:**

- Modify: `apps/server/src/modules/provider-certification/provider-certification.service.ts`
- Modify: `apps/server/src/modules/provider-certification/provider-certification.service.spec.ts`
- Modify: `apps/server/src/modules/provider-certification/admin-provider-certification.controller.ts`
- Create: `apps/server/src/modules/provider-certification/dto/reject-provider-certification.dto.ts`

**Interfaces:**

- Produces: `ProviderCertificationService.approve(id, reviewerId)`
- Produces: `ProviderCertificationService.reject(id, reviewerId, reason)`

- [ ] **Step 1: 编写审核行为失败测试**

```typescript
it("approves the application and provider in one transaction", async () => {
  transaction.providerCertificationApplication.updateMany.mockResolvedValue({ count: 1 });

  await service.approve(applicationId, reviewerId);

  expect(transaction.provider.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { userId: applicantId },
      update: { certifiedSitter: true },
    }),
  );
});

it("rejects a repeated review with REVIEW_CONFLICT", async () => {
  transaction.providerCertificationApplication.updateMany.mockResolvedValue({ count: 0 });
  await expect(service.reject(applicationId, reviewerId, "资料不清晰")).rejects.toMatchObject({
    code: "REVIEW_CONFLICT",
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @petcare/server test -- provider-certification.service.spec.ts --runInBand`

Expected: FAIL，审核方法尚不存在。

- [ ] **Step 3: 实现事务审核**

在 `$transaction` 内执行：

```typescript
const updated = await tx.providerCertificationApplication.updateMany({
  where: { id, status: PROVIDER_CERTIFICATION_STATUS.PENDING },
  data: {
    status: PROVIDER_CERTIFICATION_STATUS.APPROVED,
    reviewedById: reviewerId,
    reviewedAt: new Date(),
    rejectReason: null,
  },
});

if (updated.count === 0) {
  throw new ApiException("REVIEW_CONFLICT", "该申请已被处理", HttpStatus.CONFLICT);
}
```

通过后 `upsert` Provider 并设置 `idCardVerified`、`trainingPassed`、`certifiedSitter` 和 `wechatScore`；
驳回则保存 `reason.trim()`，不更新 Provider。

- [ ] **Step 4: 实现审核 DTO 和 Controller**

Controller 从 `request.user.sub` 获取 reviewerId：

```typescript
@Post(":id/approve")
approve(@Param("id", new ParseUUIDPipe()) id: string, @Req() request: AuthRequest) {
  return this.service.approve(id, request.user!.sub);
}
```

`RejectProviderCertificationDto` 实现共享请求接口，并使用 `@Transform(({ value }) => value.trim())`、
`@IsString()`、`@Length(2, 500)`。

- [ ] **Step 5: 运行服务端完整校验**

Run:

```bash
pnpm --filter @petcare/server test -- --runInBand
pnpm --filter @petcare/server lint
pnpm --filter @petcare/server build
```

Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add apps/server/src
git commit -m "feat(certification): 实现宠托师认证审核"
```

### Task 4: 实现 Admin API 和认证申请列表

**Files:**

- Create: `apps/admin/src/api/provider-certifications.ts`
- Create: `apps/admin/src/api/provider-certifications.test.ts`
- Create: `apps/admin/src/pages/UserManagement/Navigation.tsx`
- Create: `apps/admin/src/pages/UserManagement/Certification/index.tsx`
- Create: `apps/admin/src/pages/UserManagement/Certification/index.test.tsx`
- Modify: `apps/admin/src/pages/UserManagement/index.tsx`
- Modify: `apps/admin/src/App.tsx`

**Interfaces:**

- Consumes: `AdminProviderCertificationListQuery`
- Produces: `fetchAdminProviderCertifications`
- Produces: `/users/certifications` 页面路由

- [ ] **Step 1: 编写 API 与列表失败测试**

```typescript
it("requests the filtered certification page", async () => {
  await fetchAdminProviderCertifications({ page: 1, pageSize: 20, status: "pending" });
  expect(apiClient.get).toHaveBeenCalledWith("/admin/provider-certifications", {
    params: { page: 1, pageSize: 20, status: "pending" },
  });
});
```

列表测试验证标题、默认待审核筛选、关键词提交、分页和空状态。

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @petcare/admin test -- provider-certifications Certification/index`

Expected: FAIL，API 和页面不存在。

- [ ] **Step 3: 实现 API 函数**

```typescript
export async function fetchAdminProviderCertifications(
  params: AdminProviderCertificationListQuery,
): Promise<AdminProviderCertificationListResponse> {
  const response = await apiClient.get<AdminProviderCertificationListResponse>(
    "/admin/provider-certifications",
    { params },
  );
  return response.data;
}
```

- [ ] **Step 4: 实现用户管理二级导航和列表页面**

`Navigation.tsx` 提供“用户列表”和“认证审核”两个 `NavLink`。列表页面使用 TanStack Query，
查询键为 `["admin-provider-certifications", filters]`，直接使用 Tailwind 工具类，不新增页面 SCSS。

- [ ] **Step 5: 注册嵌套路由**

```tsx
<Route path="users" element={<UserManagement />} />
<Route path="users/certifications" element={<ProviderCertificationList />} />
<Route path="users/certifications/:id" element={<ProviderCertificationDetail />} />
```

- [ ] **Step 6: 运行 Admin 相关校验**

Run:

```bash
pnpm --filter @petcare/admin test -- provider-certifications UserManagement
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin typecheck
```

Expected: 全部通过。

- [ ] **Step 7: 提交**

```bash
git add apps/admin/src
git commit -m "feat(admin): 新增宠托师认证审核列表"
```

### Task 5: 实现认证详情和审核交互

**Files:**

- Modify: `apps/admin/src/api/provider-certifications.ts`
- Modify: `apps/admin/src/api/provider-certifications.test.ts`
- Create: `apps/admin/src/pages/UserManagement/Certification/Detail.tsx`
- Create: `apps/admin/src/pages/UserManagement/Certification/Detail.test.tsx`

**Interfaces:**

- Produces: `fetchAdminProviderCertification(id)`
- Produces: `approveAdminProviderCertification(id)`
- Produces: `rejectAdminProviderCertification(id, request)`

- [ ] **Step 1: 编写详情和审核失败测试**

详情测试覆盖资料展示、已完成申请只读、通过确认、驳回原因校验、成功导航或刷新，以及
`REVIEW_CONFLICT` 错误提示。

```typescript
it("requires a reject reason between 2 and 500 characters", async () => {
  await user.click(screen.getByRole("button", { name: "驳回申请" }));
  await user.type(screen.getByLabelText("驳回原因"), "a");
  await user.click(screen.getByRole("button", { name: "确认驳回" }));
  expect(screen.getByText("驳回原因需填写 2 至 500 个字符")).toBeInTheDocument();
  expect(rejectAdminProviderCertification).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @petcare/admin test -- Certification/Detail`

Expected: FAIL，详情页面和审核 API 尚不存在。

- [ ] **Step 3: 实现详情与审核 API**

```typescript
export async function rejectAdminProviderCertification(
  id: string,
  request: RejectProviderCertificationRequest,
): Promise<AdminProviderCertificationDetail> {
  const response = await apiClient.post<AdminProviderCertificationDetail>(
    `/admin/provider-certifications/${id}/reject`,
    request,
  );
  return response.data;
}
```

- [ ] **Step 4: 实现详情页面**

页面按申请人、认证资料、审核记录分区。通过使用二次确认对话框；驳回使用带字符计数和内联错误的表单。
mutation 成功后使列表查询失效并刷新详情；409 冲突显示“该申请已由其他管理员处理”，随后刷新详情。

- [ ] **Step 5: 运行 Admin 完整校验**

Run:

```bash
pnpm --filter @petcare/admin test
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin build
```

Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add apps/admin/src
git commit -m "feat(admin): 完成宠托师认证审核交互"
```

### Task 6: 更新接口文档并执行整体验证

**Files:**

- Modify: `docs/06-api-specification/01-api-specification.md`
- Modify: `docs/01-requirements/01-prd.md`

**Interfaces:**

- Consumes: Tasks 1–5 的最终路由、状态和响应字段。

- [ ] **Step 1: 更新 API 与 PRD 状态**

补充四个管理员接口、分页筛选、审核状态、409 冲突语义、脱敏约束，并将对应后台认证审核能力标记为已实现。

- [ ] **Step 2: 运行数据库与共享包校验**

Run:

```bash
pnpm --filter @petcare/server exec prisma validate
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/shared-types lint
pnpm --filter @petcare/shared-types build
```

Expected: 全部通过。

- [ ] **Step 3: 运行 Server 完整校验**

Run:

```bash
pnpm --filter @petcare/server test -- --runInBand
pnpm --filter @petcare/server lint
pnpm --filter @petcare/server build
```

Expected: 全部通过且无 Jest worker 未优雅退出警告。

- [ ] **Step 4: 运行 Admin 完整校验**

Run:

```bash
pnpm --filter @petcare/admin test
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin build
```

Expected: 全部通过，包括样式策略和生产样式产物检查。

- [ ] **Step 5: 检查差异并提交文档**

Run:

```bash
git diff --check
git status --short
```

确认 `.workbuddy/` 未被暂存，然后执行：

```bash
git add docs/01-requirements/01-prd.md docs/06-api-specification/01-api-specification.md
git commit -m "docs(certification): 补充宠托师认证审核接口"
```
