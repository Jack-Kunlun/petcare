# PetCare RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a code-defined RBAC management flow with role CRUD, generated menu/button catalog, Server authorization enforcement, Admin route protection, and button-level visibility.

**Architecture:** The shared permission catalog is the single source for menu, button, and API permission metadata. Admin binds lazy route elements to that catalog and derives Sidebar, route guards, and `PermissionGate` behavior from it. Server exposes a focused `RbacModule`, synchronizes catalog permissions, expands UI permissions into API permissions during role updates, and remains the final authorization boundary.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, React 19, React Router, Vitest, Jest, shared TypeScript contracts, Tailwind CSS v4.

## Global Constraints

- `AuthModule` remains responsible for authentication; the new backend module is named `RbacModule`.
- Menu structure is code-defined; the database stores `Permission`, `RolePermission`, `UserRole`, and audit records, not editable menu trees.
- Role editing accepts only `menu` and `button` permission codes; Server expands `impliedApiCodes` and rejects unknown/API codes.
- Server `PermissionGuard` is the final security boundary; frontend route and button checks are UX controls only.
- Existing `list / total / page / pageSize` pagination format is mandatory for role lists.
- Shared request/response contracts live in `@petcare/shared-types`; each public field and function has JSDoc.
- Server configuration is accessed through `ConfigService`; no new direct `process.env` reads are introduced.
- Admin pages use the module directory convention: `index.tsx`, `Edit.tsx`, and `Detail.tsx`.
- Admin and Miniapp styling rules remain unchanged: Tailwind utility classes first, approved SCSS only where Tailwind cannot express the style.
- No Prisma migration is generated; development schema changes use the existing `prisma:push` and `prisma:seed` workflow.
- Every task ends with its focused tests and a Chinese Conventional Commit.

---

### Task 1: Shared RBAC catalog and contracts

**Files:**

- Create: `packages/shared-types/src/rbac/permission-catalog.ts`
- Create: `packages/shared-types/src/rbac/permission-catalog.spec.ts`
- Create: `packages/shared-types/src/rbac/index.ts`
- Create: `packages/shared-types/src/api/rbac.ts`
- Modify: `packages/shared-types/src/api/index.ts`
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**

```typescript
export const RBAC_PERMISSION_TYPES = {
  MENU: "menu",
  BUTTON: "button",
  API: "api",
} as const;

export type RbacPermissionType = (typeof RBAC_PERMISSION_TYPES)[keyof typeof RBAC_PERMISSION_TYPES];

export interface RbacPermissionDefinition {
  code: string;
  type: RbacPermissionType;
  label: string;
  module: string;
  path: string | null;
  parentCode: string | null;
  order: number;
  icon: string | null;
  impliedApiCodes: readonly string[];
}

export const RBAC_PERMISSION_CATALOG: readonly RbacPermissionDefinition[];
export function getRbacPermission(code: string): RbacPermissionDefinition | undefined;
export function getRbacCatalogVersion(): string;
export function getRbacUiPermissionCodes(): readonly string[];
```

The catalog must cover the existing Dashboard, Users, Provider Certification, Orders, Complaints, System Settings, and new RBAC routes. Existing seed codes such as `user.view`, `user.read`, `system.view`, `rbac.view`, `rbac.role.read`, `rbac.role.create`, `rbac.role.update`, `rbac.role.delete`, `rbac.permission.read`, and `rbac.assign_role` remain stable.

Shared API contracts must include:

```typescript
export interface RbacCatalogResponse {
  version: string;
  permissions: RbacPermissionDefinition[];
}

export interface RbacRoleListItem {
  id: string;
  roleName: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
  updatedAt: string;
}

export type RbacRoleListResponse = PaginatedResponse<RbacRoleListItem>;

export interface RbacRoleDetail extends RbacRoleListItem {
  permissionCodes: string[];
  userIds: string[];
}

export interface CreateRbacRoleRequest {
  roleName: string;
  description?: string;
}

export interface UpdateRbacRoleRequest {
  roleName?: string;
  description?: string;
  isActive?: boolean;
}

export interface ReplaceRbacRolePermissionsRequest {
  permissionCodes: string[];
}

export interface ReplaceRbacRoleUsersRequest {
  userIds: string[];
}
```

