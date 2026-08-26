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

test("超级管理员可以创建并编辑角色，菜单和按钮可选而接口权限不渲染", async ({ page }) => {
  const roleName = `rbac-playwright-${Date.now()}`;

  await login(page, requiredEnv("DEFAULT_ADMIN_USERNAME"), requiredEnv("DEFAULT_ADMIN_PASSWORD"));
  await expect(page.getByRole("heading", { name: "运营概览" })).toBeVisible();
  await page.getByRole("button", { name: "权限管理菜单" }).click();
  await page.getByRole("link", { name: "角色管理" }).click();
  await expect(page.getByRole("heading", { name: "角色管理" })).toBeVisible();
  await page.getByRole("link", { name: "新建角色" }).click();

  await page.getByLabel("角色名称").fill(roleName);
  await page.getByLabel("角色说明").fill("Admin RBAC Playwright acceptance role");
  await page.getByRole("checkbox", { name: "订单管理" }).check();
  await page.getByRole("checkbox", { name: "导出订单数据", exact: true }).check();
  await expect(page.getByText("导出订单数据接口")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "导出订单数据接口" })).toBeDisabled();
  await page.getByRole("button", { name: "保存角色", exact: true }).click();
  await expect(page.getByRole("heading", { name: roleName })).toBeVisible();

  await page.getByRole("link", { name: "编辑角色" }).click();
  await page.getByLabel("角色说明").fill("Admin RBAC Playwright acceptance role updated");
  await page.getByRole("button", { name: "保存角色", exact: true }).click();
  await expect(page.getByText("Admin RBAC Playwright acceptance role updated")).toBeVisible();
});

test("拥有费率编辑但没有 system.publish 的受限会话不显示发布按钮", async ({ page }) => {
  await login(
    page,
    requiredEnv("RBAC_E2E_RESTRICTED_USERNAME"),
    requiredEnv("RBAC_E2E_RESTRICTED_PASSWORD"),
  );
  await expect(page.getByRole("heading", { name: "没有访问权限" })).toBeVisible();
  await page.getByRole("link", { name: "系统设置" }).click();
  const feeCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "费率设置" }),
  });

  await feeCard.getByRole("link", { name: "编辑配置" }).click();
  await expect(page.getByRole("heading", { name: "费率设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "检查并发布" })).toHaveCount(0);
});
