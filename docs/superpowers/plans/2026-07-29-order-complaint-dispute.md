# Order Complaint and Dispute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete order complaint workflow from complaint creation through first response, assignment, initial decision, second appeal, final decision, automatic closure, and idempotent internal execution.

**Architecture:** Add a dedicated `complaint-dispute` module whose aggregate root owns an explicit state machine. Keep statements, decisions, assignments, timeline events, and execution tasks immutable and separate, while all transitions are validated and persisted transactionally by focused services. Share every request and response contract through `@petcare/shared-types`, then expose user APIs and an Admin work queue with a dossier-style detail page and sticky decision workbench.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, React 19, React Router, TanStack Query, Tailwind CSS v4, Jest, Vitest, Testing Library.

## Global Constraints

- The feature belongs under Order Management and uses `/orders/complaints` for the Admin route.
- The full workflow is complaint → first response → initial decision → second appeal → final decision.
- Each side may submit one second appeal within 72 hours after the initial decision.
- A second appeal must contain a new reason or at least one new evidence URL.
- Final decisions close the case and cannot be appealed again.
- Refund, settlement, and credit effects are internal idempotent tasks; do not call WeChat Pay in this implementation.
- Only the assigned administrator or a super administrator may decide a case.
- Administrators may not claim or decide a case in which they are an order party.
- Money is stored as integer minor currency units; no dispute or order money field may use `Float`.
- API list responses use exactly `list`, `total`, `page`, and `pageSize`.
- Request and response contracts are shared through `@petcare/shared-types`.
- Admin and Miniapp API calls live under their `api` directories.
- Admin pages use module directories with `index.tsx` for lists and `Detail.tsx` for details.
- Functions and contract properties require concise Chinese comments.
- Admin and Miniapp styles use Tailwind utilities first; no arbitrary-value classes.
- No Prisma migration is required because the project is still in initial schema development; validate, generate, and reset the local database directly.

---

## File Map

### Shared contracts

- Create `packages/shared-types/src/api/complaint-dispute.ts`: states, actions, request types, list/detail models, timeline, decisions, and execution tasks.
- Create `packages/shared-types/src/api/complaint-dispute.spec.ts`: contract invariants and allowed-action coverage.
- Modify `packages/shared-types/src/api/index.ts`: export the new contracts.
- Modify `packages/shared-types/src/enums/index.ts`: remove the older duplicate complaint enums after consumers move to the API contract constants.

### Database and Server

- Modify `apps/server/prisma/schema.prisma`: replace the existing complaint/resolution schema, add immutable workflow models, and convert order money fields to integer minor units.
- Create `apps/server/src/modules/complaint-dispute/complaint-dispute.module.ts`: module composition.
- Create `apps/server/src/modules/complaint-dispute/complaint-state-machine.ts`: pure transition and action rules.
- Create `apps/server/src/modules/complaint-dispute/complaint-state-machine.spec.ts`: exhaustive state tests.
- Create `apps/server/src/modules/complaint-dispute/complaint-query.service.ts`: user and Admin read models.
- Create `apps/server/src/modules/complaint-dispute/complaint-command.service.ts`: user complaint, response, appeal, withdrawal, assignment, and transfer commands.
- Create `apps/server/src/modules/complaint-dispute/dispute-decision.service.ts`: initial/final decisions and transactional execution task creation.
- Create `apps/server/src/modules/complaint-dispute/dispute-execution.service.ts`: idempotent internal task execution and retry.
- Create `apps/server/src/modules/complaint-dispute/complaint-deadline.service.ts`: close expired appeal windows and execute due tasks.
- Create focused `*.spec.ts` files beside each service.
- Create `apps/server/src/modules/complaint-dispute/complaint.controller.ts`: authenticated user endpoints.
- Create `apps/server/src/modules/complaint-dispute/admin-complaint.controller.ts`: guarded Admin endpoints.
- Create `apps/server/src/modules/complaint-dispute/dto/*.dto.ts`: validated input/query DTOs and explicit Swagger response DTOs.
- Modify `apps/server/src/app.module.ts`: register the module.
- Modify `apps/server/src/modules/order/order.service.ts` and its test: treat money as integer minor units.

### Admin

- Create `apps/admin/src/api/complaints.ts` and `complaints.test.ts`: all Admin complaint calls.
- Create `apps/admin/src/pages/OrderManagement/Navigation.tsx`: order subnavigation.
- Modify `apps/admin/src/pages/OrderManagement/index.tsx`: render the subnavigation.
- Create `apps/admin/src/pages/OrderManagement/Complaint/index.tsx` and `index.test.tsx`: work queue.
- Create `apps/admin/src/pages/OrderManagement/Complaint/Detail.tsx` and `Detail.test.tsx`: dossier and sticky workbench.
- Create `apps/admin/src/pages/OrderManagement/Complaint/DecisionDialog.tsx`: validated high-risk decision confirmation.
- Create `apps/admin/src/pages/OrderManagement/Complaint/TransferDialog.tsx`: transfer form.
- Modify `apps/admin/src/App.tsx`: register list and detail routes.
- Update `apps/admin/src/components/Sidebar.test.tsx` only if route-active assertions require the new nested path.

### Miniapp and documentation

- Create `apps/miniapp/src/api/complaints.ts` and `complaints.test.ts`: typed user-side calls needed by the workflow.
- Modify `docs/06-api-specification/01-api-specification.md`: user and Admin endpoints, state values, error codes, and response examples.

