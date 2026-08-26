import type { AdminClassroomArticleDetail } from "@petcare/shared-types";
import { CLASSROOM_ARTICLE_CATEGORY } from "@petcare/shared-types";
import { expect, test, type APIResponse, type Page } from "@playwright/test";

function requiredEnv(
  name: "ADMIN_E2E_MINIAPP_URL" | "DEFAULT_ADMIN_PASSWORD" | "DEFAULT_ADMIN_USERNAME",
) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Classroom Content E2E`);
  }

  return value;
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("手机号或账号").fill(requiredEnv("DEFAULT_ADMIN_USERNAME"));
  await page.getByLabel("密码").fill(requiredEnv("DEFAULT_ADMIN_PASSWORD"));
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "运营概览" })).toBeVisible();
}

async function refreshAccessToken(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Admin refresh failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { data: { accessToken: string } };

    return payload.data.accessToken;
  });
}

async function responseData<T>(response: APIResponse): Promise<T> {
  expect(response.ok()).toBe(true);

  return ((await response.json()) as { data: T }).data;
}

test("Admin 发布的课堂文章在 Miniapp 可见且下线后不可访问", async ({ browser, page }) => {
  const title = `课堂纵向 E2E ${Date.now()}`;
  const bodyText = "每天梳毛并观察皮肤状态";

  await loginAdmin(page);
  const authorization = `Bearer ${await refreshAccessToken(page)}`;
  const draft = await responseData<AdminClassroomArticleDetail>(
    await page.request.post("/api/admin/content/articles", {
      headers: { Authorization: authorization },
      data: {
        category: CLASSROOM_ARTICLE_CATEGORY.HEALTH_MANAGEMENT,
        title,
        summary: "隔离环境中的课堂文章摘要",
        bodyHtml: `<p>${bodyText}</p>`,
      },
    }),
  );
  const published = await responseData<AdminClassroomArticleDetail>(
    await page.request.post(`/api/admin/content/articles/${draft.id}/publish`, {
      headers: { Authorization: authorization },
      data: { expectedUpdatedAt: draft.updatedAt },
    }),
  );
  const miniappContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const miniappPage = await miniappContext.newPage();
  const miniappUrl = requiredEnv("ADMIN_E2E_MINIAPP_URL");

  try {
    await miniappPage.goto(`${miniappUrl}/#/pages/community/index?tab=classroom`);
    await expect(miniappPage.getByText(title, { exact: true })).toBeVisible();
    const classroomSearch = miniappPage.getByLabel("搜索课堂文章").locator("input");

    await classroomSearch.fill(title);
    await classroomSearch.press("Enter");
    await expect(miniappPage.getByText(title, { exact: true })).toBeVisible();
    await miniappPage.getByText(title, { exact: true }).click();
    await expect(miniappPage).toHaveURL(
      new RegExp(`/pages-content/classroom/article\\?id=${draft.id}$`, "u"),
    );
    await expect(miniappPage.getByText(title, { exact: true })).toBeVisible();
    await expect(miniappPage.getByText(bodyText, { exact: true })).toBeVisible();

    await responseData<AdminClassroomArticleDetail>(
      await page.request.post(`/api/admin/content/articles/${draft.id}/offline`, {
        headers: { Authorization: authorization },
        data: { expectedUpdatedAt: published.updatedAt },
      }),
    );

    await miniappPage.goto(`${miniappUrl}/#/pages/community/index?tab=classroom`);
    await miniappPage.reload();
    await expect(miniappPage.getByText(title, { exact: true })).toHaveCount(0);
    await expect(miniappPage.getByText("未找到符合条件的课堂文章")).toBeVisible();

    await miniappPage.goto(`${miniappUrl}/#/pages-content/classroom/article?id=${draft.id}`);
    await expect(miniappPage.getByText("文章已下线或不存在")).toBeVisible();
  } finally {
    await miniappContext.close();
  }
});
