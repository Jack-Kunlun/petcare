import type { AdminClassroomArticleListItem } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdminClassroomArticles,
  offlineAdminClassroomArticle,
  publishAdminClassroomArticle,
} from "../../../api/content/articles";
import ContentArticles from ".";

const permissionMocks = vi.hoisted(() => ({ has: vi.fn() }));

vi.mock("../../../api/content/articles", () => ({
  articleQueryKeys: { all: ["article-query-key"] },
  fetchAdminClassroomArticles: vi.fn(),
  offlineAdminClassroomArticle: vi.fn(),
  publishAdminClassroomArticle: vi.fn(),
}));

vi.mock("../../../auth/permissions", () => ({
  usePermissions: () => permissionMocks,
}));

const draftArticle: AdminClassroomArticleListItem = {
  id: "article-1",
  title: "幼犬喂养课堂",
  summary: "基础喂养知识",
  coverUrl: null,
  publicUrl: "https://petcare-home.com/articles/article-1",
  status: "draft",
  author: null,
  publishedAt: null,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
};

const publishedArticle: AdminClassroomArticleListItem = {
  ...draftArticle,
  id: "article-2",
  title: "已发布文章",
  publicUrl: "https://petcare-home.com/articles/article-2",
  status: "published",
  publishedAt: "2026-08-01T10:00:00.000Z",
};

const offlineArticle: AdminClassroomArticleListItem = {
  ...draftArticle,
  id: "article-3",
  title: "已下线文章",
  publicUrl: "https://petcare-home.com/articles/article-3",
  status: "offline",
};

