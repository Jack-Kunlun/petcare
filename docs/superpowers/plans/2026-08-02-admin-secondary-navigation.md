# Admin PC 二级侧栏导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** 将 Admin PC 后台统一为一级侧栏、二级侧栏和独立内容滚动区域，并移除页面顶部模块导航。

**Architecture:** 共享 RBAC 目录继续提供菜单层级，Admin 路由注册表提供页面元素和 URL 匹配；`Sidebar` 只负责一级菜单，新增 `SecondarySidebar` 负责当前模块的二级菜单，`Layout` 固定视口高度并把滚动限制在 `main`。RBAC 角色和菜单目录拆成独立路由页面。

**Tech Stack:** React 19、React Router、Tailwind CSS v4、Vitest、Testing Library、`@petcare/shared-types`。

## Global Constraints

- 本次只改造 PC 后台，移动端导航保持现状。
- 请求与权限类型继续来自 `@petcare/shared-types`，Admin 不新增未登记权限码。
- 服务端权限守卫仍是最终授权边界；侧栏只做入口过滤。
- 优先使用 Tailwind 工具类，只有无法表达的样式才新增 SCSS。
- 代码使用双引号、分号和 2 空格缩进。

---

### Task 1: 扩展共享 RBAC 菜单目录

**Files:**

- Modify: `packages/shared-types/src/rbac/permission-catalog.ts`
- Test: `packages/shared-types/src/rbac/permission-catalog.spec.ts`

**Interfaces:**

- Produces menu permission `rbac.catalog.view` with path `/rbac/catalog`, parent `system.view`, and implied API `rbac.permission.read`.

- [ ] **Step 1: Write the failing catalog assertion**

在 `permission-catalog.spec.ts` 的菜单路径断言中加入 `/rbac/catalog`，并增加：

```ts
expect(byCode.get("rbac.catalog.view")).toMatchObject({
  type: RBAC_PERMISSION_TYPES.MENU,
  path: "/rbac/catalog",
  parentCode: "system.view",
  impliedApiCodes: ["rbac.permission.read"],
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec vitest run packages/shared-types/src/rbac/permission-catalog.spec.ts`

Expected: FAIL because the new permission is not in the catalog.

- [ ] **Step 3: Add the minimal shared permission definition**

在 `rbac.view` 菜单定义附近新增：

```ts
{
  code: "rbac.catalog.view",
  type: "menu",
  label: "菜单目录",
  module: "rbac",
  path: "/rbac/catalog",
  parentCode: "system.view",
  order: 70,
  icon: "ShieldCheck",
  impliedApiCodes: ["rbac.permission.read"],
}
```

同时将菜单路径期望列表更新为包含 `/rbac/catalog`。

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm exec vitest run packages/shared-types/src/rbac/permission-catalog.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit the shared catalog change**

```bash
git add packages/shared-types/src/rbac/permission-catalog.ts packages/shared-types/src/rbac/permission-catalog.spec.ts
git commit -m "feat(rbac): 增加菜单目录页面权限"
```

### Task 2: 重构路由注册表和菜单查询

**Files:**

- Modify: `apps/admin/src/routes/registry.ts`
- Test: `apps/admin/src/routes/registry.test.ts`

**Interfaces:**

- Produces `getVisibleRootMenuRoutes(permissionCodes)` and `getVisibleChildMenuRoutes(parentPath, permissionCodes)`。
- Produces `/rbac/catalog` route backed by the menu catalog page component。

- [ ] **Step 1: Add failing tests for root/child route queries**

在 `registry.test.ts` 增加：

```ts
it("returns root and child menu routes in catalog order", () => {
  expect(
    getVisibleRootMenuRoutes(["system.view", "rbac.view", "rbac.catalog.view"]).map(
      (route) => route.path,
    ),
  ).toEqual(["/settings"]);
  expect(
    getVisibleChildMenuRoutes("/settings", ["system.view", "rbac.view", "rbac.catalog.view"]).map(
      (route) => route.path,
    ),
  ).toEqual(["/rbac", "/rbac/catalog"]);
});
```

同时增加 `/rbac/catalog` 路由存在、所需权限为 `rbac.catalog.view` 的断言。

