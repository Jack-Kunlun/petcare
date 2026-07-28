import { expect, test } from "@playwright/test";

function requiredEnv(name: "DEFAULT_ADMIN_USERNAME" | "DEFAULT_ADMIN_PASSWORD"): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Admin E2E`);
  }

  return value;
}

test.describe("PetCare Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("手机号或账号").fill(requiredEnv("DEFAULT_ADMIN_USERNAME"));
    await page.getByLabel("密码").fill(requiredEnv("DEFAULT_ADMIN_PASSWORD"));
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByRole("heading", { name: "仪表盘" })).toBeVisible();
  });

  test("显示控制台统计数据", async ({ page }) => {
    await expect(page).toHaveTitle(/PetCare/);
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByText("总用户数")).toBeVisible();
    await expect(page.getByText("今日订单")).toBeVisible();
    await expect(page.getByText("本月收入")).toBeVisible();
    await expect(page.getByText("待处理纠纷")).toBeVisible();
  });

  for (const destination of [
    { link: "用户管理", path: /\/users$/, heading: "用户管理" },
    { link: "订单管理", path: /\/orders$/, heading: "订单管理" },
    { link: "系统设置", path: /\/settings$/, heading: "系统设置" },
  ]) {
    test(`导航到${destination.heading}`, async ({ page }) => {
      await page.getByRole("link", { name: destination.link }).click();
      await expect(page).toHaveURL(destination.path);
      await expect(page.getByRole("heading", { name: destination.heading })).toBeVisible();
    });
  }
});
