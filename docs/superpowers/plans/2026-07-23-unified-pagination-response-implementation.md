# Unified Pagination Response Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every paginated business payload use exactly `list`, `total`, `page`, and `pageSize` inside the unified API response `data` field.

**Architecture:** `PaginatedResponse<T>` in the shared types package is the single public pagination contract. Domain response types reuse it, services return that shape directly, and Swagger DTOs describe the same runtime object without controller-level transformations.

**Tech Stack:** TypeScript 6, NestJS 11, Prisma 7, Jest 30, Vitest 4, `@nestjs/swagger` 11, pnpm workspaces, Turborepo.

## Global Constraints

- Preserve the unified response envelope `{ code, message, data, meta }`.
- Paginated `data` contains exactly `list`, `total`, `page`, and `pageSize`.
- `list` is always an array; `total` is a non-negative integer; `page` starts at 1; `pageSize` is positive.
- Do not retain, dual-write, or transform legacy pagination fields such as `items` or `orders`.
- Services produce the public pagination shape directly; controllers and HTTP clients do not rename pagination fields.
- Do not change the database schema, Docker configuration, or environment variables.

---

### Task 1: Shared Pagination Contract

**Files:**

- Modify: `packages/shared-types/src/api/response.ts`
- Modify: `packages/shared-types/src/api/order.ts`

**Interfaces:**

- Produces: `PaginatedResponse<T> = { list: T[]; total: number; page: number; pageSize: number }`.
- Produces: `OrderListResponse` as an alias of `PaginatedResponse<Order>` for API Client consumers.

- [ ] **Step 1: Replace the shared pagination field and reuse the generic type**

In `packages/shared-types/src/api/response.ts`, replace the existing interface with:

```ts
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

In `packages/shared-types/src/api/order.ts`, import the generic type and replace the duplicated response interface:

```ts
import type { PaginatedResponse } from "./response";

export type OrderListResponse = PaginatedResponse<Order>;
```

- [ ] **Step 2: Run the shared package build**

Run:

```powershell
pnpm --filter @petcare/shared-types build
```

Expected: TypeScript exits with code 0 and emits declarations where `OrderListResponse` resolves to the list-based generic contract.

- [ ] **Step 3: Commit the shared contract**

```powershell
git add packages/shared-types/src/api/response.ts packages/shared-types/src/api/order.ts
git commit -m "refactor: unify pagination response types"
```

### Task 2: Order Runtime Response and Swagger Schema

**Files:**

- Test: `apps/server/src/modules/order/order.service.spec.ts`
- Test: `apps/server/src/common/swagger/swagger-responses.spec.ts`
- Modify: `apps/server/src/modules/order/order.service.ts`
- Modify: `apps/server/src/modules/order/dto/order-response.dto.ts`

**Interfaces:**

- Consumes: `PaginatedResponse<T>` field names established by Task 1.
- Produces: `OrderService.findAll(page, pageSize)` result `{ list, total, page, pageSize }`.
- Produces: Swagger component `OrderListResponseDto` with `list: OrderResponseDto[]` and no `orders` property.

- [ ] **Step 1: Write the failing order service test**

Add this test to `apps/server/src/modules/order/order.service.spec.ts`:

```ts
it("returns the unified list-based pagination shape", async () => {
  const orders = [{ id: "order-1" }];
  prisma.order.findMany.mockResolvedValue(orders);
  prisma.order.count.mockResolvedValue(1);

  await expect(service.findAll(2, 10)).resolves.toEqual({
    list: orders,
    total: 1,
    page: 2,
    pageSize: 10,
  });
});
```

- [ ] **Step 2: Run the service test and verify RED**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/modules/order/order.service.spec.ts
```

Expected: FAIL because the received object contains `orders` instead of `list`.

- [ ] **Step 3: Write the failing Swagger schema test**

Add this test to `apps/server/src/common/swagger/swagger-responses.spec.ts`:

```ts
it("documents the unified order pagination data fields", () => {
  const schema = document.components?.schemas?.OrderListResponseDto as {
    properties?: Record<string, unknown>;
  };

  expect(schema.properties).toMatchObject({
    list: {
      type: "array",
      items: { $ref: "#/components/schemas/OrderResponseDto" },
    },
    total: { type: "number", example: 1 },
    page: { type: "number", example: 1 },
    pageSize: { type: "number", example: 20 },
  });
  expect(schema.properties).not.toHaveProperty("orders");
});
```

