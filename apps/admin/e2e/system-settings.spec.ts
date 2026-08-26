import { expect, test, type Page } from "@playwright/test";

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

test("管理员编辑、比较并发布费率草稿", async ({ page }) => {
  await loginAsDefaultAdmin(page);
  await page.getByRole("link", { name: "系统设置" }).click();

  const feeCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "费率设置" }),
  });

  await feeCard.getByRole("link", { name: "编辑配置" }).click();
  await page.getByRole("spinbutton", { name: "平台佣金" }).fill("12");
  await page.getByLabel(/变更摘要/).fill("系统设置 Playwright 闭环验收");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByText("草稿已保存，当前修订版为 1。")).toBeVisible();

  await page.getByRole("button", { name: "检查并发布", exact: true }).click();
  const reviewDialog = page.getByRole("dialog", { name: "发布前确认：费率设置" });

  await expect(
    reviewDialog.getByText("platformCommissionBps", { exact: true }).first(),
  ).toBeVisible();
  await expect(reviewDialog.getByText("1000", { exact: true })).toBeVisible();
  await expect(reviewDialog.getByText("1200", { exact: true })).toBeVisible();
  await reviewDialog.getByRole("button", { name: "继续发布" }).click();
  await page.getByRole("button", { name: "确认发布" }).click();

  await expect(page.getByText("版本 v2 已发布。")).toBeVisible();
});
