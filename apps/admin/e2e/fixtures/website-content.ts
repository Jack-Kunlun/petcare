import type { CurrentWebsiteContentKey } from "@petcare/shared-types";
import { expect, type Page } from "@playwright/test";
import {
  getContentAreaLabel,
  getContentEditPath,
  getContentOverviewPath,
} from "../../src/pages/WebsiteContent/content-registry";

export const websiteContentFixtures = {
  home: {
    contentKey: "home",
    route: "/",
    heroTitleLabel: "主标题",
    initialTitle: "记录每一次陪伴",
  },
  help: {
    contentKey: "help",
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

/** Opens the Admin overview that owns one managed content unit. */
export async function openContentOverview(
  page: Page,
  contentKey: CurrentWebsiteContentKey,
): Promise<void> {
  const overviewPath = getContentOverviewPath(contentKey);

  await page
    .getByTestId("desktop-menu-tree")
    .getByRole("link", { name: getContentAreaLabel(contentKey), exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${overviewPath}$`, "u"));
}

/** Opens one fixed Website Content editor after the overview navigation is available. */
export async function openContentEditor(
  page: Page,
  contentKey: CurrentWebsiteContentKey,
): Promise<void> {
  await openContentOverview(page, contentKey);
  const card = page.getByRole("listitem").filter({
    has: page.getByText(contentKey, { exact: true }),
  });

  await card.getByRole("link", { name: /编辑.+草稿/u }).click();
  await expect(page).toHaveURL(new RegExp(`${getContentEditPath(contentKey)}$`, "u"));
}

/** Opens one protected content editor through the SPA when its edit-card link is unavailable. */
export async function openContentEditorRoute(
  page: Page,
  contentKey: CurrentWebsiteContentKey,
): Promise<void> {
  await openContentOverview(page, contentKey);
  const editPath = getContentEditPath(contentKey);

  await page.evaluate((path) => {
    globalThis.history.pushState({}, "", path);
    globalThis.dispatchEvent(new PopStateEvent("popstate"));
  }, editPath);
  await expect(page).toHaveURL(new RegExp(`${editPath}$`, "u"));
}

/** Creates a predictable title that remains unique across parallel retries. */
export function createWebsiteLifecycleTitle(): string {
  return `官网 E2E 草稿 ${Date.now()}`;
}