- [ ] **Step 1: Write the failing catalog invariants test.** Assert unique codes, unique menu paths, valid parent menu references, valid `impliedApiCodes`, and UI/API type separation.
- [ ] **Step 2: Run the focused test to verify it fails.** Run `pnpm --filter @petcare/shared-types test -- permission-catalog.spec.ts`. Expected: FAIL because the catalog module does not exist.
- [ ] **Step 3: Add the catalog and shared response contracts.** Export the catalog from both `src/rbac/index.ts` and the package root, and export `api/rbac.ts` from the existing API barrel.
- [ ] **Step 4: Run the focused test and package checks.** Run `pnpm --filter @petcare/shared-types test -- permission-catalog.spec.ts`, `pnpm --filter @petcare/shared-types typecheck`, and `pnpm --filter @petcare/shared-types lint`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add packages/shared-types && git commit -m "feat(rbac): 增加共享权限目录契约"`

### Task 2: Server catalog validation and authorization closure

**Files:**

- Create: `apps/server/src/modules/rbac/permission-catalog.service.ts`
- Create: `apps/server/src/modules/rbac/permission-catalog.service.spec.ts`
- Create: `apps/server/src/modules/rbac/rbac.service.ts`
- Create: `apps/server/src/modules/rbac/rbac.service.spec.ts`
- Create: `apps/server/src/modules/rbac/rbac.errors.ts`
- Modify: `apps/server/src/auth/auth.service.ts`
- Modify: `apps/server/src/auth/auth.service.spec.ts`

**Interfaces:**

```typescript
export interface PermissionCatalogService {
  getVersion(): string;
  getAll(): readonly RbacPermissionDefinition[];
  getByCode(code: string): RbacPermissionDefinition;
  isActiveCode(code: string): boolean;
  getOrphanedCodes(databaseCodes: readonly string[]): string[];
  validateUiPermissionCodes(codes: readonly string[]): void;
  expandToEffectiveCodes(uiCodes: readonly string[]): string[];
}

