import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1920, height: 1200 },
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
] as const;

type Viewport = (typeof viewports)[number];

type EditorScenario = {
  path: string;
  title: string | RegExp;
  action: string;
};

const certificationApplication = {
  id: "editor-layout-e2e",
  applicant: {
    id: "user-editor-layout-e2e",
    phone: "13800138000",
    username: "editor-layout-e2e",
    nickname: "安心宠托",
    avatar: null,
  },
  realNameMasked: "张*",
  idCardVerified: true,
  idCardMasked: "3601********1234",
  idCardFrontUrl: "https://example.com/front",
  idCardBackUrl: "https://example.com/back",
  trainingPassed: true,
  wechatScore: 680,
  status: "pending",
  rejectReason: null,
  reviewedBy: null,
  createdAt: "2026-07-29T00:00:00.000Z",
  reviewedAt: null,
  updatedAt: "2026-07-29T00:00:00.000Z",
};

function requiredEnv(name: "DEFAULT_ADMIN_USERNAME" | "DEFAULT_ADMIN_PASSWORD"): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Admin E2E`);
  }

  return value;
}

async function loginAsDefaultAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("手机号或账号").fill(requiredEnv("DEFAULT_ADMIN_USERNAME"));
  await page.getByLabel("密码").fill(requiredEnv("DEFAULT_ADMIN_PASSWORD"));
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "运营概览" })).toBeVisible();
}

async function openRoute(page: Page, path: string): Promise<void> {
  await page.evaluate((destination) => {
    const currentState = globalThis.history.state as { idx?: unknown } | null;
    const state = {
      usr: null,
      key: globalThis.crypto.randomUUID(),
      idx: (typeof currentState?.idx === "number" ? currentState.idx : 0) + 1,
    };

    // React Router's browser history ignores POP events without this state shape.
    globalThis.history.pushState(state, "", destination);
    globalThis.dispatchEvent(new PopStateEvent("popstate", { state }));
  }, path);
}

async function assertEditorLayout(
  page: Page,
  { title, action }: Omit<EditorScenario, "path">,
  viewport: Viewport,
): Promise<void> {
  const editor = page.locator(".editor-page");
  const header = editor.locator(".editor-page__header");
  const actionButton = header.getByRole("button", { name: action, exact: true });

  await expect(editor).toBeVisible();
  await expect(header.getByRole("heading", { name: title })).toBeVisible();
  await expect(actionButton).toBeVisible();

  const actionBounds = await actionButton.boundingBox();

  if (!actionBounds) {
    throw new Error(`The ${action} action did not have a visible bounding box`);
  }

  expect(actionBounds.x).toBeGreaterThanOrEqual(0);
  expect(actionBounds.y).toBeGreaterThanOrEqual(0);
  expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(viewport.width);
  expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(viewport.height);

  const layout = await header.evaluate((element) => {
    const main = document.getElementById("main-content");
    const sidebar = document.querySelector("aside");
    const documentElement = document.documentElement;

    if (!main || !sidebar) {
      return null;
    }

    return {
      headerTop: element.getBoundingClientRect().top,
      mainTop: main.getBoundingClientRect().top,
      position: getComputedStyle(element).position,
      sidebarRight: sidebar.getBoundingClientRect().right,
      mainLeft: main.getBoundingClientRect().left,
      scrollWidth: documentElement.scrollWidth,
      clientWidth: documentElement.clientWidth,
      top: getComputedStyle(element).top,
    };
  });

  if (!layout) {
    throw new Error("Admin shell did not render a main scrollport and desktop sidebar");
  }

  expect(layout.position).toBe("sticky");
  expect(layout.top).toBe("0px");
  expect(layout.headerTop).toBeGreaterThanOrEqual(layout.mainTop);
  expect(layout.sidebarRight).toBeLessThanOrEqual(layout.mainLeft);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
}

async function openAndAssert(
  page: Page,
  scenario: EditorScenario,
  viewport: Viewport,
): Promise<void> {
  await openRoute(page, scenario.path);
  await assertEditorLayout(page, scenario, viewport);
}

async function assertStickyAfterLongScroll(page: Page, viewport: Viewport): Promise<void> {
  const main = page.locator("#main-content");
  const scrollState = await main.evaluate((element) => {
    element.scrollTop = element.scrollHeight;

    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    };
  });

  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
  expect(scrollState.scrollTop).toBeGreaterThan(0);
  await assertEditorLayout(page, { title: "新建角色", action: "顶部保存角色" }, viewport);
}

for (const viewport of viewports) {
  test(`编辑页布局在 ${viewport.width}x${viewport.height} 保持桌面契约`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/admin/provider-certifications/editor-layout-e2e", async (route) => {
      await route.fulfill({
        json: {
          code: "SUCCESS",
          message: "操作成功",
          data: certificationApplication,
          meta: {
            requestId: "editor-layout-e2e",
            timestamp: "2026-08-26T00:00:00.000Z",
          },
        },
      });
    });
    await loginAsDefaultAdmin(page);

    await openAndAssert(
      page,
      { path: "/content/articles/new", title: "新建文章", action: "保存草稿" },
      viewport,
    );
    await openAndAssert(
      page,
      { path: "/website-content/home/edit", title: "编辑 home", action: "顶部保存草稿" },
      viewport,
    );
    await openAndAssert(
      page,
      { path: "/settings/fee/edit", title: "编辑费率设置", action: "顶部保存草稿" },
      viewport,
    );

    const historyLink = page
      .locator(".editor-page__header")
      .getByRole("link", { name: "历史版本", exact: true });
    const historyHref = await historyLink.getAttribute("href");

    if (!historyHref?.startsWith("/settings/fee/history/")) {
      throw new Error("Loaded fee editor did not expose its current history URL");
    }

    await historyLink.click();
    await assertEditorLayout(
      page,
      { title: /^费率设置 v\d+$/u, action: "顶部复制为新草稿" },
      viewport,
    );
    await openAndAssert(
      page,
      { path: "/rbac/new", title: "新建角色", action: "顶部保存角色" },
      viewport,
    );
    await assertStickyAfterLongScroll(page, viewport);
    await openAndAssert(
      page,
      {
        path: "/users/certifications/editor-layout-e2e",
        title: "安心宠托",
        action: "顶部审核通过",
      },
      viewport,
    );
  });
}