const articleResponse = {
  list: [draftArticle, publishedArticle, offlineArticle],
  total: 3,
  page: 1,
  pageSize: 20,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/content/articles"]}>
        <ContentArticles />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ContentArticles", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    permissionMocks.has.mockReturnValue(true);
    vi.mocked(fetchAdminClassroomArticles).mockResolvedValue(articleResponse);
    vi.mocked(publishAdminClassroomArticle).mockResolvedValue({} as never);
    vi.mocked(offlineAdminClassroomArticle).mockResolvedValue({} as never);
  });

  it("shows only actions allowed by article state and operator permissions", async () => {
    renderPage();

    await screen.findByText(draftArticle.title);
    expect(screen.getByRole("link", { name: "新建文章" })).toHaveAttribute(
      "href",
      "/content/articles/new",
    );
    expect(screen.getAllByRole("link", { name: "编辑" })).toHaveLength(2);
    expect(screen.getAllByRole("columnheader", { name: "操作" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "更多 幼犬喂养课堂" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多 已发布文章" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多 已下线文章" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看官网 已发布文章" })).toHaveAttribute(
      "href",
      publishedArticle.publicUrl,
    );
    expect(screen.getByRole("link", { name: "查看官网 已发布文章" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "查看官网 已发布文章" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });

  it("publishes only after confirmation, refreshes the list, and closes the dialog", async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText(draftArticle.title);
    await user.click(screen.getByRole("button", { name: "更多 幼犬喂养课堂" }));
    await user.click(screen.getByRole("menuitem", { name: "发布 幼犬喂养课堂" }));

    expect(screen.getByRole("dialog", { name: "确认发布文章" })).toBeInTheDocument();
    expect(publishAdminClassroomArticle).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "确认发布" }));

    await waitFor(() =>
      expect(publishAdminClassroomArticle).toHaveBeenCalledWith(draftArticle.id, {
        expectedUpdatedAt: draftArticle.updatedAt,
      }),
    );
    await waitFor(() => expect(fetchAdminClassroomArticles).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog", { name: "确认发布文章" })).not.toBeInTheDocument();
  });

  it("uses the clicked article timestamp for republishing and taking an article offline", async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText(offlineArticle.title);
    await user.click(screen.getByRole("button", { name: "更多 已下线文章" }));
    await user.click(screen.getByRole("menuitem", { name: "重新发布 已下线文章" }));
    await user.click(screen.getByRole("button", { name: "确认发布" }));
    await waitFor(() =>
      expect(publishAdminClassroomArticle).toHaveBeenCalledWith(offlineArticle.id, {
        expectedUpdatedAt: offlineArticle.updatedAt,
      }),
    );

    await user.click(screen.getByRole("button", { name: "更多 已发布文章" }));
    await user.click(screen.getByRole("menuitem", { name: "下线 已发布文章" }));
    expect(screen.getByRole("dialog", { name: "确认下线文章" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认下线" }));
    await waitFor(() =>
      expect(offlineAdminClassroomArticle).toHaveBeenCalledWith(publishedArticle.id, {
        expectedUpdatedAt: publishedArticle.updatedAt,
      }),
    );
  });

  it("hides write and publish controls for a read-only operator while retaining website links", async () => {
    permissionMocks.has.mockReturnValue(false);
    renderPage();

    await screen.findByText(draftArticle.title);
    expect(screen.queryByRole("link", { name: "新建文章" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /更多/u })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看官网 已发布文章" })).toBeInTheDocument();
  });

  it("shows only new and edit controls without publish permission", async () => {
    permissionMocks.has.mockImplementation((code: string) => code === "content.article.write");
    renderPage();

    await screen.findByText(draftArticle.title);
    expect(screen.getByRole("link", { name: "新建文章" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "编辑" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /更多/u })).not.toBeInTheDocument();
  });

  it("keeps a pending state dialog open and disables its native controls", async () => {
    const user = userEvent.setup();

    vi.mocked(publishAdminClassroomArticle).mockReturnValue(new Promise(() => undefined));
    renderPage();

    await screen.findByText(draftArticle.title);
    await user.click(screen.getByRole("button", { name: "更多 幼犬喂养课堂" }));
    await user.click(screen.getByRole("menuitem", { name: "发布 幼犬喂养课堂" }));
    await user.click(screen.getByRole("button", { name: "确认发布" }));

    await waitFor(() => expect(publishAdminClassroomArticle).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "处理中…" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "确认发布文章" })).toBeInTheDocument();
  });

  it("keeps the confirmation dialog open when the state mutation fails", async () => {
    const user = userEvent.setup();

    vi.mocked(publishAdminClassroomArticle).mockRejectedValue(new Error("publish failed"));
    renderPage();

    await screen.findByText(draftArticle.title);
    await user.click(screen.getByRole("button", { name: "更多 幼犬喂养课堂" }));
    await user.click(screen.getByRole("menuitem", { name: "发布 幼犬喂养课堂" }));
    await user.click(screen.getByRole("button", { name: "确认发布" }));

    await waitFor(() => expect(publishAdminClassroomArticle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认发布" })).toBeEnabled());
    expect(screen.getByRole("dialog", { name: "确认发布文章" })).toBeInTheDocument();
  });

  it("uses the article management name and aligns all primary controls to 40px", async () => {
    renderPage();

    await screen.findByText(draftArticle.title);

    expect(screen.getByRole("heading", { name: "文章管理" })).toBeInTheDocument();
    expect(screen.getByText("共 3 篇文章").parentElement).toHaveClass("h-10");
    expect(screen.getByRole("link", { name: "新建文章" })).toHaveClass("h-10");
    expect(screen.getByRole("searchbox", { name: "搜索文章" })).toHaveClass("h-10");
    expect(screen.getByRole("combobox", { name: "文章状态" })).toHaveClass("h-10");
    expect(screen.getByRole("button", { name: "查询" })).toHaveClass("h-10");
    expect(screen.getByRole("button", { name: "重置筛选条件" })).toHaveClass("h-10", "w-10");
  });

  it("offers the first article action when no articles exist", async () => {
    vi.mocked(fetchAdminClassroomArticles).mockResolvedValue({
      ...articleResponse,
      list: [],
      total: 0,
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "暂无文章" })).toBeInTheDocument();
    expect(screen.getByText("还没有创建文章，可以创建第一篇文章。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "创建第一篇文章" })).toHaveAttribute(
      "href",
      "/content/articles/new",
    );
  });

  it("offers to reset applied filters when no article matches", async () => {
    vi.mocked(fetchAdminClassroomArticles).mockResolvedValue({
      ...articleResponse,
      list: [],
      total: 0,
    });
    const user = userEvent.setup();

    renderPage();
    await user.type(screen.getByRole("searchbox", { name: "搜索文章" }), "犬粮");
    await user.click(screen.getByRole("button", { name: "查询" }));

    expect(await screen.findByRole("heading", { name: "没有符合条件的文章" })).toBeInTheDocument();
    expect(screen.getByText("尝试调整搜索关键词或筛选条件。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重置筛选" }));
    await waitFor(() =>
      expect(fetchAdminClassroomArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: undefined, status: undefined }),
      ),
    );
  });
});
