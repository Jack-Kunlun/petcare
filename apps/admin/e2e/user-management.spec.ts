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
  await expect(page.getByRole("heading", { name: "管理概览" })).toBeVisible();
}

test("用户列表、详情与状态操作形成完整可恢复流程", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await loginAsDefaultAdmin(page);
  await page.getByRole("link", { name: "查看用户资料" }).click();

  await expect(page.getByRole("heading", { name: "用户资料" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "当前状态" })).toBeVisible();
  const targetRow = page.getByRole("row").filter({ hasText: "@community-e2e-author" });

  await expect(targetRow).toHaveCount(1);
  await expect(targetRow.getByText("正常")).toBeVisible();
  await targetRow.getByRole("link", { name: "查看详情" }).click();

  await expect(page.getByRole("heading", { name: "社区 E2E 作者", level: 1 })).toBeVisible();
  await expect(page.getByText("正常")).toBeVisible();
  const main = page.locator("#main-content");
  const toolbar = page.locator(".editor-page__toolbar");

  await expect(toolbar).toHaveCSS("position", "sticky");
  await expect(toolbar).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const topGeometry = await toolbar.evaluate((element) => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    toolbarTop: element.getBoundingClientRect().top,
    mainTop: document.getElementById("main-content")?.getBoundingClientRect().top,
  }));

  expect(topGeometry.scrollWidth).toBeLessThanOrEqual(topGeometry.clientWidth);
  expect(topGeometry.toolbarTop).toBeGreaterThanOrEqual(topGeometry.mainTop ?? 0);
  await testInfo.attach("user-detail-top-1366", {
    body: await page.screenshot({ animations: "disabled", caret: "hide" }),
    contentType: "image/png",
  });

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
  await expect
    .poll(() =>
      toolbar.evaluate((element) => {
        const mainElement = document.getElementById("main-content");

        return mainElement
          ? Math.abs(element.getBoundingClientRect().top - mainElement.getBoundingClientRect().top)
          : Number.POSITIVE_INFINITY;
      }),
    )
    .toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "拉黑用户" }).click();
  const banDialog = page.getByRole("dialog", { name: "确认拉黑该用户？" });

  await expect(banDialog).toContainText("所有现有会话会立即失效");
  await banDialog.getByRole("button", { name: "确认拉黑" }).click();
  await expect(banDialog).toBeHidden();
  await expect(page.getByText("已封禁")).toBeVisible();
  await expect(page.getByRole("button", { name: "恢复用户" })).toBeVisible();

  await page.getByRole("button", { name: "恢复用户" }).click();
  const restoreDialog = page.getByRole("dialog", { name: "确认恢复该用户？" });

  await expect(restoreDialog).toContainText("旧会话仍保持失效");
  await restoreDialog.getByRole("button", { name: "确认恢复" }).click();
  await expect(restoreDialog).toBeHidden();
  await expect(page.getByText("正常")).toBeVisible();

  await page.getByRole("link", { name: "返回用户列表" }).click();
  await expect(page.getByRole("heading", { name: "用户资料" })).toBeVisible();
  const restoredRow = page.getByRole("row").filter({ hasText: "@community-e2e-author" });

  await expect(restoredRow.getByText("正常")).toBeVisible();
});
