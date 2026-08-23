# Admin 全局错误提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让全后台 API 最终失败统一展示 Server `message`，普通错误采用首条占用 3 秒规则，会话失效错误可高优先级抢占。

**Architecture:** 使用一个无依赖的模块级外部 store 保存唯一提示，React 根组件通过 `useSyncExternalStore` 订阅。React Query 的全局 cache 回调负责查询与 mutation 的最终失败，直接事件请求显式调用同一入口；Axios 认证刷新仅向 `AuthProvider` 发出不可恢复会话失效事件。

**Tech Stack:** React 19、React Query 5、Axios、Vitest、Testing Library、Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-08-23-admin-auth-and-classroom-publishing-design.md`

## Global Constraints

- 提示固定显示 3 秒，同时最多一条。
- 当前存在普通提示时，后续普通提示直接忽略，不排队、不替换、不延长计时。
- 只有已认证会话被认证生命周期判定失效并退出时才使用 `session` 优先级；普通 HTTP 401 仍是普通错误。
- `session` 提示覆盖当前提示并重新计时；普通提示不能覆盖 `session` 提示。
- 首次匿名会话恢复、自动刷新成功、主动退出登录不产生高优先级提示。
- Server `message` 缺失时使用“请求失败，请稍后重试”。
- 保留字段级本地校验和带重试操作的结构性错误区，但 API 错误不再写死页面级文案。
- 不引入 toast 或消息队列依赖。
- 所有新增公共函数和共享字段写明用途；代码使用双引号、分号和 2 空格缩进。

---

### Task 1: 单例消息 store 与根提示组件

**Files:**

- Create: `apps/admin/src/lib/global-error.ts`
- Create: `apps/admin/src/lib/global-error.test.ts`
- Create: `apps/admin/src/components/GlobalErrorMessage.tsx`
- Create: `apps/admin/src/components/GlobalErrorMessage.test.tsx`
- Modify: `apps/admin/src/api/api-response.ts`
- Modify: `apps/admin/src/api/api-response.test.ts`

**Interfaces:**

- Produces: `showGlobalError(message: string, priority?: "normal" | "session"): void`
- Produces: `showApiError(error: unknown, priority?: "normal" | "session"): void`
- Produces: `dismissGlobalError(expectedId?: number): void`
- Produces: `subscribeGlobalError(listener: () => void): () => void`
- Produces: `getGlobalErrorSnapshot(): GlobalErrorSnapshot | null`
- Produces: `<GlobalErrorMessage />`

- [ ] **Step 1: Write failing tests for Axios message extraction and priority rules**

```ts
// apps/admin/src/api/api-response.test.ts
it("reads a server message from an Axios-shaped error", () => {
  expect(readApiErrorMessage({ response: { data: { message: "文章状态已变化" } } })).toBe(
    "文章状态已变化",
  );
  expect(readApiErrorMessage(new Error("internal detail"))).toBe("请求失败，请稍后重试");
});

// apps/admin/src/lib/global-error.test.ts
beforeEach(() => dismissGlobalError());

it("keeps the first normal error and drops later normal errors", () => {
  showGlobalError("第一个错误");
  showGlobalError("第二个错误");

  expect(getGlobalErrorSnapshot()?.message).toBe("第一个错误");
});

it("lets a session error replace the current error", () => {
  showGlobalError("普通错误");
  showGlobalError("登录状态已失效", "session");
  showGlobalError("稍后的普通错误");

  expect(getGlobalErrorSnapshot()).toMatchObject({
    message: "登录状态已失效",
    priority: "session",
  });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/api-response.test.ts src/lib/global-error.test.ts --pool=forks --maxWorkers=1
```

Expected: FAIL because Axios-shaped errors are not read and `global-error.ts` does not exist.

- [ ] **Step 3: Implement the message extractor and minimal external store**

```ts
// apps/admin/src/api/api-response.ts
export function readApiErrorMessage(error: unknown): string {
  const payload =
    typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { data?: unknown } }).response?.data
      : error;
  const message =
    typeof payload === "object" && payload !== null
      ? (payload as { message?: unknown }).message
      : undefined;

  return typeof message === "string" && message.trim().length > 0
    ? message
    : "请求失败，请稍后重试";
}