---

### Task 1: Shared Complaint Contracts and State Vocabulary

**Files:**

- Create: `packages/shared-types/src/api/complaint-dispute.ts`
- Create: `packages/shared-types/src/api/complaint-dispute.spec.ts`
- Modify: `packages/shared-types/src/api/index.ts`
- Modify: `packages/shared-types/src/enums/index.ts`

**Interfaces:**

- Produces: `COMPLAINT_STATUS`, `ComplaintStatus`, `COMPLAINT_ACTION`, `ComplaintAction`, `DECISION_LEVEL`, `DecisionLevel`, `CreateComplaintRequest`, `SubmitComplaintStatementRequest`, `AdminComplaintListQuery`, `AdminComplaintListResponse`, `ComplaintDetail`, `SubmitDisputeDecisionRequest`, and `DisputeExecutionTaskView`.
- Consumers: all later Server, Admin, and Miniapp tasks.

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  COMPLAINT_ACTION,
  COMPLAINT_STATUS,
  DECISION_LEVEL,
  type AdminComplaintListResponse,
} from "./complaint-dispute";

describe("complaint dispute contracts", () => {
  it("exposes every state required by the two-level decision workflow", () => {
    expect(Object.values(COMPLAINT_STATUS)).toEqual([
      "pending_response",
      "unassigned",
      "processing_initial",
      "initial_decided",
      "processing_final",
      "closed",
      "withdrawn",
    ]);
    expect(Object.values(DECISION_LEVEL)).toEqual(["initial", "final"]);
  });

  it("keeps admin pagination in the shared response shape", () => {
    const response: AdminComplaintListResponse = {
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };
    expect(Object.keys(response)).toEqual(["list", "total", "page", "pageSize"]);
  });

  it("defines server-controlled allowed actions", () => {
    expect(COMPLAINT_ACTION).toMatchObject({
      RESPOND: "respond",
      SECOND_APPEAL: "second_appeal",
      CLAIM: "claim",
      TRANSFER: "transfer",
      INITIAL_DECIDE: "initial_decide",
      FINAL_DECIDE: "final_decide",
      RETRY_EXECUTION: "retry_execution",
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```bash
pnpm --filter @petcare/shared-types test -- src/api/complaint-dispute.spec.ts
```

Expected: FAIL because `./complaint-dispute` does not exist.

- [ ] **Step 3: Add the shared constants and documented contracts**

Use literal objects rather than TypeScript enums:

```ts
import type { PaginatedResponse } from "./response";

/** 投诉纠纷的当前处理阶段。 */
export const COMPLAINT_STATUS = {
  PENDING_RESPONSE: "pending_response",
  UNASSIGNED: "unassigned",
  PROCESSING_INITIAL: "processing_initial",
  INITIAL_DECIDED: "initial_decided",
  PROCESSING_FINAL: "processing_final",
  CLOSED: "closed",
  WITHDRAWN: "withdrawn",
} as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUS)[keyof typeof COMPLAINT_STATUS];

/** 裁决层级。 */
export const DECISION_LEVEL = {
  INITIAL: "initial",
  FINAL: "final",
} as const;

export type DecisionLevel = (typeof DECISION_LEVEL)[keyof typeof DECISION_LEVEL];

export interface SubmitDisputeDecisionRequest {
  /** 责任划分。 */
  liability: "complainant" | "respondent" | "shared" | "insufficient_evidence";
  /** 裁决理由，去除首尾空白后长度为 10–2000。 */
  reason: string;
  /** 退还投诉方的金额，单位为分。 */
  refundAmount: number;
  /** 结算给服务方的金额，单位为分。 */
  settlementAmount: number;
  /** 投诉方信用分调整，范围为 -100 至 100。 */
  complainantCreditDelta: number;
  /** 被投诉方信用分调整，范围为 -100 至 100。 */
  respondentCreditDelta: number;
  /** 客户端读取详情时获得的并发版本。 */
  version: number;
}

export type AdminComplaintListResponse = PaginatedResponse<AdminComplaintListItem>;
```

Define the remaining properties explicitly in the same file, including Chinese comments for every field. `ComplaintDetail` must include `allowedActions: ComplaintAction[]` so clients never duplicate transition rules.

- [ ] **Step 4: Export the module and remove duplicate legacy enums**

Add:

```ts
export * from "./complaint-dispute";
```

to `packages/shared-types/src/api/index.ts`. Remove only `ComplaintType` and `ComplaintStatus` from `packages/shared-types/src/enums/index.ts` after `rg` confirms there are no remaining consumers.

- [ ] **Step 5: Run shared tests, typecheck, and commit**

Run:

```bash
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/shared-types typecheck
```

Expected: all shared tests and typechecking PASS.

Commit:

```bash
git add packages/shared-types/src
git commit -m "feat(complaint): 统一投诉纠纷共享契约"
```

---

### Task 2: Prisma Aggregate and Integer Money

**Files:**

- Modify: `apps/server/prisma/schema.prisma`
- Modify: `apps/server/src/modules/order/order.service.ts`
- Modify: `apps/server/src/modules/order/order.service.spec.ts`

**Interfaces:**

- Consumes: literal values from Task 1 as persisted string values.
- Produces: Prisma delegates for `complaint`, `complaintStatement`, `disputeDecision`, `complaintAssignment`, `complaintEvent`, and `disputeExecutionTask`.

- [ ] **Step 1: Add failing order money tests**

Add assertions showing API amounts are integer minor units:

```ts
it("stores reward order money as integer minor units", async () => {
  prisma.order.create.mockResolvedValue({ id: "order-1" });

  await service.createRewardOrder(
    {
      serviceType: "feeding",
      petId: "pet-1",
      serviceTime: "2026-08-01T10:00:00.000Z",
      address: "测试地址",
      amount: 12500,
      remark: "",
    },
    "owner-1",
  );

  expect(prisma.order.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ amount: 12500 }),
    }),
  );
});
```

- [ ] **Step 2: Run the order service test**

Run:

```bash
pnpm --filter @petcare/server test -- src/modules/order/order.service.spec.ts --runInBand
```

Expected: FAIL if existing fixtures or conversions still model major-unit floats.

- [ ] **Step 3: Replace the old complaint schema**

Delete the existing one-to-one `Complaint` and `DisputeResolution` models. Add relations for complainant, respondent, assignee, actors, and execution tasks. Use this shape:

```prisma
model Complaint {
  id                     String    @id @default(uuid())
  orderId                String    @map("order_id")
  complainantId          String    @map("complainant_id")
  respondentId           String    @map("respondent_id")
  assignedAdminId        String?   @map("assigned_admin_id")
  complaintType          String    @map("complaint_type")
  expectedSolution       String?   @map("expected_solution")
  status                 String    @default("pending_response")
  appealDeadlineAt       DateTime? @map("appeal_deadline_at")
  version                Int       @default(1)
  createdAt              DateTime  @default(now()) @map("created_at")
  updatedAt              DateTime  @updatedAt @map("updated_at")
  closedAt               DateTime? @map("closed_at")

  statements      ComplaintStatement[]
  decisions       DisputeDecision[]
  assignments     ComplaintAssignment[]
  events          ComplaintEvent[]
  executionTasks  DisputeExecutionTask[]

  @@index([status, assignedAdminId])
  @@index([orderId, status])
  @@index([appealDeadlineAt])
  @@map("complaints")
}
```

Add `@@unique([complaintId, stage, authorId])` to statements, `@@unique([complaintId, level])` to decisions, and `idempotencyKey String @unique` to execution tasks. Do not make `Complaint.orderId` globally unique; enforce one open complaint per order transactionally.

- [ ] **Step 4: Convert order money columns to integer minor units**

Change `Order.amount`, `OrderReward.rewardAmount`, `OrderReward.priceRangeMin`, and `OrderReward.priceRangeMax` from `Float` to `Int`. Keep API values as integer cents without multiplying or dividing in the Server.

- [ ] **Step 5: Format, validate, generate, and run focused tests**

Run:

```bash
pnpm --filter @petcare/server exec prisma format
pnpm --filter @petcare/server exec prisma validate
pnpm --filter @petcare/server prisma:generate
pnpm --filter @petcare/server test -- src/modules/order/order.service.spec.ts --runInBand
```

Expected: Prisma validation and order tests PASS.

- [ ] **Step 6: Commit the schema boundary**

```bash
git add apps/server/prisma/schema.prisma apps/server/src/modules/order
git commit -m "feat(complaint): 建立纠纷聚合数据模型"
```

---

### Task 3: Pure State Machine

**Files:**

- Create: `apps/server/src/modules/complaint-dispute/complaint-state-machine.ts`
- Create: `apps/server/src/modules/complaint-dispute/complaint-state-machine.spec.ts`

**Interfaces:**

- Consumes: `ComplaintStatus`, `ComplaintAction`, and `DECISION_LEVEL` from Task 1.
- Produces: `getAllowedComplaintActions(context): ComplaintAction[]` and `assertComplaintAction(context, action): void`.

- [ ] **Step 1: Write exhaustive failing transition tests**

```ts
describe("getAllowedComplaintActions", () => {
  it("allows only the respondent to answer a pending complaint", () => {
    expect(
      getAllowedComplaintActions(base({ status: "pending_response", viewerRole: "respondent" })),
    ).toContain("respond");
    expect(
      getAllowedComplaintActions(base({ status: "pending_response", viewerRole: "complainant" })),
    ).toContain("withdraw");
  });

  it("opens second appeals until the exact deadline", () => {
    const deadline = new Date("2026-08-04T00:00:00.000Z");
    expect(
      getAllowedComplaintActions(
        base({
          status: "initial_decided",
          viewerRole: "complainant",
          now: new Date("2026-08-03T23:59:59.999Z"),
          appealDeadlineAt: deadline,
          hasSecondAppealed: false,
        }),
      ),
    ).toContain("second_appeal");
    expect(
      getAllowedComplaintActions(
        base({
          status: "initial_decided",
          viewerRole: "complainant",
          now: deadline,
          appealDeadlineAt: deadline,
          hasSecondAppealed: false,
        }),
      ),
    ).not.toContain("second_appeal");
  });

  it("never exposes an action after closure", () => {
    expect(getAllowedComplaintActions(base({ status: "closed" }))).toEqual([]);
  });
});
```

Cover every state, party role, assigned Admin, super Admin override, self-dealing Admin, duplicate statement, and deadline boundary in a table-driven suite.

- [ ] **Step 2: Run the state-machine test**

Run:

```bash
pnpm --filter @petcare/server test -- src/modules/complaint-dispute/complaint-state-machine.spec.ts --runInBand
```

Expected: FAIL because the state-machine file does not exist.

- [ ] **Step 3: Implement the pure context and rule functions**

```ts
export interface ComplaintActionContext {
  status: ComplaintStatus;
  viewerId: string;
  viewerRole: "complainant" | "respondent" | "admin" | "other";
  assignedAdminId: string | null;
  isSuperAdmin: boolean;
  isOrderParty: boolean;
  appealDeadlineAt: Date | null;
  hasSecondAppealed: boolean;
  hasFailedExecution: boolean;
  now: Date;
}

export function assertComplaintAction(
  context: ComplaintActionContext,
  action: ComplaintAction,
): void {
  if (!getAllowedComplaintActions(context).includes(action)) {
    throw new ApiException(
      "COMPLAINT_ACTION_NOT_ALLOWED",
      "当前投诉状态不允许执行该操作",
      HttpStatus.CONFLICT,
    );
  }
}
```

Keep this file free of Prisma calls. It decides actions only from the supplied context.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
pnpm --filter @petcare/server test -- src/modules/complaint-dispute/complaint-state-machine.spec.ts --runInBand
```

Expected: all state-machine cases PASS.

Commit:

```bash
git add apps/server/src/modules/complaint-dispute/complaint-state-machine*
git commit -m "feat(complaint): 实现纠纷显式状态机"
```

---

### Task 4: User Complaint Commands, Queries, and APIs

**Files:**

- Create: `apps/server/src/modules/complaint-dispute/complaint-command.service.ts`
- Create: `apps/server/src/modules/complaint-dispute/complaint-command.service.spec.ts`
- Create: `apps/server/src/modules/complaint-dispute/complaint-query.service.ts`
- Create: `apps/server/src/modules/complaint-dispute/complaint-query.service.spec.ts`
- Create: `apps/server/src/modules/complaint-dispute/complaint.controller.ts`
- Create: `apps/server/src/modules/complaint-dispute/dto/create-complaint.dto.ts`
- Create: `apps/server/src/modules/complaint-dispute/dto/submit-complaint-statement.dto.ts`
- Create: `apps/server/src/modules/complaint-dispute/dto/complaint-response.dto.ts`

**Interfaces:**

- Consumes: Task 1 contracts, Task 2 Prisma models, and Task 3 action validation.
- Produces: `createComplaint`, `respond`, `submitSecondAppeal`, `withdraw`, `findMine`, and `findForUser`.

- [ ] **Step 1: Write failing command tests**

Test these exact behaviors:

```ts
it("creates a complaint for an order party and records the first event", async () => {
  prisma.order.findUnique.mockResolvedValue({
    id: "order-1",
    ownerId: "owner-1",
    providerId: "provider-1",
    status: "completed",
  });

  await service.createComplaint("owner-1", {
    orderId: "order-1",
    complaintType: "service_quality",
    reason: "服务过程与约定不符",
    evidenceUrls: ["https://cdn.example/evidence.jpg"],
    expectedSolution: "申请部分退款",
  });

  expect(prisma.$transaction).toHaveBeenCalled();
});

it.each([
  ["not an order party", "stranger-1", "FORBIDDEN"],
  ["open complaint exists", "owner-1", "OPEN_COMPLAINT_EXISTS"],
])("rejects %s", async (_label, actorId, code) => {
  await expect(service.createComplaint(actorId, validRequest)).rejects.toMatchObject({ code });
});
```

Also test one first response, one second appeal per party, mandatory new material, withdrawal before initial decision, and rejection at/after the deadline.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
pnpm --filter @petcare/server test -- src/modules/complaint-dispute/complaint-command.service.spec.ts src/modules/complaint-dispute/complaint-query.service.spec.ts --runInBand
```

Expected: FAIL because the services are missing.

- [ ] **Step 3: Implement transactional user commands**

Use `AccessTokenPayload.sub` as the actor. Determine respondent from the order party opposite the complainant. For create, use a transaction and query for any complaint on the same order whose status is not `closed` or `withdrawn` before inserting.

Use conditional updates such as:

```ts
const updated = await transaction.complaint.updateMany({
  where: { id, status: COMPLAINT_STATUS.PENDING_RESPONSE, version },
  data: {
    status: COMPLAINT_STATUS.UNASSIGNED,
    version: { increment: 1 },
  },
});

if (updated.count === 0) {
  throw new ApiException(
    "COMPLAINT_STATE_CONFLICT",
    "投诉状态已变化，请刷新后重试",
    HttpStatus.CONFLICT,
  );
}
```

Write a `ComplaintEvent` in the same transaction as every command.

- [ ] **Step 4: Implement user read models and server-controlled actions**

`findForUser(id, userId, now)` must verify party membership, load statements/decisions/events, and call `getAllowedComplaintActions` with that viewer’s context. Serialize every date to ISO 8601 strings.

- [ ] **Step 5: Add guarded controllers, validation, and Swagger DTOs**

Use `@UseGuards(AccessTokenGuard)`, `@ApiBearerAuth()`, `ParseUUIDPipe`, explicit success DTOs, and standard error decorators. Endpoints:

```text
POST /complaints
GET  /complaints
GET  /complaints/:id
POST /complaints/:id/respond
POST /complaints/:id/appeals
POST /complaints/:id/withdraw
```

Validate reason length, evidence URL array length, URL syntax, expected solution length, and optimistic version with `class-validator`.

- [ ] **Step 6: Run tests, lint the module, and commit**

```bash
pnpm --filter @petcare/server test -- src/modules/complaint-dispute --runInBand
pnpm --filter @petcare/server exec eslint src/modules/complaint-dispute
```

Expected: tests and lint PASS.

Commit:

```bash
git add apps/server/src/modules/complaint-dispute
git commit -m "feat(complaint): 实现用户投诉申诉接口"
```

---

### Task 5: Admin Assignment and Two-Level Decisions

**Files:**

- Create: `apps/server/src/modules/complaint-dispute/dispute-decision.service.ts`
- Create: `apps/server/src/modules/complaint-dispute/dispute-decision.service.spec.ts`
- Extend: `apps/server/src/modules/complaint-dispute/complaint-command.service.ts`
- Extend: `apps/server/src/modules/complaint-dispute/complaint-command.service.spec.ts`
- Create: `apps/server/src/modules/complaint-dispute/admin-complaint.controller.ts`
- Create: `apps/server/src/modules/complaint-dispute/dto/admin-complaint-list-query.dto.ts`
- Create: `apps/server/src/modules/complaint-dispute/dto/transfer-complaint.dto.ts`
- Create: `apps/server/src/modules/complaint-dispute/dto/submit-dispute-decision.dto.ts`

**Interfaces:**

- Produces: `claim(id, admin, version)`, `transfer(id, admin, targetAdminId, reason, version)`, `decideInitial(id, admin, request)`, and `decideFinal(id, admin, request)`.
- Consumes: Task 3 state rules and Task 4 query mapping.

- [ ] **Step 1: Write failing Admin workflow tests**

Cover:

- Two administrators racing to claim; exactly one succeeds.
- An order party administrator cannot claim.
- Ordinary administrator cannot decide another administrator’s case.
- Super administrator may transfer or override assignment.
- Initial decision creates `appealDeadlineAt = decidedAt + 72 hours`.
- Initial and final decisions are unique.
- Final decision closes the complaint.
- Refund and settlement are non-negative integers and do not exceed order amount.
- Credit deltas are integers from -100 through 100.
- Any transaction failure rolls back the decision, event, state update, and tasks.

Use an exact deadline assertion:

```ts
expect(transaction.complaint.updateMany).toHaveBeenCalledWith(
  expect.objectContaining({
    data: expect.objectContaining({
      appealDeadlineAt: new Date("2026-08-04T12:00:00.000Z"),
      status: COMPLAINT_STATUS.INITIAL_DECIDED,
    }),
  }),
);
```

for a decision time of `2026-08-01T12:00:00.000Z`.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
pnpm --filter @petcare/server test -- src/modules/complaint-dispute/complaint-command.service.spec.ts src/modules/complaint-dispute/dispute-decision.service.spec.ts --runInBand
```

Expected: FAIL because Admin commands are absent.

- [ ] **Step 3: Implement claim and transfer**

Both operations must use `updateMany` with expected status/version and write `ComplaintAssignment` plus `ComplaintEvent` in the same transaction. Verify target administrators have an active Admin role before transfer.

- [ ] **Step 4: Implement a single internal decision method**

Expose two public wrappers:

```ts
decideInitial(id: string, admin: AdminActor, request: SubmitDisputeDecisionRequest)
decideFinal(id: string, admin: AdminActor, request: SubmitDisputeDecisionRequest)
```

Both call a private `decide(id, admin, level, request, now)` so amount validation, permission checks, immutable decision creation, state update, timeline event creation, and execution task creation cannot diverge.

Generate task keys as:

```ts
`${complaintId}:${decisionLevel}:${taskType}`;
```

Create no task for a zero amount or zero credit delta.

- [ ] **Step 5: Add Admin list/detail and command endpoints**

Endpoints:

```text
GET  /admin/complaints
GET  /admin/complaints/:id
POST /admin/complaints/:id/claim
POST /admin/complaints/:id/transfer
POST /admin/complaints/:id/decisions/initial
POST /admin/complaints/:id/decisions/final
```

Use `AccessTokenGuard` and `AdminGuard`. Pass `{ id: payload.sub, roles: payload.roles }` to command services and derive `isSuperAdmin` from the existing seeded role code rather than trusting a request field.

- [ ] **Step 6: Run focused tests, lint, and commit**

```bash
pnpm --filter @petcare/server test -- src/modules/complaint-dispute --runInBand
pnpm --filter @petcare/server exec eslint src/modules/complaint-dispute
```

Expected: all complaint module tests and lint PASS.

Commit:

```bash
git add apps/server/src/modules/complaint-dispute
git commit -m "feat(complaint): 完成案件分配与两级裁决"
```

---

### Task 6: Idempotent Execution and Deadline Closure

**Files:**

- Create: `apps/server/src/modules/complaint-dispute/dispute-execution.service.ts`
- Create: `apps/server/src/modules/complaint-dispute/dispute-execution.service.spec.ts`
- Create: `apps/server/src/modules/complaint-dispute/complaint-deadline.service.ts`
- Create: `apps/server/src/modules/complaint-dispute/complaint-deadline.service.spec.ts`
- Extend: `apps/server/src/modules/complaint-dispute/admin-complaint.controller.ts`
- Create: `apps/server/src/modules/complaint-dispute/complaint-dispute.module.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

- Produces: `executeTask(taskId)`, `retryTask(taskId, adminId)`, `closeExpiredAppealWindows(now)`, and `processDueTasks(limit)`.
- Consumes: execution tasks created in Task 5.

- [ ] **Step 1: Write failing execution and deadline tests**

```ts
it("does not apply an already succeeded task twice", async () => {
  prisma.disputeExecutionTask.findUnique.mockResolvedValue({
    id: "task-1",
    status: "succeeded",
  });

  await service.executeTask("task-1");

  expect(prisma.creditScore.update).not.toHaveBeenCalled();
});

it("closes an expired initial decision and creates final execution tasks once", async () => {
  await service.closeExpiredAppealWindows(new Date("2026-08-04T12:00:00.000Z"));
  expect(prisma.complaint.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        status: COMPLAINT_STATUS.INITIAL_DECIDED,
        appealDeadlineAt: { lte: new Date("2026-08-04T12:00:00.000Z") },
      }),
    }),
  );
});
```

Also test failure metadata, retry count, next retry time, stale `processing` recovery, and batch limits.

- [ ] **Step 2: Run focused tests and verify failures**

```bash
pnpm --filter @petcare/server test -- src/modules/complaint-dispute/dispute-execution.service.spec.ts src/modules/complaint-dispute/complaint-deadline.service.spec.ts --runInBand
```

Expected: FAIL because the services are absent.

- [ ] **Step 3: Implement idempotent internal effects**

Use conditional task status changes:

```ts
const claimed = await transaction.disputeExecutionTask.updateMany({
  where: { id: taskId, status: { in: ["pending", "failed"] } },
  data: { status: "processing", attempts: { increment: 1 }, lastError: null },
});
```

If `claimed.count === 0`, return the current task without applying effects. Credit updates must write a `CreditRecord` with the task idempotency key as the business reference.

- [ ] **Step 4: Implement deadline closure as an idempotent batch method**

Select at most 100 expired records per call. For each complaint, use a transaction and a conditional state/version update, promote the immutable initial decision as the effective final result, create missing tasks using unique idempotency keys, write the timeout event, and close the case.

Do not introduce a new scheduler dependency. Expose these methods for the existing process bootstrap and future BullMQ worker; invoke a bounded maintenance tick from module lifecycle using an unreferenced timer that is cleared in `onModuleDestroy`, so Jest exits cleanly:

```ts
this.timer = setInterval(() => void this.runMaintenanceTick(), 60_000);
this.timer.unref();
```

- [ ] **Step 5: Register the module and retry endpoint**

Register `ComplaintDisputeModule` in `AppModule`. Add:

```text
GET  /admin/complaints/:id/execution-tasks
POST /admin/complaints/:id/execution-tasks/:taskId/retry
```

The retry endpoint may act only on failed tasks belonging to the requested complaint.

- [ ] **Step 6: Verify no Jest worker leak and commit**

```bash
pnpm --filter @petcare/server test -- src/modules/complaint-dispute --runInBand --detectOpenHandles
pnpm --filter @petcare/server typecheck
```

Expected: PASS with no worker or open-handle warning.

Commit:

```bash
git add apps/server/src/modules/complaint-dispute apps/server/src/app.module.ts
git commit -m "feat(complaint): 执行裁决任务并处理申诉超时"
```

---

### Task 7: Admin API Client and Order Subnavigation

**Files:**

- Create: `apps/admin/src/api/complaints.ts`
- Create: `apps/admin/src/api/complaints.test.ts`
- Create: `apps/admin/src/pages/OrderManagement/Navigation.tsx`
- Modify: `apps/admin/src/pages/OrderManagement/index.tsx`
- Modify: `apps/admin/src/App.tsx`

**Interfaces:**

- Produces: `fetchAdminComplaints`, `fetchAdminComplaint`, `claimAdminComplaint`, `transferAdminComplaint`, `submitInitialDecision`, `submitFinalDecision`, `fetchExecutionTasks`, and `retryExecutionTask`.
- Consumes: Task 1 shared contracts and Task 5/6 endpoints.

- [ ] **Step 1: Write failing API client tests**

```ts
it("queries the admin complaint queue with shared filters", async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    data: { list: [], total: 0, page: 1, pageSize: 20 },
  });

  await fetchAdminComplaints({ page: 1, pageSize: 20, queue: "unassigned" });

  expect(apiClient.get).toHaveBeenCalledWith("/admin/complaints", {
    params: { page: 1, pageSize: 20, queue: "unassigned" },
  });
});

it("posts the optimistic version with an initial decision", async () => {
  await submitInitialDecision("complaint-1", validDecision);
  expect(apiClient.post).toHaveBeenCalledWith(
    "/admin/complaints/complaint-1/decisions/initial",
    validDecision,
  );
});
```

- [ ] **Step 2: Run the API test and verify failure**

```bash
pnpm --filter @petcare/admin test -- src/api/complaints.test.ts
```

Expected: FAIL because `complaints.ts` does not exist.

- [ ] **Step 3: Implement all API functions**

Use only `apiClient` from `src/api/auth.ts`; do not create a second Axios instance. Return the already-unwrapped `response.data`.

- [ ] **Step 4: Add Order Management navigation and routes**

Navigation items:

```ts
[
  { label: "订单列表", to: "/orders", end: true },
  { label: "投诉与纠纷", to: "/orders/complaints", end: false },
];
```

Routes:

```tsx
<Route path="orders/complaints" element={<ComplaintList />} />
<Route path="orders/complaints/:id" element={<ComplaintDetail />} />
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @petcare/admin test -- src/api/complaints.test.ts src/pages/OrderManagement/index.test.tsx
```

Expected: PASS.

Commit:

```bash
git add apps/admin/src/api apps/admin/src/pages/OrderManagement apps/admin/src/App.tsx
git commit -m "feat(admin): 接入纠纷接口与订单子导航"
```

---

### Task 8: Admin Complaint Work Queue

**Files:**

- Create: `apps/admin/src/pages/OrderManagement/Complaint/index.tsx`
- Create: `apps/admin/src/pages/OrderManagement/Complaint/index.test.tsx`

**Interfaces:**

- Consumes: `fetchAdminComplaints` and shared list/query types from Task 7.
- Produces: `/orders/complaints` work queue navigation into detail pages.

- [ ] **Step 1: Write failing queue tests**

```tsx
it("loads my work queue by default", async () => {
  vi.mocked(fetchAdminComplaints).mockResolvedValue({
    list: [complaint],
    total: 1,
    page: 1,
    pageSize: 20,
  });

  renderPage();

  expect(await screen.findByText("CP20260729001")).toBeInTheDocument();
  expect(fetchAdminComplaints).toHaveBeenCalledWith(
    expect.objectContaining({ queue: "mine", page: 1, pageSize: 20 }),
  );
});

it("returns to page one when the queue changes", async () => {
  const user = userEvent.setup();
  renderPage("/orders/complaints?page=3");
  await user.click(screen.getByRole("button", { name: "待领取" }));
  expect(fetchAdminComplaints).toHaveBeenLastCalledWith(
    expect.objectContaining({ queue: "unassigned", page: 1 }),
  );
});
```

Also cover loading, empty, error/retry, combined filters, pagination, overdue marker, and execution-failure marker.

- [ ] **Step 2: Run the component test and verify failure**

```bash
pnpm --filter @petcare/admin test -- src/pages/OrderManagement/Complaint/index.test.tsx
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement the work queue**

Use TanStack Query with a key containing the complete normalized query. Persist shareable filters in URL search parameters. Render desktop table and narrow-screen cards from the same `list` data. Use semantic Tailwind tokens and static class strings only.

The queue tabs are:

```text
待我处理 / 待领取 / 待回应 / 待初裁 / 申诉期内 / 待终裁 / 执行异常 / 已结案
```

Each row/card links to `/orders/complaints/:id` and shows case number, order number, type, both parties, assignee, stage duration, and appeal countdown.

- [ ] **Step 4: Run tests, style lint, and commit**

```bash
pnpm --filter @petcare/admin test -- src/pages/OrderManagement/Complaint/index.test.tsx
pnpm --filter @petcare/admin lint:styles
```

Expected: PASS.

Commit:

```bash
git add apps/admin/src/pages/OrderManagement/Complaint
git commit -m "feat(admin): 实现投诉纠纷工作队列"
```

---

### Task 9: Admin Dossier and Sticky Decision Workbench

**Files:**

- Create: `apps/admin/src/pages/OrderManagement/Complaint/Detail.tsx`
- Create: `apps/admin/src/pages/OrderManagement/Complaint/Detail.test.tsx`
- Create: `apps/admin/src/pages/OrderManagement/Complaint/DecisionDialog.tsx`
- Create: `apps/admin/src/pages/OrderManagement/Complaint/TransferDialog.tsx`

**Interfaces:**

- Consumes: all Task 7 detail/command API functions and `ComplaintDetail.allowedActions`.
- Produces: claim, transfer, initial decision, final decision, and execution retry interactions.

- [ ] **Step 1: Write failing detail workflow tests**

Cover:

- Continuous dossier sections render in order: order, parties, complaint, statements/evidence, decisions, timeline.
- Workbench renders only actions returned by `allowedActions`.
- Claim and transfer mutation success invalidates list/detail queries.
- Decision validation rejects negative/fractional/excessive amounts and out-of-range credit deltas.
- Decision preview shows refund, settlement, both credit changes, and finality.
- Initial and final decisions require confirmation.
- HTTP 409 keeps no stale success state, shows “案件状态已变化”, and refetches detail.
- Failed execution task exposes retry; successful task does not.

Example:

```tsx
it("shows an impact preview before final decision", async () => {
  const user = userEvent.setup();
  vi.mocked(fetchAdminComplaint).mockResolvedValue({
    ...detail,
    allowedActions: ["final_decide"],
  });
  renderPage();

  await user.click(await screen.findByRole("button", { name: "作出最终裁决" }));
  await user.type(screen.getByLabelText("裁决理由"), "新增证据足以支持最终责任认定");
  await user.type(screen.getByLabelText("退款金额（分）"), "5000");
  await user.click(screen.getByRole("button", { name: "预览裁决影响" }));

  expect(screen.getByText("退款 ¥50.00")).toBeInTheDocument();
  expect(screen.getByText("最终裁决提交后不可再次申诉")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the detail test and verify failure**

```bash
pnpm --filter @petcare/admin test -- src/pages/OrderManagement/Complaint/Detail.test.tsx
```

Expected: FAIL because the detail components do not exist.

- [ ] **Step 3: Implement the dossier layout**

Use a responsive grid:

```tsx
<main className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
  <ComplaintDossier complaint={complaint} />
  <aside className="space-y-4 xl:sticky xl:top-6">
    <ComplaintWorkbench complaint={complaint} />
  </aside>
</main>
```

The Admin grid template follows the Admin Tailwind rules. Miniapp code remains subject to its stricter prohibition on arbitrary-value classes.

- [ ] **Step 4: Implement dialogs and mutation conflict handling**

Keep form state inside focused dialogs. Convert display yuan to integer cents only at the form boundary, or preferably label fields explicitly as cents to avoid floating-point conversion. Submit `complaint.version` unchanged. On Axios 409, close confirmation, show the conflict message, and call `queryClient.invalidateQueries({ queryKey: ["admin-complaint", id] })`.

- [ ] **Step 5: Run tests, lint, build, and commit**

```bash
pnpm --filter @petcare/admin test -- src/pages/OrderManagement/Complaint
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin build
```

Expected: tests, lint, style output policy, typecheck, and Vite build PASS.

Commit:

```bash
git add apps/admin/src/pages/OrderManagement/Complaint
git commit -m "feat(admin): 完成纠纷卷宗与裁决工作台"
```

---

### Task 10: Miniapp Typed Workflow API

**Files:**

- Create: `apps/miniapp/src/api/complaints.ts`
- Create: `apps/miniapp/src/api/complaints.test.ts`

**Interfaces:**

- Consumes: Task 1 user request/response contracts and Task 4 endpoints.
- Produces: typed API functions ready for complaint and appeal pages without implementing unrelated Miniapp UI.

- [ ] **Step 1: Write failing Miniapp API tests**

```ts
it("submits a second appeal through the shared request client", async () => {
  mockedRequest.mockResolvedValue(detail);

  await submitSecondAppeal("complaint-1", {
    reason: "新增现场视频能够证明服务步骤缺失",
    evidenceUrls: ["https://cdn.example/new-video.mp4"],
    version: 3,
  });

  expect(mockedRequest).toHaveBeenCalledWith({
    url: "/complaints/complaint-1/appeals",
    method: "POST",
    data: expect.objectContaining({ version: 3 }),
  });
});
```

Test create, list, detail, first response, second appeal, and withdrawal.

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm --filter @petcare/miniapp test -- src/api/complaints.test.ts --runInBand
```

Expected: FAIL because the API file does not exist.

- [ ] **Step 3: Implement typed API functions**

Use the existing Miniapp request wrapper. Keep endpoint construction in this file and return shared contract types. Add Chinese comments describing each function.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm --filter @petcare/miniapp test -- src/api/complaints.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add apps/miniapp/src/api
git commit -m "feat(miniapp): 接入投诉申诉共享接口"
```

---

### Task 11: API Documentation and Full Verification

**Files:**

- Modify: `docs/06-api-specification/01-api-specification.md`

**Interfaces:**

- Documents: all user/Admin endpoints, state values, state conflicts, deadlines, integer money, pagination, and internal execution task behavior.

- [ ] **Step 1: Update API documentation**

Document:

- Every endpoint and required role.
- Shared request/response field meanings.
- `list`, `total`, `page`, `pageSize`.
- All seven complaint states.
- 72-hour second appeal boundary.
- `COMPLAINT_STATE_CONFLICT`, `COMPLAINT_ACTION_NOT_ALLOWED`, `APPEAL_DEADLINE_EXPIRED`, `OPEN_COMPLAINT_EXISTS`, `DECISION_AMOUNT_INVALID`, and `EXECUTION_TASK_NOT_RETRYABLE`.
- Integer amounts in cents.
- Internal execution tasks do not call WeChat Pay in this release.

- [ ] **Step 2: Reset the local development schema and seed**

Because schema reset was explicitly accepted for this early-stage project, run:

```bash
pnpm --filter @petcare/server prisma:push --force-reset
pnpm --filter @petcare/server prisma:seed
```

Expected: schema reset and default Admin seed complete successfully. Never run this command against a non-local database URL.

- [ ] **Step 3: Run focused validation**

```bash
pnpm --filter @petcare/server exec prisma validate
pnpm --filter @petcare/server prisma:generate
pnpm --filter @petcare/shared-types test
pnpm --filter @petcare/server test -- src/modules/complaint-dispute --runInBand --detectOpenHandles
pnpm --filter @petcare/admin test -- src/api/complaints.test.ts src/pages/OrderManagement/Complaint
pnpm --filter @petcare/miniapp test -- src/api/complaints.test.ts --runInBand
```

Expected: all focused checks PASS with no open-handle warning.

- [ ] **Step 4: Run repository quality gates**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm lint:styles
git diff --check
```

Expected: every command exits 0; Server coverage has no non-graceful Jest worker warning; Admin and Miniapp production style output checks pass.

- [ ] **Step 5: Review the diff against the design**

Confirm:

- Every design requirement maps to code and tests.
- No client duplicates Server state transition rules.
- No money field in the affected order/dispute schema remains `Float`.
- Every state-changing operation writes a timeline/audit record.
- Every decision effect has a unique idempotency key.
- No `.env`, generated Prisma client, build output, coverage, or `.superpowers` artifact is staged.

- [ ] **Step 6: Commit documentation and final corrections**

```bash
git add docs/06-api-specification/01-api-specification.md
git commit -m "docs(complaint): 补充投诉纠纷完整接口"
```

If verification required code corrections, stage them in a separate preceding commit whose Chinese Conventional Commit subject describes the correction.
