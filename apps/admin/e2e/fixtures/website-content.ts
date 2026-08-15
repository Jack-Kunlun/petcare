import { expect, type Page } from "@playwright/test";

export const websiteContentFixtures = {
  home: {
    contentKey: "home",
    route: "/",
    heroTitleLabel: "主标题",
    initialTitle: "陪伴每一次托付",
  },
  reader: {
    username: "rbac-e2e-website-reader",
    password: "Rbac-E2e-Restricted-Admin-2026!",
  },
  editor: {
    username: "rbac-e2e-website-editor",
    password: "Rbac-E2e-Restricted-Admin-2026!",
  },
  publisher: {
    username: "rbac-e2e-website-publisher",
    password: "Rbac-E2e-Restricted-Admin-2026!",
  },
} as const;

/** Logs into the real Admin frontend using one deterministic isolated-schema user. */
export async function loginWebsiteOperator(
  page: Page,
  credentials: { username: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("手机号或账号").fill(credentials.username);
  await page.getByLabel("密码").fill(credentials.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/$/u);
}

/** Opens the fixed Home template editor after the overview navigation is available. */
export async function openHomeEditor(page: Page): Promise<void> {
  await page.getByTestId("desktop-menu-tree").getByRole("link", { name: "官网设置" }).click();
  await expect(page.getByRole("heading", { name: "官网内容" })).toBeVisible();
  const homeCard = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: websiteContentFixtures.home.contentKey, exact: true }),
  });

  await homeCard.getByRole("link", { name: "编辑草稿" }).click();
  await expect(page).toHaveURL(/\/website-content\/home\/edit$/u);
}

/** Opens the protected Home editor through the SPA when an operator lacks the edit-card link. */
export async function openHomeEditorRoute(page: Page): Promise<void> {
  await page.getByTestId("desktop-menu-tree").getByRole("link", { name: "官网设置" }).click();
  await expect(page).toHaveURL(/\/website-content$/u);
  await page.evaluate(() => {
    globalThis.history.pushState({}, "", "/website-content/home/edit");
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/website-content\/home\/edit$/u);
}

/** Creates a predictable title that remains unique across parallel retries. */
export function createWebsiteLifecycleTitle(): string {
  return `官网 E2E 草稿 ${Date.now()}`;
}
