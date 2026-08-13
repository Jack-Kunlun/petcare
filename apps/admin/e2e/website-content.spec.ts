import { expect, test, type Page } from "@playwright/test";
import {
  createWebsiteLifecycleTitle,
  loginWebsiteOperator,
  openHomeEditor,
  openHomeEditorRoute,
  websiteContentFixtures,
} from "./fixtures/website-content";

function websiteBaseUrl(): string {
  const value = process.env.ADMIN_E2E_WEBSITE_URL?.trim();

  if (!value) {
    throw new Error("ADMIN_E2E_WEBSITE_URL is required for Website Content E2E");
  }

  return value;
}

async function expectNoStructureControls(page: Page): Promise<void> {
  await expect(
    page.locator("button").filter({ hasText: /新增区块|删除区块|重排|排序|更换区块类型/u }),
  ).toHaveCount(0);
}

async function publishSavedDraft(page: Page, changeSummary: string): Promise<void> {
  await page.getByRole("button", { name: "publish-saved-draft" }).click();

  const dialog = page.getByRole("dialog");

  await expect(dialog.getByText("发布前确认：home")).toBeVisible();
  await dialog.getByRole("textbox", { name: "变更摘要" }).fill(changeSummary);
  await expect(dialog.getByRole("button", { name: "继续发布" })).toBeEnabled();
  await dialog.getByRole("button", { name: "继续发布" }).click();
  await dialog.getByRole("button", { name: "确认发布" }).click();
  await expect(page.getByText(/已发布业务版本 v\d+。/u)).toBeVisible();
}