export interface RbacService {
  getCatalog(): RbacCatalogResponse;
  getEffectiveAuthorizationCodes(userId: string): Promise<string[]>;
}
```

- [ ] **Step 1: Write the failing service tests.** Cover unknown code rejection, API code rejection from UI input, invalid button parent rejection, API closure expansion, and orphan database codes being excluded from effective permissions.
- [ ] **Step 2: Run the focused tests to verify failure.** Run `pnpm --filter @petcare/server test -- permission-catalog.service.spec.ts rbac.service.spec.ts auth.service.spec.ts`. Expected: FAIL because the services and catalog exports do not exist.
- [ ] **Step 3: Implement pure catalog validation and closure expansion.** Build a `Map` from the shared catalog, calculate a stable version from catalog content, validate parent relationships, and return sorted de-duplicated effective codes.
- [ ] **Step 4: Update `AuthService.getCurrentUserAuthorization`.** Intersect database permission codes with `RBAC_PERMISSION_CATALOG` before returning them, preserving role names and de-duplicated effective permissions.
- [ ] **Step 5: Run the focused tests.** Expected: PASS with orphan codes ignored and invalid UI codes rejected.
- [ ] **Step 6: Commit.** `git add apps/server/src/modules/rbac apps/server/src/auth/auth.service.ts apps/server/src/auth/auth.service.spec.ts && git commit -m "feat(rbac): 增加权限目录校验与有效权限闭包"`

### Task 3: Server RbacModule and role management API

**Files:**

- Create: `apps/server/src/modules/rbac/rbac.module.ts`
- Create: `apps/server/src/modules/rbac/admin-rbac.controller.ts`
- Create: `apps/server/src/modules/rbac/admin-rbac.controller.spec.ts`
- Create: `apps/server/src/modules/rbac/role.service.ts`
- Create: `apps/server/src/modules/rbac/role.service.spec.ts`
- Create: `apps/server/src/modules/rbac/dto/rbac.dto.ts`
- Modify: `apps/server/src/app.module.ts`

**Interfaces:**

```typescript
@Controller("admin/rbac")
export class AdminRbacController {
  getCatalog(): RbacCatalogResponse;
  listRoles(query: RbacRoleListQuery): Promise<RbacRoleListResponse>;
  getRole(id: string): Promise<RbacRoleDetail>;
  createRole(dto: CreateRbacRoleRequest, request: Request): Promise<RbacRoleDetail>;
  updateRole(id: string, dto: UpdateRbacRoleRequest, request: Request): Promise<RbacRoleDetail>;
  deleteRole(id: string, request: Request): Promise<void>;
  replacePermissions(
    id: string,
    dto: ReplaceRbacRolePermissionsRequest,
    request: Request,
  ): Promise<RbacRoleDetail>;
  getRoleUsers(id: string): Promise<AdminUserListItem[]>;
  replaceRoleUsers(
    id: string,
    dto: ReplaceRbacRoleUsersRequest,
    request: Request,
  ): Promise<AdminUserListItem[]>;
}
```

- [ ] **Step 1: Write controller metadata tests.** Assert `@Controller("admin/rbac")`, `AccessTokenGuard + PermissionGuard`, required permissions for each route, Swagger success DTOs, and 400/401/403/404/409/500 error declarations.
- [ ] **Step 2: Run the controller metadata test to verify failure.** Run `pnpm --filter @petcare/server test -- admin-rbac.controller.spec.ts`. Expected: FAIL because the controller does not exist.
- [ ] **Step 3: Write RoleService tests.** Cover paginated output, duplicate role conflict, system role protection, assigned-user delete protection, atomic permission replacement, user-role replacement, and audit log writes.
- [ ] **Step 4: Implement DTOs and RoleService.** Use Prisma transactions for role permissions, user roles, and audit records; validate role names, IDs, catalog UI codes, and operator identity before mutation.
- [ ] **Step 5: Implement `AdminRbacController`.** Use `@RequirePermissions("rbac.view")` for reads, `rbac.role.create/update/delete` for role mutations, `rbac.permission.read` for catalog, and `rbac.assign_role` for user assignments.
- [ ] **Step 6: Register `RbacModule` in `AppModule`.** Import `PrismaModule` and export only the catalog/authorization services needed by other modules.
- [ ] **Step 7: Run focused Server tests.** Run the controller and service specs. Expected: PASS with unified response and pagination shapes.
- [ ] **Step 8: Commit.** `git add apps/server/src/modules/rbac apps/server/src/app.module.ts && git commit -m "feat(rbac): 增加角色与权限管理接口"`

### Task 4: Seed synchronization and existing Server authorization migration

**Files:**

- Modify: `apps/server/src/seed/seed-initial-data.ts`
- Modify: `apps/server/src/seed/seed-initial-data.spec.ts`
- Modify: `apps/server/src/auth/auth.module.ts`
- Modify: `apps/server/src/modules/user/admin-user.controller.ts`
- Modify: `apps/server/src/modules/order/admin-order.controller.ts`
- Modify: `apps/server/src/modules/provider-certification/admin-provider-certification.controller.ts`
- Modify: `apps/server/src/modules/complaint-dispute/admin-complaint.controller.ts`
- Modify: `apps/server/src/modules/system-settings/admin-system-settings.controller.ts`
- Create or modify: corresponding controller metadata and authorization specs

- [ ] **Step 1: Extend seed tests.** Replace the static permission expectation with an assertion that every shared catalog code is upserted and `super_admin` receives every catalog permission.
- [ ] **Step 2: Run the seed test to verify failure.** Run `pnpm --filter @petcare/server test -- seed-initial-data.spec.ts`. Expected: FAIL because seed still owns a duplicated permission array.
- [ ] **Step 3: Replace the seed permission array with shared catalog synchronization.** Upsert `code`, `label`, `module`, and `type` into `Permission`; preserve existing codes and keep the default administrator/role seed idempotent.
- [ ] **Step 4: Migrate Admin controllers from broad `AdminGuard` to precise permission declarations.** Use menu/API codes for reads and button codes for mutations; keep `AccessTokenGuard` first in guard order.
- [ ] **Step 5: Add regression tests for representative 403 cases.** Verify a role with only `system.view` can read settings but cannot publish, and a role without `rbac.role.update` cannot replace role permissions.
- [ ] **Step 6: Run Server seed, controller, and auth tests.** Expected: PASS.
- [ ] **Step 7: Commit.** `git add apps/server/src/seed apps/server/src/auth apps/server/src/modules && git commit -m "feat(rbac): 同步权限目录并细化服务端鉴权"`

### Task 5: Admin RBAC API client and permission hooks

**Files:**

- Create: `apps/admin/src/api/rbac/catalog.ts`
- Create: `apps/admin/src/api/rbac/roles.ts`
- Create: `apps/admin/src/api/rbac/users.ts`
- Create: `apps/admin/src/api/rbac/index.ts`
- Create: corresponding `*.test.ts` files
- Create: `apps/admin/src/auth/permissions.ts`
- Create: `apps/admin/src/auth/PermissionGate.tsx`
- Create: `apps/admin/src/auth/PermissionGate.test.tsx`
- Modify: `apps/admin/src/auth/auth.context.ts`

**Interfaces:**

```typescript
export interface PermissionHelpers {
  has(code: string): boolean;
  hasAll(codes: readonly string[]): boolean;
  hasAny(codes: readonly string[]): boolean;
}

