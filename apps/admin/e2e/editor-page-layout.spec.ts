import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1920, height: 1200 },
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
] as const;

type Viewport = (typeof viewports)[number];

type EditorScenario = {
  path: string;
  title: string | RegExp;
  action: string;
  uniqueAction?: string;
};

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

async function mockPostDetail(page: Page): Promise<void> {
  await page.route("**/api/admin/content/posts/visual-regression-post**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown;

    if (pathname.endsWith("/reports")) {
      data = { list: [], total: 0 };
    } else if (pathname.endsWith("/comments")) {
      data = {
        list: Array.from({ length: 12 }, (_, index) => ({
          id: `visual-regression-comment-${index + 1}`,
          postId: "visual-regression-post",
          commenter: {
            id: `visual-regression-commenter-${index + 1}`,
            phone: `1880000${String(index + 201).padStart(4, "0")}`,
            username: null,
            nickname: `视觉回归宠友 ${index + 1}`,
            avatar: null,
          },
          content: `第 ${index + 1} 条受控评论，用于构造真实的长详情页面滚动距离。`,
          status: "published",
          moderationReason: null,
          createdAt: "2026-08-28T00:05:00.000Z",
          updatedAt: "2026-08-28T00:05:00.000Z",
        })),
        total: 12,
        page: 1,
        pageSize: 50,
      };
    } else {
      data = {
        id: "visual-regression-post",
        author: {
          id: "visual-regression-author",
          phone: "18800000101",
          username: "visual_regression_author",
          nickname: "视觉回归作者",
          avatar: null,
        },
        contentExcerpt: "用于验证帖子详情滚动层级",
        mediaCount: 0,
        likesCount: 1,
        commentsCount: 0,
        sharesCount: 0,
        reportsCount: 0,
        status: "published",
        createdAt: "2026-08-28T00:00:00.000Z",
        updatedAt: "2026-08-28T00:10:00.000Z",
        content:
          "这是一段用于验证帖子详情滚动层级的受控内容。页面标题、分区导航与右侧信息栏必须随主页面一起滚动。",
        mediaUrls: [],
        moderationReason: null,
        moderationHistory: [],
      };
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "SUCCESS",
        message: "操作成功",
        data,
        meta: {
          requestId: `visual-regression-${pathname.split("/").at(-1)}`,
          timestamp: "2026-08-28T00:15:00.000Z",
        },
      }),
    });
  });
}

async function openRoute(page: Page, path: string): Promise<void> {
  await page.evaluate((destination) => {
    const currentState = globalThis.history.state as { idx?: unknown } | null;
    const state = {
      usr: null,
      key: globalThis.crypto.randomUUID(),
      idx: (typeof currentState?.idx === "number" ? currentState.idx : 0) + 1,
    };

    // React Router's browser history ignores POP events without this state shape.
    globalThis.history.pushState(state, "", destination);
    globalThis.dispatchEvent(new PopStateEvent("popstate", { state }));
  }, path);
}

async function assertEditorLayout(
  page: Page,
  { title, action, uniqueAction }: Omit<EditorScenario, "path">,
  viewport: Viewport,
): Promise<void> {
  const editor = page.locator(".editor-page");
  const header = editor.locator(".editor-page__header");
  const actionButton = header.getByRole("button", { name: action, exact: true });

  await expect(editor).toBeVisible();
  await expect(header.getByRole("heading", { name: title })).toBeVisible();
  await expect(actionButton).toBeVisible();

  if (uniqueAction) {
    await expect(editor.getByRole("button", { name: uniqueAction, exact: true })).toHaveCount(1);
  }

  const actionBounds = await actionButton.boundingBox();

  if (!actionBounds) {
    throw new Error(`The ${action} action did not have a visible bounding box`);
  }

  expect(actionBounds.x).toBeGreaterThanOrEqual(0);
  expect(actionBounds.y).toBeGreaterThanOrEqual(0);
  expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(viewport.width);
  expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(viewport.height);

  const layout = await header.evaluate((element) => {
    const main = document.getElementById("main-content");
    const sidebar = document.querySelector("aside");
    const documentElement = document.documentElement;

    if (!main || !sidebar) {
      return null;
    }

    return {
      headerTop: element.getBoundingClientRect().top,
      mainTop: main.getBoundingClientRect().top,
      position: getComputedStyle(element).position,
      sidebarRight: sidebar.getBoundingClientRect().right,
      mainLeft: main.getBoundingClientRect().left,
      scrollWidth: documentElement.scrollWidth,
      clientWidth: documentElement.clientWidth,
      top: getComputedStyle(element).top,
    };
  });

  if (!layout) {
    throw new Error("Admin shell did not render a main scrollport and desktop sidebar");
  }

  expect(layout.position).toBe("static");
  expect(layout.top).toBe("auto");
  expect(layout.headerTop).toBeGreaterThanOrEqual(layout.mainTop);
  expect(layout.sidebarRight).toBeLessThanOrEqual(layout.mainLeft);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
}