test.describe("官网内容 Admin 到 Website 发布流程", () => {
  test.describe.configure({ mode: "serial" });

  test("保存草稿隔离公开页，预览固定修订，发布与恢复均需显式确认", async ({ browser, page }) => {
    const livePage = await page.context().newPage();
    const draftTitle = createWebsiteLifecycleTitle();
    let previewPage: Page | undefined;
    let publisherContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

    try {
      await livePage.goto(websiteBaseUrl());
      await expect(
        livePage.getByRole("heading", {
          name: websiteContentFixtures.home.initialTitle,
          exact: true,
        }),
      ).toBeVisible();

      await loginWebsiteOperator(page, websiteContentFixtures.editor);
      await openHomeEditor(page);
      await page.getByLabel(websiteContentFixtures.home.heroTitleLabel).fill(draftTitle);
      await page.getByLabel("变更摘要").fill("官网 E2E：保存首屏草稿");
      await page.getByRole("button", { name: "保存草稿" }).click();
      await expect(page.getByText(/草稿已保存，当前修订版为 r\d+。/u)).toBeVisible();

      await livePage.reload();
      await expect(
        livePage.getByRole("heading", {
          name: websiteContentFixtures.home.initialTitle,
          exact: true,
        }),
      ).toBeVisible();

      const popup = page.waitForEvent("popup");

      await page.getByRole("button", { name: "preview-saved-draft" }).click();
      previewPage = await popup;
      await expect(previewPage).toHaveURL(/\/preview\/home$/u);

      const previewResponse = await previewPage.reload();

      expect(previewResponse).not.toBeNull();
      expect(previewResponse?.headers()["cache-control"]).toContain("no-store");
      expect(previewResponse?.headers()["x-robots-tag"]).toContain("noindex");
      await expect(previewPage.locator("meta[name=\"robots\"]")).toHaveAttribute("content", /noindex/u);
      await expect(previewPage.getByRole("heading", { name: draftTitle, exact: true })).toBeVisible();

      publisherContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
      const publisherPage = await publisherContext.newPage();

      await loginWebsiteOperator(publisherPage, websiteContentFixtures.publisher);
      await openHomeEditorRoute(publisherPage);
      await expect(publisherPage.getByLabel(websiteContentFixtures.home.heroTitleLabel)).toBeDisabled();
      await expect(publisherPage.getByRole("button", { name: "保存草稿" })).toHaveCount(0);
      await expect(publisherPage.getByRole("button", { name: "preview-saved-draft" })).toHaveCount(0);
      await publishSavedDraft(publisherPage, "官网 E2E：发布已保存首屏草稿");

      await livePage.reload();
      await expect(livePage.getByRole("heading", { name: draftTitle, exact: true })).toBeVisible();

      const originalVersion = publisherPage.getByRole("link", { name: /已发布 v1/u });

      await expect(originalVersion).toBeVisible();
      await originalVersion.click();
      await expect(publisherPage).toHaveURL(/\/website-content\/home\/history\//u);
      await publisherPage.getByRole("button", { name: "恢复为新草稿" }).click();
      await publisherPage.getByRole("textbox", { name: "恢复变更摘要" }).fill("官网 E2E：恢复初始首页");
      await publisherPage.getByRole("button", { name: "确认创建草稿" }).click();
      await expect(publisherPage).toHaveURL(/\/website-content\/home\/edit$/u);

      await livePage.reload();
      await expect(livePage.getByRole("heading", { name: draftTitle, exact: true })).toBeVisible();

      await publishSavedDraft(publisherPage, "官网 E2E：显式发布恢复草稿");
      await livePage.reload();
      await expect(
        livePage.getByRole("heading", {
          name: websiteContentFixtures.home.initialTitle,
          exact: true,
        }),
      ).toBeVisible();
    } finally {
      await previewPage?.close();
      await publisherContext?.close();
      await livePage.close();
    }
  });

  test("读者、编辑者和发布者分别只看到其授权的官网内容操作", async ({ browser, page }) => {
    await loginWebsiteOperator(page, websiteContentFixtures.reader);
    await page
      .getByTestId("desktop-menu-tree")
      .getByRole("link", { name: "官网内容管理" })
      .click();
    await expect(page.getByRole("heading", { name: "官网内容" })).toBeVisible();
    await expect(page.getByRole("link", { name: "编辑草稿" })).toHaveCount(0);
    await openHomeEditorRoute(page);
    await expect(page.getByRole("heading", { name: "没有官网内容编辑权限" })).toBeVisible();
    await expect(page.getByRole("button", { name: "保存草稿" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "preview-saved-draft" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "publish-saved-draft" })).toHaveCount(0);

    const editorContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const editorPage = await editorContext.newPage();
    const publisherContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const publisherPage = await publisherContext.newPage();

    try {
      await loginWebsiteOperator(editorPage, websiteContentFixtures.editor);
      await openHomeEditor(editorPage);
      await expect(editorPage.getByRole("button", { name: "保存草稿" })).toBeVisible();
      await expect(editorPage.getByRole("button", { name: "preview-saved-draft" })).toBeVisible();
      await expect(editorPage.getByRole("button", { name: "publish-saved-draft" })).toHaveCount(0);
      await expectNoStructureControls(editorPage);

      await loginWebsiteOperator(publisherPage, websiteContentFixtures.publisher);
      await openHomeEditorRoute(publisherPage);
      await expect(publisherPage.getByLabel(websiteContentFixtures.home.heroTitleLabel)).toBeDisabled();
      await expect(publisherPage.getByRole("button", { name: "保存草稿" })).toHaveCount(0);
      await expect(publisherPage.getByRole("button", { name: "preview-saved-draft" })).toHaveCount(0);
      await expect(publisherPage.getByRole("button", { name: "publish-saved-draft" })).toBeVisible();
      await expectNoStructureControls(publisherPage);
    } finally {
      await editorContext.close();
      await publisherContext.close();
    }
  });

  test("编辑者可选择隔离素材并保存草稿，而无需调用生产 COS", async ({ page }) => {
    await loginWebsiteOperator(page, websiteContentFixtures.editor);
    await openHomeEditor(page);

    const imageSelect = page.getByLabel("首屏图片素材");
    const seededAsset = imageSelect.locator("option", { hasText: "website-e2e-selection.png" });

    await expect(seededAsset).toHaveCount(1);
    const assetId = await seededAsset.getAttribute("value");

    if (!assetId) {
      throw new Error("Website E2E seeded media asset did not expose an option value");
    }

    await imageSelect.selectOption(assetId);
    await page.getByLabel("首屏图片替代文本").fill("官网 E2E 隔离素材");
    await page.getByLabel("变更摘要").fill("官网 E2E：选择隔离素材");
    await page.getByRole("button", { name: "保存草稿" }).click();
    await expect(page.getByText(/草稿已保存，当前修订版为 r\d+。/u)).toBeVisible();
  });
});
