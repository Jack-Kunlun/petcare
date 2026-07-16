import { test, expect } from "@playwright/test";

test.describe("PetCare Admin Dashboard", () => {
  test("should load the dashboard page", async ({ page }) => {
    await page.goto("/");
    
    // 检查页面标题
    await expect(page).toHaveTitle(/PetCare/);
    
    // 检查侧边栏是否存在
    const sidebar = page.locator("aside");

    await expect(sidebar).toBeVisible();
    
    // 检查仪表盘标题
    const dashboardTitle = page.getByRole("heading", { name: "仪表盘" });

    await expect(dashboardTitle).toBeVisible();
  });

  test("should navigate to user management", async ({ page }) => {
    await page.goto("/");
    
    // 点击用户管理菜单
    await page.getByRole("link", { name: "用户管理" }).click();
    
    // 检查URL是否改变
    await expect(page).toHaveURL(/.*\/users/);
    
    // 检查用户管理标题
    const userManagementTitle = page.getByRole("heading", { name: "用户管理" });

    await expect(userManagementTitle).toBeVisible();
  });

  test("should navigate to order management", async ({ page }) => {
    await page.goto("/");
    
    // 点击订单管理菜单
    await page.getByRole("link", { name: "订单管理" }).click();
    
    // 检查URL是否改变
    await expect(page).toHaveURL(/.*\/orders/);
    
    // 检查订单管理标题
    const orderManagementTitle = page.getByRole("heading", { name: "订单管理" });

    await expect(orderManagementTitle).toBeVisible();
  });

  test("should navigate to settings", async ({ page }) => {
    await page.goto("/");
    
    // 点击系统设置菜单
    await page.getByRole("link", { name: "系统设置" }).click();
    
    // 检查URL是否改变
    await expect(page).toHaveURL(/.*\/settings/);
    
    // 检查系统设置标题
    const settingsTitle = page.getByRole("heading", { name: "系统设置" });

    await expect(settingsTitle).toBeVisible();
  });

  test("should display dashboard statistics", async ({ page }) => {
    await page.goto("/");
    
    // 检查统计卡片是否存在
    const statsCards = page.locator(".grid > div");

    await expect(statsCards).toHaveCount(4);
    
    // 检查各个统计项
    await expect(page.getByText("总用户数")).toBeVisible();
    await expect(page.getByText("今日订单")).toBeVisible();
    await expect(page.getByText("本月收入")).toBeVisible();
    await expect(page.getByText("待处理纠纷")).toBeVisible();
  });
});
