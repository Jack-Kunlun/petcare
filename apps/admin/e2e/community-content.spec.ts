import {
  COMMUNITY_POST_REPORT_REASON,
  type AdminCommunityPostComment,
  type AdminCommunityPostCommentListResponse,
  type AdminCommunityPostReportResponse,
  type AdminContentPostDetail,
  type ApiErrorResponse,
  type CommunityPostLikeState,
  type MyCommunityPostListItem,
  type MyCommunityPostListResponse,
  type PublicCommunityPostDetail,
  type PublicCommunityPostComment,
  type PublicCommunityPostCommentListResponse,
  type PublicCommunityPostListResponse,
} from "@petcare/shared-types";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";

function requiredEnv(
  name:
    | "ADMIN_E2E_MINIAPP_URL"
    | "COMMUNITY_E2E_AUTHOR_TOKEN"
    | "COMMUNITY_E2E_REPORTER_TOKEN"
    | "DEFAULT_ADMIN_PASSWORD"
    | "DEFAULT_ADMIN_USERNAME"
    | "RBAC_E2E_RESTRICTED_PASSWORD"
    | "RBAC_E2E_RESTRICTED_USERNAME",
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Community Content E2E`);
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
    const payload = (await response.json()) as { data: { accessToken: string } };

    if (!response.ok) {
      throw new Error(`Admin refresh failed with status ${response.status}`);
    }

    return payload.data.accessToken;
  });
}

async function loginAccessToken(
  request: APIRequestContext,
  identifier: string,
  password: string,
): Promise<string> {
  const response = await request.post("/api/auth/login/password", {
    data: { identifier, password },
  });

  return (await responseData<{ accessToken: string }>(response)).accessToken;
}

async function responseData<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(`Request failed with ${response.status()}: ${await response.text()}`);
  }

  return ((await response.json()) as { data: T }).data;
}

async function expectFailure(response: APIResponse, status: number, code?: string): Promise<void> {
  expect(response.status()).toBe(status);

  if (code) {
    expect(((await response.json()) as ApiErrorResponse).code).toBe(code);
  }
}

test("受控社区动态从发布、举报到后台下架保持纵向一致", async ({ browser, page, request }) => {
  const content = `社区纵向 E2E ${Date.now()}`;
  const authorAuthorization = `Bearer ${requiredEnv("COMMUNITY_E2E_AUTHOR_TOKEN")}`;
  const reporterAuthorization = `Bearer ${requiredEnv("COMMUNITY_E2E_REPORTER_TOKEN")}`;

  await loginAdmin(page);
  const adminAuthorization = `Bearer ${await refreshAccessToken(page)}`;

  await responseData<MyCommunityPostListItem>(
    await page.request.post("/api/community/posts", {
      headers: { Authorization: authorAuthorization },
      data: { content: `${content} 限流探针` },
    }),
  );
  await expectFailure(
    await page.request.post("/api/community/posts", {
      headers: { Authorization: authorAuthorization },
      data: { content: `${content} 不应落库` },
    }),
    429,
    "COMMUNITY_POST_RATE_LIMITED",
  );
  const mineAfterLimit = await responseData<MyCommunityPostListResponse>(
    await page.request.get("/api/community/posts/mine?page=1&pageSize=20", {
      headers: { Authorization: authorAuthorization },
    }),
  );

  expect(mineAfterLimit.total).toBe(1);
  await page.waitForTimeout(1_100);
  const pending = await responseData<MyCommunityPostListItem>(
    await page.request.post("/api/community/posts", {
      headers: { Authorization: authorAuthorization },
      data: { content },
    }),
  );

  expect(pending.status).toBe("pending");
  await expectFailure(await page.request.get(`/api/content/community-posts/${pending.id}`), 404);
  await expectFailure(
    await page.request.get(
      `/api/content/community-posts/${pending.id}/comments?page=1&pageSize=20`,
    ),
    404,
    "CONTENT_POST_NOT_FOUND",
  );
  await expectFailure(
    await page.request.post(`/api/community/posts/${pending.id}/comments`, {
      headers: { Authorization: reporterAuthorization },
      data: { content: "未公开评论" },
    }),
    404,
    "CONTENT_POST_NOT_FOUND",
  );
  await expectFailure(
    await page.request.post(`/api/community/posts/${pending.id}/reports`, {
      headers: { Authorization: reporterAuthorization },
      data: { reason: COMMUNITY_POST_REPORT_REASON.SPAM },
    }),
    404,
    "CONTENT_POST_NOT_FOUND",
  );

  const published = await responseData<AdminContentPostDetail>(
    await page.request.post(`/api/admin/content/posts/${pending.id}/approve`, {
      headers: { Authorization: adminAuthorization },
      data: { expectedUpdatedAt: pending.updatedAt },
    }),
  );
  const publicList = await responseData<PublicCommunityPostListResponse>(
    await page.request.get("/api/content/community-posts?page=1&pageSize=20"),
  );

  expect(publicList.list.map((post) => post.id)).toContain(pending.id);
  const concurrentLikes = await Promise.all([
    page.request.put(`/api/community/posts/${pending.id}/like`, {
      headers: { Authorization: reporterAuthorization },
    }),
    page.request.put(`/api/community/posts/${pending.id}/like`, {
      headers: { Authorization: reporterAuthorization },
    }),
  ]);

  await Promise.all(
    concurrentLikes.map((response) => responseData<CommunityPostLikeState>(response)),
  );
  await expect(
    responseData<CommunityPostLikeState>(
      await page.request.get(`/api/community/posts/${pending.id}/like`, {
        headers: { Authorization: reporterAuthorization },
      }),
    ),
  ).resolves.toEqual({ liked: true, likesCount: 1 });
  await expect(
    responseData<PublicCommunityPostDetail>(
      await page.request.get(`/api/content/community-posts/${pending.id}`),
    ),
  ).resolves.toMatchObject({ likesCount: 1, commentsCount: 0 });

  const concurrentUnlikes = await Promise.all([
    page.request.delete(`/api/community/posts/${pending.id}/like`, {
      headers: { Authorization: reporterAuthorization },
    }),
    page.request.delete(`/api/community/posts/${pending.id}/like`, {
      headers: { Authorization: reporterAuthorization },
    }),
  ]);

  await Promise.all(
    concurrentUnlikes.map((response) => responseData<CommunityPostLikeState>(response)),
  );
  await expect(
    responseData<CommunityPostLikeState>(
      await page.request.get(`/api/community/posts/${pending.id}/like`, {
        headers: { Authorization: reporterAuthorization },
      }),
    ),
  ).resolves.toEqual({ liked: false, likesCount: 0 });
  await expectFailure(
    await request.post(`/api/community/posts/${pending.id}/comments`, {
      data: { content: "匿名评论" },
    }),
    401,
  );
  const commentContent = "评".repeat(200);
  const reporterComment = await responseData<PublicCommunityPostComment>(
    await page.request.post(`/api/community/posts/${pending.id}/comments`, {
      headers: { Authorization: reporterAuthorization },
      data: { content: `  ${commentContent}  ` },
    }),
  );

  expect(reporterComment).toMatchObject({ content: commentContent, canDelete: true });
  expect(Object.keys(reporterComment.author).sort()).toEqual(["avatar", "displayName"]);
  await expectFailure(
    await page.request.post(`/api/community/posts/${pending.id}/comments`, {
      headers: { Authorization: reporterAuthorization },
      data: { content: "评".repeat(201) },
    }),
    400,
  );
  const publicComments = await responseData<PublicCommunityPostCommentListResponse>(
    await page.request.get(
      `/api/content/community-posts/${pending.id}/comments?page=1&pageSize=20`,
    ),
  );
  const ownedComments = await responseData<PublicCommunityPostCommentListResponse>(
    await page.request.get(`/api/community/posts/${pending.id}/comments?page=1&pageSize=20`, {
      headers: { Authorization: reporterAuthorization },
    }),
  );

  expect(publicComments).toMatchObject({
    total: 1,
    list: [{ id: reporterComment.id, content: commentContent, canDelete: false }],
  });
  expect(ownedComments.list).toMatchObject([{ id: reporterComment.id, canDelete: true }]);
  await expectFailure(
    await page.request.delete(`/api/community/posts/${pending.id}/comments/${reporterComment.id}`, {
      headers: { Authorization: authorAuthorization },
    }),
    403,
    "CONTENT_COMMENT_FORBIDDEN",
  );
  const authorComment = await responseData<PublicCommunityPostComment>(
    await page.request.post(`/api/community/posts/${pending.id}/comments`, {
      headers: { Authorization: authorAuthorization },
      data: { content: "作者补充" },
    }),
  );
  const firstDelete = await page.request.delete(
    `/api/community/posts/${pending.id}/comments/${authorComment.id}`,
    { headers: { Authorization: authorAuthorization } },
  );
  const repeatedDelete = await page.request.delete(
    `/api/community/posts/${pending.id}/comments/${authorComment.id}`,
    { headers: { Authorization: authorAuthorization } },
  );

  expect(firstDelete.status()).toBe(204);
  expect(repeatedDelete.status()).toBe(204);
  await expect(
    responseData<PublicCommunityPostDetail>(
      await page.request.get(`/api/content/community-posts/${pending.id}`),
    ),
  ).resolves.toMatchObject({ commentsCount: 1 });
  await expectFailure(
    await request.post(`/api/community/posts/${pending.id}/reports`, {
      data: { reason: COMMUNITY_POST_REPORT_REASON.SPAM },
    }),
    401,
  );
  await expectFailure(
    await page.request.post(`/api/community/posts/${pending.id}/reports`, {
      headers: { Authorization: authorAuthorization },
      data: { reason: COMMUNITY_POST_REPORT_REASON.SPAM },
    }),
    403,
    "CONTENT_POST_REPORT_SELF",
  );
  await responseData(
    await page.request.post(`/api/community/posts/${pending.id}/reports`, {
      headers: { Authorization: reporterAuthorization },
      data: {
        reason: COMMUNITY_POST_REPORT_REASON.SPAM,
        description: "重复发布广告内容",
      },
    }),
  );
  await expectFailure(
    await page.request.post(`/api/community/posts/${pending.id}/reports`, {
      headers: { Authorization: reporterAuthorization },
      data: { reason: COMMUNITY_POST_REPORT_REASON.OTHER },
    }),
    409,
    "CONTENT_POST_REPORT_DUPLICATE",
  );

  const reports = await responseData<AdminCommunityPostReportResponse>(
    await page.request.get(`/api/admin/content/posts/${pending.id}/reports`, {
      headers: { Authorization: adminAuthorization },
    }),
  );

  expect(reports).toMatchObject({ total: 1, list: [{ reason: "spam", status: "pending" }] });
  const adminComments = await responseData<AdminCommunityPostCommentListResponse>(
    await page.request.get(`/api/admin/content/posts/${pending.id}/comments?page=1&pageSize=20`, {
      headers: { Authorization: adminAuthorization },
    }),
  );

  expect(adminComments).toMatchObject({
    total: 2,
    list: expect.arrayContaining([
      expect.objectContaining({ id: reporterComment.id, status: "published" }),
      expect.objectContaining({ id: authorComment.id, status: "deleted" }),
    ]),
  });
  const restrictedAuthorization = `Bearer ${await loginAccessToken(
    request,
    requiredEnv("RBAC_E2E_RESTRICTED_USERNAME"),
    requiredEnv("RBAC_E2E_RESTRICTED_PASSWORD"),
  )}`;

  await expectFailure(
    await request.get(`/api/admin/content/posts/${pending.id}/reports`, {
      headers: { Authorization: restrictedAuthorization },
    }),
    403,
  );
  await expectFailure(
    await request.get(`/api/admin/content/posts/${pending.id}/comments?page=1&pageSize=20`, {
      headers: { Authorization: restrictedAuthorization },
    }),
    403,
  );
  await expectFailure(
    await request.post(
      `/api/admin/content/posts/${pending.id}/comments/${reporterComment.id}/offline`,
      {
        headers: { Authorization: restrictedAuthorization },
        data: { reason: "越权请求" },
      },
    ),
    403,
  );
  await expectFailure(
    await request.post(`/api/admin/content/posts/${pending.id}/offline`, {
      headers: { Authorization: restrictedAuthorization },
      data: { expectedUpdatedAt: published.updatedAt, reason: "越权请求" },
    }),
    403,
  );

  const miniappContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const miniappPage = await miniappContext.newPage();
  const miniappUrl = requiredEnv("ADMIN_E2E_MINIAPP_URL");

  try {
    await miniappPage.goto(`${miniappUrl}/#/pages/community/index`);
    await expect(miniappPage.getByText(content, { exact: true })).toBeVisible();
    await miniappPage.goto(`${miniappUrl}/#/pages-content/community/article?id=${pending.id}`);
    await expect(miniappPage.getByText(content, { exact: true })).toBeVisible();
    await expect(miniappPage.getByText(commentContent, { exact: true })).toBeVisible();

    await page.evaluate((postId) => {
      globalThis.history.pushState({}, "", `/content/posts/${postId}`);
      globalThis.dispatchEvent(new PopStateEvent("popstate"));
    }, pending.id);
    await expect(page).toHaveURL(new RegExp(`/content/posts/${pending.id}$`, "u"));
    await expect(page.getByText("垃圾广告或诈骗", { exact: true })).toBeVisible();
    await expect(page.getByText(/举报人：社区 E2E 举报人/u)).toBeVisible();
    await expect(page.getByText(commentContent, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "下架评论" }).click();
    await page.getByLabel(/评论下架原因/u).fill("评论违反社区规范");
    await page.getByRole("button", { name: "确认下架评论" }).click();
    await expect(page.getByText("评论下架成功", { exact: true })).toBeVisible();

    const repeatedOffline = await responseData<AdminCommunityPostComment>(
      await page.request.post(
        `/api/admin/content/posts/${pending.id}/comments/${reporterComment.id}/offline`,
        {
          headers: { Authorization: adminAuthorization },
          data: { reason: "重复下架" },
        },
      ),
    );
    const secondRepeatedOffline = await responseData<AdminCommunityPostComment>(
      await page.request.post(
        `/api/admin/content/posts/${pending.id}/comments/${reporterComment.id}/offline`,
        {
          headers: { Authorization: adminAuthorization },
          data: { reason: "再次重复下架" },
        },
      ),
    );

    expect(repeatedOffline).toMatchObject({
      status: "offline",
      moderationReason: "评论违反社区规范",
    });
    expect(secondRepeatedOffline).toMatchObject({
      status: "offline",
      moderationReason: "评论违反社区规范",
    });
    await expect(
      responseData<PublicCommunityPostCommentListResponse>(
        await page.request.get(
          `/api/content/community-posts/${pending.id}/comments?page=1&pageSize=20`,
        ),
      ),
    ).resolves.toMatchObject({ list: [], total: 0 });
    await expect(
      responseData<PublicCommunityPostDetail>(
        await page.request.get(`/api/content/community-posts/${pending.id}`),
      ),
    ).resolves.toMatchObject({ commentsCount: 0 });
    await miniappPage.reload();
    await expect(miniappPage.getByText(commentContent, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "从举报下架帖子" }).click();
    await page.getByLabel(/下架原因/u).fill("举报核实后下架");
    await page.getByRole("button", { name: "确认下架" }).click();
    await expect(page.getByRole("status")).toContainText("下架成功");

    await expectFailure(await page.request.get(`/api/content/community-posts/${pending.id}`), 404);
    await expectFailure(
      await page.request.get(
        `/api/content/community-posts/${pending.id}/comments?page=1&pageSize=20`,
      ),
      404,
      "CONTENT_POST_NOT_FOUND",
    );
    await expectFailure(
      await page.request.post(`/api/community/posts/${pending.id}/comments`, {
        headers: { Authorization: reporterAuthorization },
        data: { content: "下架后评论" },
      }),
      404,
      "CONTENT_POST_NOT_FOUND",
    );
    const afterOffline = await responseData<PublicCommunityPostListResponse>(
      await page.request.get("/api/content/community-posts?page=1&pageSize=20"),
    );

    expect(afterOffline.list.map((post) => post.id)).not.toContain(pending.id);
    await expectFailure(
      await page.request.post(`/api/community/posts/${pending.id}/reports`, {
        headers: { Authorization: reporterAuthorization },
        data: { reason: COMMUNITY_POST_REPORT_REASON.SPAM },
      }),
      404,
      "CONTENT_POST_NOT_FOUND",
    );
    const resolvedReports = await responseData<AdminCommunityPostReportResponse>(
      await page.request.get(`/api/admin/content/posts/${pending.id}/reports`, {
        headers: { Authorization: adminAuthorization },
      }),
    );

    expect(resolvedReports.list).toMatchObject([{ id: reports.list[0].id, status: "resolved" }]);
    await miniappPage.goto(`${miniappUrl}/#/pages/community/index`);
    await miniappPage.reload();
    await expect(miniappPage.getByText(content, { exact: true })).toHaveCount(0);
    await miniappPage.goto(`${miniappUrl}/#/pages-content/community/article?id=${pending.id}`);
    await expect(miniappPage.getByText("动态不存在、未公开或加载失败")).toBeVisible();
  } finally {
    await miniappContext.close();
  }
});
