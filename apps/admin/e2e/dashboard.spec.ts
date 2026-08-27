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
    await expect(page.getByRole("heading", { name: "管理概览" })).toBeVisible();
  });

  test("显示当前个人版管理能力", async ({ page }) => {
    await expect(page).toHaveTitle(/PetCare/);
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByText("当前范围已收窄")).toBeVisible();
    await expect(page.getByRole("heading", { name: "用户资料" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "社区审核" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "萌宠课堂" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "官网内容" })).toBeVisible();
  });

  for (const destination of [
    { link: "查看用户资料", path: /\/users$/, heading: "用户资料" },
    { link: "进入社区审核", path: /\/content\/posts$/, heading: "帖子管理" },
    { link: "管理课堂文章", path: /\/content\/articles$/, heading: "文章管理" },
    { link: "管理官网内容", path: /\/website-content$/, heading: "官网与小程序内容" },
  ]) {
    test(`导航到${destination.heading}`, async ({ page }) => {
      await page.getByRole("link", { name: destination.link }).click();
      await expect(page).toHaveURL(destination.path);
      await expect(page.getByRole("heading", { name: destination.heading })).toBeVisible();
    });
  }
});