// apps/admin/src/lib/global-error.ts
import { readApiErrorMessage } from "../api/api-response";

export type GlobalErrorPriority = "normal" | "session";

export interface GlobalErrorSnapshot {
  id: number;
  message: string;
  priority: GlobalErrorPriority;
}

let sequence = 0;
let snapshot: GlobalErrorSnapshot | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function showGlobalError(message: string, priority: GlobalErrorPriority = "normal"): void {
  if (snapshot && priority === "normal") return;

  snapshot = { id: ++sequence, message, priority };
  emit();
}

export function showApiError(error: unknown, priority: GlobalErrorPriority = "normal"): void {
  showGlobalError(readApiErrorMessage(error), priority);
}

export function dismissGlobalError(expectedId?: number): void {
  if (!snapshot || (expectedId !== undefined && snapshot.id !== expectedId)) return;

  snapshot = null;
  emit();
}

export function subscribeGlobalError(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGlobalErrorSnapshot(): GlobalErrorSnapshot | null {
  return snapshot;
}
```

- [ ] **Step 4: Run the store tests and verify they pass**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/api-response.test.ts src/lib/global-error.test.ts --pool=forks --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 5: Write the failing component timer and replacement tests**

```tsx
// apps/admin/src/components/GlobalErrorMessage.test.tsx
beforeEach(() => {
  vi.useFakeTimers();
  dismissGlobalError();
});

afterEach(() => vi.useRealTimers());

it("shows only the first normal error for three seconds", () => {
  render(<GlobalErrorMessage />);
  act(() => {
    showGlobalError("第一个错误");
    showGlobalError("被忽略的错误");
  });

  expect(screen.getByRole("alert")).toHaveTextContent("第一个错误");
  act(() => vi.advanceTimersByTime(3_000));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();

  act(() => showGlobalError("三秒后的新错误"));
  expect(screen.getByRole("alert")).toHaveTextContent("三秒后的新错误");
});

it("restarts the timer when a session error takes over", () => {
  render(<GlobalErrorMessage />);
  act(() => showGlobalError("普通错误"));
  act(() => vi.advanceTimersByTime(2_000));
  act(() => showGlobalError("登录状态已失效", "session"));
  act(() => vi.advanceTimersByTime(1_500));

  expect(screen.getByRole("alert")).toHaveTextContent("登录状态已失效");
});
```

- [ ] **Step 6: Run the component test and verify it fails**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/components/GlobalErrorMessage.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because `GlobalErrorMessage.tsx` does not exist.

- [ ] **Step 7: Implement the accessible root component**

```tsx
// apps/admin/src/components/GlobalErrorMessage.tsx
import { X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import {
  dismissGlobalError,
  getGlobalErrorSnapshot,
  subscribeGlobalError,
} from "../lib/global-error";

export function GlobalErrorMessage() {
  const current = useSyncExternalStore(
    subscribeGlobalError,
    getGlobalErrorSnapshot,
    getGlobalErrorSnapshot,
  );

  useEffect(() => {
    if (!current) return;

    const timer = window.setTimeout(() => dismissGlobalError(current.id), 3_000);
    return () => window.clearTimeout(timer);
  }, [current]);

  if (!current) return null;

  return (
    <div
      role="alert"
      className="fixed left-1/2 top-4 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-3 rounded-lg bg-red-700 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>{current.message}</span>
      <button
        type="button"
        aria-label="关闭错误提示"
        className="cursor-pointer rounded p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={() => dismissGlobalError(current.id)}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Run all Task 1 tests and verify they pass**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/api-response.test.ts src/lib/global-error.test.ts src/components/GlobalErrorMessage.test.tsx --pool=forks --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```powershell
git add -- apps/admin/src/api/api-response.ts apps/admin/src/api/api-response.test.ts apps/admin/src/lib/global-error.ts apps/admin/src/lib/global-error.test.ts apps/admin/src/components/GlobalErrorMessage.tsx apps/admin/src/components/GlobalErrorMessage.test.tsx
git commit -m "feat(admin): 增加全局单条错误提示"
```

### Task 2: React Query 最终失败接入

**Files:**

- Create: `apps/admin/src/query-client.ts`
- Create: `apps/admin/src/query-client.test.ts`
- Modify: `apps/admin/src/main.tsx`

**Interfaces:**

- Consumes: `showApiError(error: unknown): void` from Task 1
- Produces: `createAdminQueryClient(): QueryClient`

- [ ] **Step 1: Write failing tests for final query and mutation failures**

```ts
// apps/admin/src/query-client.test.ts
vi.mock("./lib/global-error", () => ({ showApiError: vi.fn() }));

it("reports one query error only after retries are exhausted", async () => {
  const client = createAdminQueryClient();
  const queryFn = vi.fn().mockRejectedValue(new Error("offline"));

  await expect(client.fetchQuery({ queryKey: ["failure"], queryFn })).rejects.toThrow();
  expect(queryFn).toHaveBeenCalledTimes(3);
  expect(showApiError).toHaveBeenCalledTimes(1);
});

it("reports a failed mutation once", async () => {
  const client = createAdminQueryClient();
  const mutation = client.getMutationCache().build(client, {
    mutationFn: async () => Promise.reject(new Error("save failed")),
  });

  await expect(mutation.execute(undefined)).rejects.toThrow("save failed");
  expect(showApiError).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/query-client.test.ts --pool=forks --maxWorkers=1
```

Expected: FAIL because `createAdminQueryClient` does not exist.

- [ ] **Step 3: Implement the testable QueryClient factory and use it at startup**

```ts
// apps/admin/src/query-client.ts
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { showApiError } from "./lib/global-error";

export function createAdminQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: showApiError }),
    mutationCache: new MutationCache({ onError: showApiError }),
    defaultOptions: {
      queries: { retry: 2, refetchOnWindowFocus: false },
    },
  });
}

// apps/admin/src/main.tsx
const queryClient = createAdminQueryClient();
```

Replace the direct `new QueryClient(...)` construction in `main.tsx`; keep `QueryClientProvider` unchanged.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/query-client.test.ts --pool=forks --maxWorkers=1
```

Expected: PASS with three query attempts and one global notification.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- apps/admin/src/query-client.ts apps/admin/src/query-client.test.ts apps/admin/src/main.tsx
git commit -m "feat(admin): 统一展示请求最终失败"
```

### Task 3: 不可恢复会话失效的高优先级通道

**Files:**

- Modify: `apps/admin/src/api/auth.ts`
- Modify: `apps/admin/src/api/auth.test.ts`
- Modify: `apps/admin/src/auth/AuthProvider.tsx`
- Modify: `apps/admin/src/auth/AuthProvider.test.tsx`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/App.test.tsx`

**Interfaces:**

- Consumes: `showGlobalError(message, "session")` from Task 1
- Produces: `onSessionExpired(listener: (message: string) => void): () => void`
- Preserves: initial `refreshSession()` failure remains silent and changes status to `anonymous`

- [ ] **Step 1: Write failing interceptor and provider tests**

```ts
// apps/admin/src/api/auth.test.ts
it("emits one session event when refresh cannot recover an authenticated request", async () => {
  const authModule = await import("./auth");
  const onRejected = axiosMocks.responseUse.mock.calls[0]?.[1] as (
    error: Record<string, unknown>,
  ) => Promise<unknown>;
  const listener = vi.fn();
  const unsubscribe = authModule.onSessionExpired(listener);
  const refreshError = {
    response: {
      status: 401,
      data: { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" },
    },
  };
  axiosMocks.client.post.mockRejectedValue(refreshError);

  await expect(
    onRejected({
      config: {
        headers: { has: vi.fn(() => true), set: vi.fn() },
        url: "/admin/account/profile",
      },
      response: {
        status: 401,
        data: { code: "AUTH_SESSION_EXPIRED", message: "登录状态已失效" },
      },
    }),
  ).rejects.toBe(refreshError);
  expect(listener).toHaveBeenCalledWith("登录状态已失效");
  unsubscribe();
});

// apps/admin/src/auth/AuthProvider.test.tsx
it("invalidates an authenticated session and emits a priority message", async () => {
  vi.mocked(authApi.refreshSession).mockResolvedValue({ accessToken: "access" });
  vi.mocked(authApi.getCurrentUser).mockResolvedValue(adminUser);
  render(<AuthProvider><StateProbe /></AuthProvider>);
  await screen.findByText("系统管理员");

  act(() => authEvents.sessionExpiredListener?.("登录状态已失效"));

  expect(screen.getByText("anonymous")).toBeInTheDocument();
  expect(globalErrors.showGlobalError).toHaveBeenCalledWith("登录状态已失效", "session");
});
```

In the `authApi` mock, capture the callback supplied to `onSessionExpired` and return a cleanup function. Mock `showGlobalError` from `../lib/global-error`.

```tsx
const authEvents = vi.hoisted(() => ({
  sessionExpiredListener: undefined as ((message: string) => void) | undefined,
}));
const globalErrors = vi.hoisted(() => ({
  showApiError: vi.fn(),
  showGlobalError: vi.fn(),
}));

vi.mock("../api/auth", () => ({
  clearAccessToken: vi.fn(),
  getCaptcha: vi.fn(),
  getCurrentUser: vi.fn(),
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  logout: vi.fn(),
  onSessionExpired: vi.fn((listener: (message: string) => void) => {
    authEvents.sessionExpiredListener = listener;
    return () => {
      authEvents.sessionExpiredListener = undefined;
    };
  }),
  refreshSession: vi.fn(),
  sendSmsCode: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock("../lib/global-error", () => globalErrors);
```

- [ ] **Step 2: Run auth tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/auth.test.ts src/auth/AuthProvider.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because the session event seam does not exist.

- [ ] **Step 3: Add the session listener and emit only after failed recovery**

```ts
// apps/admin/src/api/auth.ts
import { readApiErrorMessage, unwrapApiResponse } from "./api-response";

type SessionExpiredListener = (message: string) => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function emitSessionExpired(error: AxiosError<ApiErrorResponse>): void {
  const message = readApiErrorMessage(error);
  clearAccessToken();
  for (const listener of sessionExpiredListeners) listener(message);
}
```

Update the response interceptor with these exact branches:

```ts
if (isExpiredSession && request?._authRetried) {
  emitSessionExpired(error);
  return Promise.reject(error);
}

if (
  !isExpiredSession ||
  !request ||
  isAuthenticationRequest ||
  !request.headers.has("Authorization")
) {
  return Promise.reject(error);
}

request._authRetried = true;
refreshPromise ??= apiClient
  .post<AdminRefreshResponse>("/auth/refresh")
  .then((response) => {
    setAccessToken(response.data.accessToken);
    return response.data.accessToken;
  })
  .finally(() => {
    refreshPromise = null;
  });

try {
  const token = await refreshPromise;
  request.headers.set("Authorization", `Bearer ${token}`);
  return apiClient(request);
} catch (refreshError) {
  emitSessionExpired(refreshError as AxiosError<ApiErrorResponse>);
  return Promise.reject(refreshError);
}
```

Do not emit from `/auth/refresh` itself, login endpoints, requests without an Authorization header, or initial `refreshSession()`.

- [ ] **Step 4: Subscribe only while AuthProvider is authenticated**

```tsx
// apps/admin/src/auth/AuthProvider.tsx
useEffect(() => {
  if (status !== "authenticated") return;

  return authApi.onSessionExpired((message) => {
    authApi.clearAccessToken();
    setUser(null);
    setStatus("anonymous");
    showGlobalError(message, "session");
  });
}, [status]);
```

- [ ] **Step 5: Mount the global component outside the auth router**

```tsx
// apps/admin/src/App.tsx
import { GlobalErrorMessage } from "./components/GlobalErrorMessage";

return (
  <>
    <GlobalErrorMessage />
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              {ADMIN_ROUTE_REGISTRY.map((route) => (
                <Route
                  key={route.id}
                  element={<PermissionRoute requireAll={route.requiredPermissions} />}
                >
                  {route.path === "/" ? (
                    <Route index element={route.element} />
                  ) : (
                    <Route path={route.path} element={route.element} />
                  )}
                </Route>
              ))}
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </>
);
```

Add this root-lifetime assertion to `App.test.tsx` and add `act` to its Testing Library import:

```tsx
vi.mock("./components/GlobalErrorMessage", () => ({
  GlobalErrorMessage: () => <div data-testid="global-error-root" />,
}));

it("keeps the global message root mounted across a redirect to login", async () => {
  window.history.replaceState({}, "", "/account");
  render(<App />);
  expect(screen.getByTestId("global-error-root")).toBeInTheDocument();

  act(() => {
    window.history.pushState({}, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  expect(screen.getByTestId("global-error-root")).toBeInTheDocument();
});
```

- [ ] **Step 6: Run auth and root tests and verify they pass**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/auth.test.ts src/auth/AuthProvider.test.tsx src/App.test.tsx --pool=forks --maxWorkers=1
```

Expected: PASS; the initial anonymous restore test remains silent.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- apps/admin/src/api/auth.ts apps/admin/src/api/auth.test.ts apps/admin/src/auth/AuthProvider.tsx apps/admin/src/auth/AuthProvider.test.tsx apps/admin/src/App.tsx apps/admin/src/App.test.tsx
git commit -m "fix(admin): 优先提示登录状态失效"
```

### Task 4: 直接 API 事件统一使用 Server message

**Files:**

- Modify: `apps/admin/src/pages/Login/index.tsx`
- Modify: `apps/admin/src/pages/Login/index.test.tsx`
- Modify: `apps/admin/src/pages/Account/ProfileCard.tsx`
- Modify: `apps/admin/src/pages/Account/PasswordCard.tsx`
- Modify: `apps/admin/src/pages/Account/index.test.tsx`
- Modify: `apps/admin/src/auth/AuthProvider.tsx`
- Modify: `apps/admin/src/auth/AuthProvider.test.tsx`

**Interfaces:**

- Consumes: `showApiError(error)` from Task 1
- Preserves: field validation messages remain local; Query-managed requests remain owned by Task 2

- [ ] **Step 1: Change existing tests to require Server messages through the global seam**

```tsx
const globalErrors = vi.hoisted(() => ({ showApiError: vi.fn() }));
vi.mock("../../lib/global-error", () => globalErrors);

it("routes a failed login through the global API message", async () => {
  const failure = { response: { data: { message: "账号或凭据错误" } } };
  auth.loginWithPassword.mockRejectedValue(failure);
  const user = userEvent.setup();
  renderLogin();

  await user.type(screen.getByLabelText("手机号或账号"), "admin");
  await user.type(screen.getByLabelText("密码"), "Wrong-Password-Value!42");
  await user.click(screen.getByRole("button", { name: "登录" }));

  await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(failure));
  expect(screen.queryByText("登录失败，请检查账号或凭据")).not.toBeInTheDocument();
});
```

Add the same hoisted `globalErrors` mock to `Account/index.test.tsx`, then add these exact direct-action cases. Keep the existing invalid file and password-confirmation assertions unchanged because those errors never cross the API boundary.

```tsx
it("routes profile action failures through the global API message", async () => {
  const nicknameFailure = { response: { data: { message: "昵称已被占用" } } };
  const uploadFailure = { response: { data: { message: "头像文件无效" } } };
  const removeFailure = { response: { data: { message: "头像移除失败" } } };
  const user = userEvent.setup();
  const { container } = renderAccount();
  await screen.findByDisplayValue("系统管理员");

  api.updateAdminAccountProfile.mockRejectedValueOnce(nicknameFailure);
  await user.clear(screen.getByLabelText("昵称"));
  await user.type(screen.getByLabelText("昵称"), "新昵称");
  await user.click(screen.getByRole("button", { name: "保存昵称" }));
  await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(nicknameFailure));

  const input = container.querySelector("input[type=file]") as HTMLInputElement;
  api.uploadAdminAvatar.mockRejectedValueOnce(uploadFailure);
  fireEvent.change(input, {
    target: { files: [new File(["image"], "avatar.png", { type: "image/png" })] },
  });
  await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(uploadFailure));

  api.uploadAdminAvatar.mockResolvedValueOnce({ avatar: "https://cdn.example/avatar.png" });
  fireEvent.change(input, {
    target: { files: [new File(["image"], "avatar.png", { type: "image/png" })] },
  });
  await screen.findByRole("img", { name: "当前头像" });
  api.deleteAdminAvatar.mockRejectedValueOnce(removeFailure);
  await user.click(screen.getByRole("button", { name: "移除头像" }));
  await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(removeFailure));
});

it("routes password request failures through the global API message", async () => {
  const failure = { response: { data: { message: "当前密码错误" } } };
  api.changeAdminPassword.mockRejectedValue(failure);
  const user = userEvent.setup();
  renderAccount();
  await screen.findByDisplayValue("系统管理员");

  await user.type(screen.getByLabelText("当前密码"), "Old-password-value!42");
  await user.type(screen.getByLabelText("新密码"), "New-password-value!42");
  await user.type(screen.getByLabelText("确认新密码"), "New-password-value!42");
  await user.click(screen.getByRole("button", { name: "修改密码" }));

  await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(failure));
  expect(auth.invalidateLocalSession).not.toHaveBeenCalled();
});
```

Add a logout probe to `AuthProvider.test.tsx` so failure still clears the local session while reporting only a normal API error:

```tsx
function LogoutProbe() {
  const auth = useAuth();

  return (
    <>
      <span>{auth.status}</span>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
    </>
  );
}

it("reports logout failure and still clears the local session", async () => {
  const failure = { response: { data: { message: "退出登录失败" } } };
  vi.mocked(authApi.refreshSession).mockResolvedValue({ accessToken: "access" });
  vi.mocked(authApi.getCurrentUser).mockResolvedValue(adminUser);
  vi.mocked(authApi.logout).mockRejectedValue(failure);
  render(
    <AuthProvider>
      <LogoutProbe />
    </AuthProvider>,
  );
  await screen.findByText("authenticated");

  fireEvent.click(screen.getByRole("button", { name: "logout" }));

  await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(failure));
  expect(authApi.clearAccessToken).toHaveBeenCalled();
  expect(screen.getByText("anonymous")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Login, Account, and AuthProvider tests and verify they fail**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/pages/Login/index.test.tsx src/pages/Account/index.test.tsx src/auth/AuthProvider.test.tsx --pool=forks --maxWorkers=1
```

Expected: FAIL because catch blocks still replace Server messages with local generic strings.

- [ ] **Step 3: Route only direct request failures through `showApiError`**

Use this catch pattern in `Login`, `ProfileCard`, and `PasswordCard`:

```ts
} catch (error) {
  showApiError(error);
} finally {
  setPending(false);
}
```

Keep `setError(...)` only for client-side validation. In `Login.loadCaptcha`, retain `captchaLoadError=true` for the inline retry control and also call `showApiError(error)`.

Handle intentional logout without throwing an unhandled rejection:

```ts
const logout = useCallback(async () => {
  try {
    await authApi.logout();
  } catch (error) {
    showApiError(error);
  } finally {
    authApi.clearAccessToken();
    setUser(null);
    setStatus("anonymous");
  }
}, []);
```

This logout error stays `normal`; it must not call `showGlobalError(..., "session")`.

- [ ] **Step 4: Audit every non-test catch site**

Run:

```powershell
rg -n "\bcatch\b" apps/admin/src --glob "*.ts" --glob "*.tsx" --glob "!*.test.ts" --glob "!*.test.tsx"
```

Expected ownership:

- `AuthProvider` startup restore: intentionally silent.
- `AuthProvider` logout: calls `showApiError`, then clears local session.
- `Login`: API failures call `showApiError`; field errors stay local.
- `ProfileCard` and `PasswordCard`: API failures call `showApiError`; field/file validation stays local.
- `Settings/domain-api.ts`: expected 404 becomes `null`; every other error is rethrown to React Query.

- [ ] **Step 5: Run focused behavior tests**

Run:

```powershell
pnpm --filter @petcare/admin exec vitest run src/api/api-response.test.ts src/lib/global-error.test.ts src/components/GlobalErrorMessage.test.tsx src/query-client.test.ts src/api/auth.test.ts src/auth/AuthProvider.test.tsx src/pages/Login/index.test.tsx src/pages/Account/index.test.tsx src/App.test.tsx --pool=forks --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 6: Run scoped quality gates**

Run:

```powershell
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- apps/admin/src/pages/Login/index.tsx apps/admin/src/pages/Login/index.test.tsx apps/admin/src/pages/Account/ProfileCard.tsx apps/admin/src/pages/Account/PasswordCard.tsx apps/admin/src/pages/Account/index.test.tsx apps/admin/src/auth/AuthProvider.tsx apps/admin/src/auth/AuthProvider.test.tsx
git commit -m "fix(admin): 展示服务端错误信息"
```
