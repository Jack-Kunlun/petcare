# Admin 编辑与配置页面统一布局 Implementation Plan

> For agentic workers: use the task brief as the only requirements source, do not spawn subagents, preserve unrelated changes, and commit only owned files.

**Goal:** 让现有 Admin 编辑、配置、审核和可恢复详情页使用同一页面骨架，并提供可靠的未保存离开保护和目标分辨率验证。

**Architecture:** 共享层只提供 EditorPageLayout、FormSection 和未保存保护；页面继续拥有所有业务状态与 mutation。Admin Router 切换为 Data Router 以使用官方 useBlocker。迁移按页面域分批完成。

**Tech Stack:** React 19、React Router 7、TanStack Query 5、Tailwind CSS 4、Radix Dialog、Vitest、Testing Library、Playwright。

**Spec:** docs/superpowers/specs/2026-08-25-admin-editor-page-layout-design.md

## Global Constraints

- 不改变 API、权限代码、字段、URL、数据模型或业务状态流。
- 不创建当前不存在的用户/订单编辑或帖子/悬赏审核页面。
- 不引入新依赖；复用 React Router、Radix Dialog、Tailwind 和现有 cn。
- Header 位于正常流；编辑页 sticky 使用 main 内 top-0，不增加 Shell 补偿。
- 宽度只使用 narrow 960、default 1200、wide 1440。
- FormSection 为 12px 圆角、24px padding、24px 间距。
- 普通编辑控件和页级按钮高 40px，操作间距 12px；关键触控目标可保留 44px。
- 页面继续决定 dirty 和保存成功清理；共享层不得读取表单数据或发起 mutation。
- 保留未涉及文件和当前工作树其他改动。

### Task 1: 建立 Shell Token 与共享页面骨架

**Files:**

- Modify: apps/admin/src/index.css
- Create: apps/admin/src/components/EditorPageLayout.tsx
- Create: apps/admin/src/components/EditorPageLayout.test.tsx
- Modify: apps/admin/src/components/Layout.tsx
- Modify: apps/admin/src/components/Layout.test.tsx
- Modify: apps/admin/src/components/Header.tsx
- Modify: apps/admin/src/components/Header.test.tsx
- Modify: apps/admin/src/components/Sidebar.tsx
- Modify: apps/admin/src/components/Sidebar.test.tsx
- Modify: apps/admin/src/components/PageTransition.tsx
- Modify: apps/admin/src/components/PageTransition.test.tsx

- [ ] Add failing tests for width variants, stable Header/content/footer DOM, FormSection defaults, Shell tokens, main min-width/overflow and transform-free PageTransition.
- [ ] Add the five CSS custom properties from the spec and make Header/Sidebar consume the Shell values.
- [ ] Implement EditorPageLayout with ReactNode slots for back, status, actions and optional footerActions; do not create a button design system.
- [ ] Implement FormSection in the same file because it is part of the same page-layout seam.
- [ ] Add min-w-0 and horizontal containment to main; remove retained transform from PageTransition.
- [ ] Run the new component tests plus Layout/Header/Sidebar/PageTransition tests.
- [ ] Run Admin lint:styles and typecheck for the touched shared layer.

### Task 2: 接入 Data Router 与统一未保存保护

**Files:**

- Modify: apps/admin/src/App.tsx
- Modify: apps/admin/src/App.test.tsx
- Create: apps/admin/src/hooks/useUnsavedChanges.ts
- Create: apps/admin/src/hooks/useUnsavedChanges.test.tsx
- Modify: apps/admin/src/components/EditorPageLayout.tsx
- Modify: apps/admin/src/components/EditorPageLayout.test.tsx

- [ ] Add failing tests proving existing routes and permission gates retain their shape under createBrowserRouter.
- [ ] Add a Memory/Data Router test proving dirty navigation blocks, “继续编辑” resets and “放弃修改” proceeds.
- [ ] Move BrowserRouter to createBrowserRouter and RouterProvider while preserving AuthProvider, GlobalErrorMessage, ProtectedRoute, PermissionRoute, lazy boundaries and all registry URLs.
- [ ] Implement useUnsavedChanges with beforeunload and useBlocker.
- [ ] Render one Radix unsaved confirmation Dialog from EditorPageLayout when a controller is supplied.
- [ ] Run App, route registry, shared layout and hook tests.

### Task 3: 迁移文章与官网页面

**Files:**

- Modify: apps/admin/src/pages/ContentManagement/Articles/Edit.tsx
- Modify: apps/admin/src/pages/ContentManagement/Articles/Edit.test.tsx
- Modify: apps/admin/src/pages/WebsiteContent/Edit.tsx
- Modify: apps/admin/src/pages/WebsiteContent/Edit.test.tsx
- Modify: apps/admin/src/pages/WebsiteContent/editors/fields.tsx

