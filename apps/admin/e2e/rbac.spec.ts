import { expect, test, type Page } from "@playwright/test";

function requiredEnv(
  name:
    | "DEFAULT_ADMIN_USERNAME"
    | "DEFAULT_ADMIN_PASSWORD"
    | "RBAC_E2E_RESTRICTED_USERNAME"
    | "RBAC_E2E_RESTRICTED_PASSWORD",
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Admin E2E`);
  }

  return value;
}

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("手机号或账号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
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

test("超级管理员可以创建并编辑角色，菜单和按钮可选而接口权限不渲染", async ({ page }) => {
  const roleName = `rbac-playwright-${Date.now()}`;

  await login(page, requiredEnv("DEFAULT_ADMIN_USERNAME"), requiredEnv("DEFAULT_ADMIN_PASSWORD"));
  await expect(page.getByRole("heading", { name: "管理概览" })).toBeVisible();
  await page.getByRole("button", { name: "权限管理菜单" }).click();
  await page.getByRole("link", { name: "角色管理" }).click();
  await expect(page.getByRole("heading", { name: "角色管理" })).toBeVisible();
  await page.getByRole("link", { name: "新建角色" }).click();

  await page.getByLabel("角色名称").fill(roleName);
  await page.getByLabel("角色说明").fill("Admin RBAC Playwright acceptance role");
  await page.getByRole("checkbox", { name: "内容管理" }).check();
  await page.getByRole("checkbox", { name: "发布页面内容", exact: true }).check();
  await expect(page.getByText("发布页面内容接口")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "发布页面内容接口" })).toBeDisabled();
  await page.getByRole("button", { name: "保存角色", exact: true }).click();
  await expect(page.getByRole("heading", { name: roleName })).toBeVisible();
  const catalogVersion = page.getByTestId("rbac-catalog-version");

  await expect(catalogVersion).toBeVisible();
  const metadataGeometry = await catalogVersion.evaluate((element) => {
    const section = element.closest("section.form-section");

    if (!section) {
      return null;
    }

    return {
      valueRight: element.getBoundingClientRect().right,
      sectionRight: section.getBoundingClientRect().right,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
    };
  });

  if (!metadataGeometry) {
    throw new Error("Role metadata section was unavailable");
  }

  expect(metadataGeometry.valueRight).toBeLessThanOrEqual(metadataGeometry.sectionRight);
  expect(metadataGeometry.documentScrollWidth).toBeLessThanOrEqual(
    metadataGeometry.documentClientWidth,
  );

  await page.getByRole("link", { name: "编辑角色" }).click();
  await page.getByLabel("角色说明").fill("Admin RBAC Playwright acceptance role updated");
  await page.getByRole("button", { name: "保存角色", exact: true }).click();
  await expect(page.getByText("Admin RBAC Playwright acceptance role updated")).toBeVisible();
});

test("拥有官网编辑权限但没有发布权限的受限会话不显示发布按钮", async ({ page }) => {
  await login(
    page,
    requiredEnv("RBAC_E2E_RESTRICTED_USERNAME"),
    requiredEnv("RBAC_E2E_RESTRICTED_PASSWORD"),
  );
  await expect(page.getByRole("heading", { name: "没有访问权限" })).toBeVisible();
  await openRoute(page, "/website-content/home/edit");
  await expect(page.getByRole("heading", { name: "编辑 home" })).toBeVisible();
  await expect(page.getByRole("button", { name: /发布已保存草稿/u })).toHaveCount(0);
});