export function usePermissions(): PermissionHelpers;
export function usePermission(code: string): boolean;

export interface PermissionGateProps {
  all?: readonly string[];
  any?: readonly string[];
  fallback?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
}
```

- [ ] **Step 1: Write API client tests.** Assert catalog, role list, role detail, role mutations, permission replacement, and user replacement use `/admin/rbac/*` with shared request/response types.
- [ ] **Step 2: Run API tests to verify failure.** Run `pnpm --filter @petcare/admin test -- src/api/rbac`. Expected: FAIL because the API modules do not exist.
- [ ] **Step 3: Implement typed API modules.** Keep all RBAC requests under `apps/admin/src/api/rbac/`, use the existing `apiClient`, and preserve `unwrapApiResponse` behavior.
- [ ] **Step 4: Write `PermissionGate` tests.** Cover no permission hidden fallback, `all`, `any`, explicit disabled rendering, and authenticated permission changes.
- [ ] **Step 5: Implement hooks and gate.** Read permissions from `AuthContext`, use a memoized `Set`, and never make a network request from a button guard.
- [ ] **Step 6: Run focused Admin tests and typecheck.** Expected: PASS.
- [ ] **Step 7: Commit.** `git add apps/admin/src/api/rbac apps/admin/src/auth && git commit -m "feat(admin): 增加 RBAC API 与按钮权限控制"`

### Task 6: Route registry, Sidebar generation, and protected existing actions

**Files:**

- Create: `apps/admin/src/routes/registry.ts`
- Create: `apps/admin/src/routes/registry.test.ts`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/components/Sidebar.tsx`
- Modify: `apps/admin/src/auth/PermissionRoute.tsx`
- Modify: existing Admin pages that render protected actions, with focused tests

**Interfaces:**

```typescript
export interface AdminRouteDefinition {
  id: string;
  path: string;
  element: ReactNode;
  menuPermission: string | null;
  requiredPermissions: readonly string[];
  parentPath: string | null;
  order: number;
  icon: string | null;
}

export const ADMIN_ROUTE_REGISTRY: readonly AdminRouteDefinition[];
export function getVisibleMenuRoutes(permissionCodes: readonly string[]): AdminRouteDefinition[];
```

- [ ] **Step 1: Write registry tests.** Assert every menu catalog path has one route entry, every route permission exists, protected pages use the same code as the catalog, and Sidebar output changes with permissions.
- [ ] **Step 2: Run registry tests to verify failure.** Run `pnpm --filter @petcare/admin test -- src/routes/registry.test.ts`. Expected: FAIL because the registry does not exist.
- [ ] **Step 3: Implement the route registry and route lookup helpers.** Keep lazy loaders and route boundaries in the registry adapter while keeping shared catalog data serializable.
- [ ] **Step 4: Refactor `App.tsx` and `Sidebar.tsx`.** Generate protected routes and menu links from the registry; keep `/login` and the anonymous root guard outside the registry.
- [ ] **Step 5: Add `PermissionGate` to existing protected actions.** Apply exact codes to settings save/publish, provider certification approval/rejection, complaint claim/assign/resolve/retry, and other existing mutation buttons.
- [ ] **Step 6: Run App, Sidebar, route, and page tests.** Expected: PASS with no unauthorized mutation button rendered.
- [ ] **Step 7: Commit.** `git add apps/admin/src/routes apps/admin/src/App.tsx apps/admin/src/components/Sidebar.tsx apps/admin/src/auth/PermissionRoute.tsx apps/admin/src/pages && git commit -m "feat(admin): 从权限目录生成路由与菜单"`

### Task 7: Admin role and menu management pages

**Files:**

- Create: `apps/admin/src/pages/Rbac/index.tsx`
- Create: `apps/admin/src/pages/Rbac/Edit.tsx`
- Create: `apps/admin/src/pages/Rbac/Detail.tsx`
- Create: `apps/admin/src/pages/Rbac/rbac-utils.ts`
- Create: `apps/admin/src/pages/Rbac/index.test.tsx`
- Create: `apps/admin/src/pages/Rbac/Edit.test.tsx`
- Create: `apps/admin/src/pages/Rbac/Detail.test.tsx`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/components/Sidebar.tsx`

**Interfaces:**

```typescript
export interface PermissionTreeNode {
  code: string;
  type: "menu" | "button";
  label: string;
  path: string | null;
  children: PermissionTreeNode[];
  checked: boolean;
  indeterminate: boolean;
}

export function buildPermissionTree(
  catalog: readonly RbacPermissionDefinition[],
  selectedCodes: readonly string[],
): PermissionTreeNode[];

export function togglePermissionTree(
  tree: readonly PermissionTreeNode[],
  code: string,
): PermissionTreeNode[];
```

- [ ] **Step 1: Write `rbac-utils` tests.** Cover tree grouping, child ordering, selected state, parent indeterminate state, parent toggle, child toggle, and API nodes excluded from editable tree.
- [ ] **Step 2: Run utility tests to verify failure.** Run `pnpm --filter @petcare/admin test -- src/pages/Rbac/rbac-utils.test.ts`. Expected: FAIL because the module does not exist.
- [ ] **Step 3: Implement pure tree utilities.** Build deterministic menu/button tree from catalog and return immutable updates for toggles.
- [ ] **Step 4: Write page tests.** Assert role pagination, menu directory read-only behavior, create/edit/delete button visibility, system role read-only state, permission save payload, user association replacement, and 409 conflict handling.
- [ ] **Step 5: Implement `index.tsx`.** Load catalog and roles, render role table with unified pagination, expose the read-only menu catalog tab, and guard all mutation controls with `PermissionGate`.
- [ ] **Step 6: Implement `Edit.tsx`.** Load role detail, render basic fields and menu/button tree, support half-selected parent nodes, preserve API nodes as read-only, and save only UI permission codes.
- [ ] **Step 7: Implement `Detail.tsx`.** Render role metadata, effective permissions, catalog version, and associated administrators; use the `rbac.assign_role` gate for association changes.
- [ ] **Step 8: Register `/rbac`, `/rbac/new`, `/rbac/:id/edit`, and `/rbac/:id` routes.** Use the shared route registry and `rbac.view` as the menu permission.
- [ ] **Step 9: Run focused page tests and Admin build.** Expected: PASS and production build succeeds.
- [ ] **Step 10: Commit.** `git add apps/admin/src/pages/Rbac apps/admin/src/App.tsx apps/admin/src/components/Sidebar.tsx && git commit -m "feat(admin): 增加角色与菜单权限管理页面"`

### Task 8: Database sync, E2E coverage, documentation, and final quality gate

**Files:**

- Modify: `docs/06-api-specification/api-specification.md`
- Modify: `docs/09-development-guidelines/05-frontend-structure-and-api-contracts.md`
- Modify: relevant `scripts/*-policy.test.mjs` files when a new repository invariant is introduced
- Create or modify: Server RBAC E2E spec under `apps/server/test/`
- Create or modify: Admin RBAC Playwright spec under `apps/admin/e2e/`

- [ ] **Step 1: Add Server E2E coverage.** Start from a seeded isolated schema, log in as `super_admin`, create a restricted role, assign only `system.view`, assert settings read succeeds, publish fails with 403, and role permission replacement succeeds only with `rbac.role.update`.
- [ ] **Step 2: Add Admin Playwright coverage.** Log in with the seeded admin, open `/rbac`, create/edit a role, select one menu and one button, verify API-only nodes are read-only, and verify a restricted session does not render the publish button.
- [ ] **Step 3: Update API and frontend contract documentation.** Document `/admin/rbac/*`, shared catalog ownership, route registry rules, `PermissionGate`, and the rule that frontend checks never replace Server authorization.
- [ ] **Step 4: Run database synchronization in the local development workflow.** Use `pnpm --filter @petcare/server prisma:push -- --accept-data-loss` only for the fresh development database, then `pnpm --filter @petcare/server prisma:seed`; do not generate a migration.
- [ ] **Step 5: Run focused verification.** Run shared-types tests, Server RBAC tests, Admin RBAC tests, Server E2E, and Admin Playwright. Expected: PASS with no orphan permission authorization.
- [ ] **Step 6: Run the full project gate.** Run `pnpm check`, inspect for generated audit artifacts, remove only exact test-generated untracked artifacts, and verify `git diff --check` and `git status --short` are clean.
- [ ] **Step 7: Commit documentation and E2E changes.** `git add docs apps/server/test apps/admin/e2e scripts && git commit -m "test(rbac): 完成权限管理端到端校验"`

## Plan Self-Review

- Shared catalog, API contracts, Server module, seed synchronization, Admin route generation, button gates, role pages, audit/security controls, and E2E acceptance each have an explicit task.
- No task introduces a database menu editor or bypasses `PermissionGuard`.
- Later task interfaces use the exact catalog, API, tree, and hook names established earlier.
- The plan contains no unresolved placeholders; every task has a focused test command and commit boundary.