- [ ] **Step 2: Run the focused route tests and verify they fail**

Run: `pnpm --filter @petcare/admin exec vitest run src/routes/registry.test.ts`

Expected: FAIL because the helper functions and route are not implemented.

- [ ] **Step 3: Implement route metadata and menu helpers**

实现以下逻辑：

```ts
export function getVisibleRootMenuRoutes(
  permissionCodes: readonly string[],
): AdminRouteDefinition[];
export function getVisibleChildMenuRoutes(
  parentPath: string,
  permissionCodes: readonly string[],
): AdminRouteDefinition[];
```

菜单查询必须基于 `menuPermission`、`parentPath` 和 `order`，不能在 Admin 重新声明权限层级。将 `Rbac` 保留为角色列表页，新增 `RbacCatalog` 页面导入，并通过 `catalogMenuRoute("rbac-catalog", "rbac.catalog.view", createElement(RbacCatalog))` 注册 `/rbac/catalog`。

- [ ] **Step 4: Run the focused route tests and verify they pass**

Run: `pnpm --filter @petcare/admin exec vitest run src/routes/registry.test.ts`

Expected: PASS.

### Task 3: 实现 PC 一级/二级侧栏和固定滚动布局

**Files:**

- Create: `apps/admin/src/components/SecondarySidebar.tsx`
- Create: `apps/admin/src/components/SecondarySidebar.test.tsx`
- Modify: `apps/admin/src/components/Sidebar.tsx`
- Modify: `apps/admin/src/components/Sidebar.test.tsx`
- Modify: `apps/admin/src/components/Layout.tsx`
- Create or modify: `apps/admin/src/components/Layout.test.tsx`

**Interfaces:**

- `SecondarySidebar` 接收 `permissions?: string[]`，根据当前 `useLocation()` 自动显示当前一级模块的二级链接。
- `Sidebar` 仅渲染根菜单，保留现有权限过滤、图标和关闭抽屉行为。

- [ ] **Step 1: Add failing layout and sidebar tests**

覆盖以下断言：

```tsx
expect(screen.getByRole("navigation", { name: "后台二级导航" })).toBeInTheDocument();
expect(screen.getByRole("link", { name: "认证审核" })).toHaveAttribute(
  "href",
  "/users/certifications",
);
expect(screen.getByRole("link", { name: "订单管理" })).toHaveAttribute("href", "/orders");
```

Layout 测试断言根节点、内容列和 `main` 包含 `h-screen overflow-hidden`、`min-h-0`、`overflow-y-auto`，并且当前内容较长时滚动约束仍存在。

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm --filter @petcare/admin exec vitest run src/components/Sidebar.test.tsx src/components/SecondarySidebar.test.tsx src/components/Layout.test.tsx`

Expected: FAIL because the secondary component and fixed height classes are absent.

- [ ] **Step 3: Implement the fixed PC layout**

将 `Layout` 调整为：

```tsx
<div className="flex h-screen min-h-0 overflow-hidden bg-slate-50">
  <Sidebar ... />
  <SecondarySidebar permissions={auth.user?.permissions ?? []} />
  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <Header ... />
    <main className="min-h-0 flex-1 overflow-y-auto p-4 ...">
      <Outlet />
    </main>
  </div>