- [ ] **Step 4: Run the Swagger test and verify RED**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/common/swagger/swagger-responses.spec.ts
```

Expected: FAIL because `OrderListResponseDto` exposes `orders` and has no `list` property.

- [ ] **Step 5: Implement the minimal runtime and DTO changes**

In `apps/server/src/modules/order/order.service.ts`, return the query result under `list`:

```ts
const [list, total] = await Promise.all([
  this.prisma.order.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: "desc" },
  }),
  this.prisma.order.count(),
]);

return { list, total, page, pageSize };
```

In `apps/server/src/modules/order/dto/order-response.dto.ts`, replace `orders` with:

```ts
@ApiProperty({ type: [OrderResponseDto] })
list: OrderResponseDto[];
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
pnpm --filter @petcare/server test -- --runInBand src/modules/order/order.service.spec.ts src/common/swagger/swagger-responses.spec.ts
```

Expected: both suites pass, including the list-based runtime and Swagger assertions.

- [ ] **Step 7: Commit runtime and Swagger changes**

```powershell
git add apps/server/src/modules/order/order.service.ts apps/server/src/modules/order/order.service.spec.ts apps/server/src/modules/order/dto/order-response.dto.ts apps/server/src/common/swagger/swagger-responses.spec.ts
git commit -m "refactor: unify order pagination response"
```

### Task 3: Public Documentation and Final Verification

**Files:**

- Modify: `docs/06-api-specification/01-api-specification.md`
- Modify: `docs/03-technical-architecture/02-monorepo-structure.md`
- Modify: `docs/superpowers/specs/2026-07-22-unified-api-response-design.md`
- Modify: `docs/superpowers/plans/2026-07-22-unified-api-response-implementation.md`

**Interfaces:**

- Consumes: the list-based pagination contract implemented in Tasks 1 and 2.
- Produces: public examples and architecture references that consistently show `data.list`.

- [ ] **Step 1: Update API and architecture examples**

Change pagination examples and TypeScript snippets from domain fields or `items` to:

```json
"data": {
  "list": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

and:

```ts
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

Do not modify OpenAPI/JSON Schema uses of the reserved `items` keyword for array element schemas.

- [ ] **Step 2: Verify legacy pagination fields are absent from active code and public examples**

Run:

```powershell
rg -n "items: T\\[\\]|orders: Order\\[\\]|\\\"orders\\\": \\[" packages/shared-types apps/server docs/06-api-specification docs/03-technical-architecture docs/superpowers/specs
```

Expected: no pagination contract matches. Historical prose may mention old names only to explain that they are unsupported.

- [ ] **Step 3: Run full verification**

Run:

```powershell
pnpm test -- --force
pnpm lint -- --force
pnpm build -- --force
pnpm --filter @petcare/miniapp build:weapp
pnpm exec prettier --check packages/shared-types/src/api/response.ts packages/shared-types/src/api/order.ts apps/server/src/modules/order/order.service.ts apps/server/src/modules/order/order.service.spec.ts apps/server/src/modules/order/dto/order-response.dto.ts apps/server/src/common/swagger/swagger-responses.spec.ts docs/06-api-specification/01-api-specification.md docs/03-technical-architecture/02-monorepo-structure.md docs/superpowers/specs/2026-07-22-unified-api-response-design.md docs/superpowers/plans/2026-07-22-unified-api-response-implementation.md docs/superpowers/specs/2026-07-23-unified-pagination-response-design.md docs/superpowers/plans/2026-07-23-unified-pagination-response-implementation.md
git diff --check
```

Expected: all commands exit with code 0; tests have zero failures; lint has zero errors; all builds and formatting checks pass.

- [ ] **Step 4: Commit documentation**

```powershell
git add docs/06-api-specification/01-api-specification.md docs/03-technical-architecture/02-monorepo-structure.md docs/superpowers/specs/2026-07-22-unified-api-response-design.md docs/superpowers/plans/2026-07-22-unified-api-response-implementation.md
git commit -m "docs: standardize pagination examples"
```

- [ ] **Step 5: Confirm final repository state**

Run:

```powershell
git status --short
git log --oneline -5
```

Expected: the working tree is clean and the pagination design, implementation, and documentation commits are present.
