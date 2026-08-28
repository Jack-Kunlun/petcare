import { expect, test, type Page, type TestInfo } from "@playwright/test";

const desktopViewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
] as const;

const shellScenarios = [
  { id: "dashboard", path: "/", heading: "管理概览" },
  { id: "users", path: "/users", heading: "用户资料" },
  { id: "posts", path: "/content/posts", heading: "帖子管理" },
  { id: "articles", path: "/content/articles", heading: "文章管理" },
  { id: "website", path: "/website-content", heading: "官网内容" },
  { id: "shared", path: "/shared-content", heading: "公共内容配置" },
  { id: "roles", path: "/rbac", heading: "角色管理" },
  { id: "catalog", path: "/rbac/catalog", heading: "菜单目录" },
  { id: "account", path: "/account", heading: "个人中心" },
] as const;

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
  await expect(page.getByRole("heading", { name: "管理概览" })).toBeVisible();
}

async function openRoute(page: Page, path: string): Promise<void> {
  await page.evaluate((destination) => {
    const currentState = globalThis.history.state as { idx?: unknown } | null;
    const state = {
      usr: null,
      key: globalThis.crypto.randomUUID(),
      idx: (typeof currentState?.idx === "number" ? currentState.idx : 0) + 1,
    };

    globalThis.history.pushState(state, "", destination);
    globalThis.dispatchEvent(new PopStateEvent("popstate", { state }));
  }, path);
}

async function assertNoPageOverflow(page: Page, viewport: (typeof desktopViewports)[number]) {
  const geometry = await page.evaluate(() => {
    const main = document.getElementById("main-content");
    const shellSidebar = document.querySelector("body > div aside");
    const heading = main?.querySelector("h1");
    const documentElement = document.documentElement;

    if (!main || !shellSidebar || !heading) {
      return null;
    }

    const mainBounds = main.getBoundingClientRect();
    const sidebarBounds = shellSidebar.getBoundingClientRect();
    const headingBounds = heading.getBoundingClientRect();

    return {
      clientWidth: documentElement.clientWidth,
      scrollWidth: documentElement.scrollWidth,
      mainLeft: mainBounds.left,
      mainRight: mainBounds.right,
      sidebarRight: sidebarBounds.right,
      headingLeft: headingBounds.left,
      headingRight: headingBounds.right,
    };
  });

  if (!geometry) {
    throw new Error("Admin shell geometry was unavailable");
  }

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.sidebarRight).toBeLessThanOrEqual(geometry.mainLeft);
  expect(geometry.mainLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.mainRight).toBeLessThanOrEqual(viewport.width);
  expect(geometry.headingLeft).toBeGreaterThanOrEqual(geometry.mainLeft);
  expect(geometry.headingRight).toBeLessThanOrEqual(viewport.width);
}

async function attachViewportScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled", caret: "hide" }),
    contentType: "image/png",
  });
}

for (const viewport of desktopViewports) {
  test(`核心后台页面在 ${viewport.width}x${viewport.height} 保持桌面布局边界`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await loginAsDefaultAdmin(page);

    for (const scenario of shellScenarios) {
      // Pages share one authenticated browser so layout checks remain deterministic and inexpensive.
      // eslint-disable-next-line no-await-in-loop
      await test.step(scenario.heading, async () => {
        await openRoute(page, scenario.path);
        await expect(page.getByRole("heading", { name: scenario.heading })).toBeVisible();
        await expect(page.locator("#main-content")).toBeVisible();
        await assertNoPageOverflow(page, viewport);

        if (
          viewport.width === 1440 &&
          ["dashboard", "posts", "website", "roles", "account"].includes(scenario.id)
        ) {
          await attachViewportScreenshot(page, testInfo, `${scenario.id}-${viewport.width}`);
        }
      });
    }
  });
}

test("登录页在常见桌面低高度下不产生横向溢出", async ({ page }, testInfo) => {
  const viewport = { width: 1366, height: 768 };

  await page.setViewportSize(viewport);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "登录 PetCare" })).toBeVisible();

  const loginCard = page.getByTestId("login-card");
  const bounds = await loginCard.boundingBox();
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  if (!bounds) {
    throw new Error("Login card geometry was unavailable");
  }

  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  await attachViewportScreenshot(page, testInfo, "login-1366");
});