</div>
```

给桌面侧栏设置 `h-screen min-h-0 overflow-y-auto`；不改变移动端抽屉的交互。二级侧栏在 PC 断点显示，当前模块没有可见子菜单时不渲染。

- [ ] **Step 4: Implement the secondary sidebar**

使用 `getVisibleChildMenuRoutes()` 和 `NavLink`，支持：

- 当前子页面、详情页和编辑页高亮其所属入口；
- 菜单链接有 `aria-current` 和可见焦点样式；
- 侧栏使用独立 `overflow-y-auto`，不会增加主页面高度；
- 只显示当前用户拥有的菜单权限。

- [ ] **Step 5: Run focused tests and static height regression**

Run: `pnpm --filter @petcare/admin exec vitest run src/components/Sidebar.test.tsx src/components/SecondarySidebar.test.tsx src/components/Layout.test.tsx`

Expected: PASS。

同时运行：

```powershell
$layout = Get-Content apps/admin/src/components/Layout.tsx -Raw
if ($layout -notmatch "h-screen" -or $layout -notmatch "min-h-0" -or $layout -notmatch "overflow-y-auto") { exit 1 }
```

Expected: exit code 0。

### Task 4: 移除页面顶部导航并拆分 RBAC 菜单目录页

**Files:**

- Delete: `apps/admin/src/pages/UserManagement/Navigation.tsx`
- Delete: `apps/admin/src/pages/OrderManagement/Navigation.tsx`
- Create: `apps/admin/src/pages/Rbac/Catalog.tsx`
- Modify: `apps/admin/src/pages/UserManagement/index.tsx`
- Modify: `apps/admin/src/pages/UserManagement/Certification/index.tsx`
- Modify: `apps/admin/src/pages/OrderManagement/index.tsx`
- Modify: `apps/admin/src/pages/OrderManagement/Complaint/index.tsx`
- Modify: `apps/admin/src/pages/Rbac/index.tsx`
- Test: corresponding page test files and `apps/admin/src/pages/Rbac/Catalog.test.tsx`

**Interfaces:**

- `Rbac` renders only role management content; no local `ActiveTab` state。
- `RbacCatalog` renders existing read-only catalog content and calls `fetchRbacCatalog()`。

- [ ] **Step 1: Add failing page assertions**

更新页面测试，断言用户、订单和投诉页面不再存在模块二级导航；新增 `Catalog.test.tsx` 断言菜单目录标题、只读目录和 API 权限隐藏。

- [ ] **Step 2: Run page tests and verify the expected failures**

Run: `pnpm --filter @petcare/admin exec vitest run src/pages/UserManagement src/pages/OrderManagement src/pages/Rbac`

Expected: FAIL until the existing top navigation and RBAC tab state are removed.

- [ ] **Step 3: Extract the RBAC catalog component**

将现有 `PermissionCatalog` 和目录查询状态迁移到 `Rbac/Catalog.tsx`，保留只读展示和 `RBAC_PERMISSION_TYPES.API` 过滤；`Rbac/index.tsx` 只保留角色查询、分页、创建、编辑和删除逻辑。

- [ ] **Step 4: Remove page-level navigation imports and renders**

删除四个业务页面对 `UserManagementNavigation`/`OrderManagementNavigation` 的导入与渲染，保持筛选表单、队列筛选按钮、按钮级权限控制和详情链接不变。

- [ ] **Step 5: Run page tests and verify they pass**

Run: `pnpm --filter @petcare/admin exec vitest run src/pages/UserManagement src/pages/OrderManagement src/pages/Rbac`

Expected: PASS。

### Task 5: 全量格式、类型、测试和构建校验

**Files:**

- Modify: only files changed by Tasks 1-4 if formatting requires it.

- [ ] **Step 1: Build shared types**

Run: `pnpm --filter @petcare/shared-types build`

Expected: PASS and runtime exports include `rbac.catalog.view`.

- [ ] **Step 2: Run Admin formatting and lint checks**

Run: `pnpm exec prettier --check packages/shared-types/src/rbac/permission-catalog.ts packages/shared-types/src/rbac/permission-catalog.spec.ts apps/admin/src`; then `pnpm --filter @petcare/admin lint`。

Expected: PASS。

- [ ] **Step 3: Run type checks**

Run: `pnpm --filter @petcare/shared-types typecheck; pnpm --filter @petcare/admin typecheck`

Expected: PASS。

- [ ] **Step 4: Run focused and full Admin tests**

Run: `pnpm --filter @petcare/admin test:run`

Expected: PASS。

- [ ] **Step 5: Run the Admin production build**

Run: `pnpm --filter @petcare/admin build`

Expected: PASS, including the style output policy check.

- [ ] **Step 6: Review the final diff and commit**

Run: `git diff --check; git status --short`。

Commit with:

```bash
git add packages/shared-types/src/rbac apps/admin/src docs/superpowers/plans/2026-08-02-admin-secondary-navigation.md
git commit -m "feat(admin): 统一 PC 二级侧栏导航与内容滚动"
```
