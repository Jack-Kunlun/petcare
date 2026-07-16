# E2E测试目录

本目录包含PetCare后台管理系统的端到端(E2E)测试。

## 测试框架

使用 **Playwright** 进行E2E测试，支持多浏览器测试。

## 运行测试

### 运行所有E2E测试

```bash
pnpm test:e2e
```

### 以UI模式运行（推荐用于开发）

```bash
pnpm test:e2e:ui
```

### 以调试模式运行

```bash
pnpm test:e2e:debug
```

### 从根目录运行

```bash
cd F:\petcare
pnpm test:e2e
```

## 测试文件结构

- `dashboard.spec.ts` - 仪表盘和导航测试
- 未来可以添加更多测试文件，如：
  - `user-management.spec.ts` - 用户管理功能测试
  - `order-management.spec.ts` - 订单管理功能测试
  - `settings.spec.ts` - 系统设置功能测试

## 编写新测试

参考 `dashboard.spec.ts` 的示例，使用 Playwright 的 API：

```typescript
import { test, expect } from "@playwright/test";

test("should do something", async ({ page }) => {
  await page.goto("/");
  // 你的测试逻辑
  await expect(page.locator("selector")).toBeVisible();
});
```

## 配置

Playwright配置在 `playwright.config.ts` 中：

- 测试目录：`./e2e`
- 基础URL：`http://localhost:3000`
- 浏览器：Chromium, Firefox, WebKit
- 自动启动开发服务器

## 查看测试报告

测试完成后，HTML报告会生成在 `playwright-report/` 目录中。