- [ ] Extend page tests to assert shared editor Header, top actions, width and dirty navigation protection.
- [ ] Replace article hand-written sticky Header and manual beforeunload/confirm with EditorPageLayout and useUnsavedChanges.
- [ ] Keep article actions limited to cancel/save; migrate outer cards to FormSection.
- [ ] Migrate Website Edit with top return/history/preview/save/publish and optional repeated bottom save/publish.
- [ ] Remove Website manual dirty guards and pass its existing dirty state to the shared hook.
- [ ] Normalize Website shared input/select fields and migrated page buttons to 40px.
- [ ] Run both page test files and shared layout/hook tests.

### Task 4: 迁移系统设置与 RBAC

**Files:**

- Modify: apps/admin/src/pages/Settings/Edit.tsx
- Modify: apps/admin/src/pages/Settings/Edit.test.tsx
- Modify: apps/admin/src/pages/Settings/SopEditor.tsx
- Modify: apps/admin/src/pages/Settings/RatingThresholdEditor.tsx
- Modify: apps/admin/src/pages/Settings/FeeEditor.tsx
- Modify: apps/admin/src/pages/Rbac/Edit.tsx
- Modify: apps/admin/src/pages/Rbac/Edit.test.tsx
- Modify: apps/admin/src/pages/Rbac/Detail.tsx
- Modify: apps/admin/src/pages/Rbac/Detail.test.tsx

- [ ] Add tests for shared wide/default layouts, top actions and dirty navigation protection.
- [ ] Migrate Settings Edit with top return/history/save/publish and repeated bottom save/publish.
- [ ] Pass its existing dirty state to useUnsavedChanges; normalize editor controls to 40px.
- [ ] Migrate RBAC new/edit and add minimal dirty tracking around existing field changes and save success.
- [ ] Migrate RBAC Detail; keep read-only details and existing linked-admin replacement semantics, adding dirty protection only for that editable textarea.
- [ ] Keep permission tree, mutation payloads, confirmation rules and query invalidation unchanged.
- [ ] Run Settings and RBAC Edit/Detail tests plus shared layout/hook tests.

### Task 5: 迁移审核与历史详情

**Files:**

- Modify: apps/admin/src/pages/UserManagement/Certification/Detail.tsx
- Modify: apps/admin/src/pages/UserManagement/Certification/Detail.test.tsx
- Modify: apps/admin/src/pages/OrderManagement/Complaint/Detail.tsx
- Modify: apps/admin/src/pages/OrderManagement/Complaint/Detail.test.tsx
- Modify: apps/admin/src/pages/WebsiteContent/Detail.tsx
- Modify: apps/admin/src/pages/WebsiteContent/Detail.test.tsx
- Modify: apps/admin/src/pages/Settings/Detail.tsx
- Modify: apps/admin/src/pages/Settings/Detail.test.tsx

- [ ] Add tests for shared review/read-only layout, status and top-level actions.
- [ ] Migrate certification review and expose only currently allowed approve/reject actions at the top; retain the existing bottom repetition and Dialogs.
- [ ] Replace Complaint Detail’s nested main with a semantic div/section and make the current allowed workbench actions reachable from the top without changing their conditions.
- [ ] Migrate Website and Settings history details to narrow layout and surface their existing restore/copy action at the top.
- [ ] Preserve all mutation payloads, permission checks, confirmation Dialogs and retry behavior.
- [ ] Run the four page test files and shared layout tests.

### Task 6: 响应式回归、全局扫描与交付验证

**Files:**

- Create or Modify: apps/admin/e2e/editor-page-layout.spec.ts
- Modify only if required by test reuse: apps/admin/e2e/fixtures/*

- [ ] Add one focused responsive contract covering representative edit, review and history pages with existing E2E fixture patterns.
- [ ] Exercise 1920×1080、1920×1200、1600×900、1440×900、1366×768 and assert top actions visible plus no document-level horizontal overflow.
- [ ] Scan Admin routes/pages for remaining new/edit/config/detail-review page roots and record intentional exclusions.
- [ ] Run affected page/component tests, then the full Admin Vitest suite because Router and Shell are shared.
- [ ] Run Admin lint, lint:styles, typecheck and production build.
- [ ] Run the focused Playwright spec when its existing backend fixture prerequisites are available; report exact status if infrastructure blocks it.
- [ ] Run git diff --check and inspect the final changed-file list.
- [ ] Produce the final migrated/unmigrated/deleted-duplicates/shared-components/technical-debt report.
