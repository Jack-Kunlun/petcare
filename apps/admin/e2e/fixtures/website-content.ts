import { expect, type Page } from "@playwright/test";

export const websiteContentFixtures = {
  home: {
    contentKey: "home",
    route: "/",
    heroTitleLabel: "主标题",
    initialTitle: "陪伴每一次托付",
  },
  help: {
    contentKey: "help",
    questionLabel: "正文小节 如何完善个人信息？ 标题",
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

/** Opens one fixed Website Content editor after the overview navigation is available. */
export async function openContentEditor(page: Page, contentKey: string): Promise<void> {
  await page.getByTestId("desktop-menu-tree").getByRole("link", { name: "官网设置" }).click();
  await expect(page.getByRole("heading", { name: "官网内容" })).toBeVisible();
  const card = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: contentKey, exact: true }),
  });

  await card.getByRole("link", { name: "编辑草稿" }).click();
  await expect(page).toHaveURL(new RegExp(`/website-content/${contentKey}/edit$`, "u"));
}

/** Opens one protected content editor through the SPA when its edit-card link is unavailable. */
export async function openContentEditorRoute(page: Page, contentKey: string): Promise<void> {
  await page.getByTestId("desktop-menu-tree").getByRole("link", { name: "官网设置" }).click();
  await expect(page).toHaveURL(/\/website-content$/u);
  await page.evaluate((key) => {
    globalThis.history.pushState({}, "", `/website-content/${key}/edit`);
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
  }, contentKey);
  await expect(page).toHaveURL(new RegExp(`/website-content/${contentKey}/edit$`, "u"));
}

/** Creates a predictable title that remains unique across parallel retries. */
export function createWebsiteLifecycleTitle(): string {
  return `官网 E2E 草稿 ${Date.now()}`;
}