async function openAndAssert(
  page: Page,
  scenario: EditorScenario,
  viewport: Viewport,
): Promise<void> {
  await openRoute(page, scenario.path);
  await page.locator("#main-content").evaluate((element) => {
    element.scrollTop = 0;
  });
  await assertEditorLayout(page, scenario, viewport);
}

async function assertHeaderLeavesScrollport(page: Page): Promise<void> {
  const main = page.locator("#main-content");
  const header = page.locator(".editor-page__header");
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
  const geometry = await header.evaluate((element) => {
    const mainElement = document.getElementById("main-content");

    if (!mainElement) {
      return null;
    }

    return {
      headerBottom: element.getBoundingClientRect().bottom,
      mainTop: mainElement.getBoundingClientRect().top,
      position: getComputedStyle(element).position,
    };
  });

  if (!geometry) {
    throw new Error("Admin editor scrollport was unavailable");
  }

  expect(geometry.position).toBe("static");
  expect(geometry.headerBottom).toBeLessThanOrEqual(geometry.mainTop);
}

for (const viewport of viewports) {
  test(
    `编辑页布局在 ${viewport.width}x${viewport.height} 保持桌面契约`,
    async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await loginAsDefaultAdmin(page);

      await openAndAssert(
        page,
        { path: "/content/articles/new", title: "新建文章", action: "保存草稿" },
        viewport,
      );
      await openAndAssert(
        page,
        {
          path: "/website-content/home/edit",
          title: "编辑 官网首页",
          action: "preview-saved-draft",
          uniqueAction: "保存草稿",
        },
        viewport,
      );

      if (viewport.width === 1440) {
        await page.locator("#main-content").evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        await expect(page.getByRole("button", { name: "保存草稿", exact: true })).toBeVisible();
        await testInfo.attach("website-editor-bottom-1440", {
          body: await page.screenshot({ animations: "disabled", caret: "hide" }),
          contentType: "image/png",
        });
      }

      await openAndAssert(
        page,
        { path: "/rbac/new", title: "新建角色", action: "顶部保存角色" },
        viewport,
      );
      await assertHeaderLeavesScrollport(page);
    },
  );
}

test("帖子详情深滚动时不保留重叠标题或嵌套滚动层", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsDefaultAdmin(page);
  await mockPostDetail(page);
  await openRoute(page, "/content/posts/visual-regression-post");

  await expect(page.getByRole("heading", { name: "社区帖子详情" })).toBeVisible();
  const editor = page.locator(".editor-page");
  const header = editor.locator(".editor-page__header");
  const navigation = editor.getByRole("navigation", { name: "帖子详情分区" });
  const sideRail = editor.locator(".editor-page__content aside");

  await expect(header).toHaveCSS("position", "static");
  await expect(navigation).toHaveCSS("position", "static");
  await expect(sideRail).toHaveCSS("position", "static");

  const main = page.locator("#main-content");
  const scrollState = await main.evaluate((element) => {
    element.scrollTop = element.scrollHeight;

    return { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
  });

  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
  const geometry = await editor.evaluate((element) => {
    const mainElement = document.getElementById("main-content");
    const pageHeader = element.querySelector(".editor-page__header");
    const sectionNavigation = element.querySelector("nav[aria-label='帖子详情分区']");

    if (!mainElement || !pageHeader || !sectionNavigation) {
      return null;
    }

    return {
      mainTop: mainElement.getBoundingClientRect().top,
      headerBottom: pageHeader.getBoundingClientRect().bottom,
      navigationBottom: sectionNavigation.getBoundingClientRect().bottom,
    };
  });

  if (!geometry) {
    throw new Error("Post detail scroll geometry was unavailable");
  }

  expect(geometry.headerBottom).toBeLessThanOrEqual(geometry.mainTop);
  expect(geometry.navigationBottom).toBeLessThanOrEqual(geometry.mainTop);
  await testInfo.attach("post-detail-bottom-1440", {
    body: await page.screenshot({ animations: "disabled", caret: "hide" }),
    contentType: "image/png",
  });
});
