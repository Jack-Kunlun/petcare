import type { AdminContentPostListItem } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminContentPosts } from "../../../api/content/posts";
import ContentPosts from ".";

vi.mock("../../../api/content/posts", () => ({ fetchAdminContentPosts: vi.fn() }));

const post: AdminContentPostListItem = {
  id: "post-1",
  author: { id: "user-1", phone: "13800138000", username: null, nickname: "小明", avatar: null },
  contentExcerpt: "这是一段帖子摘要",
  mediaCount: 2,
  likesCount: 3,
  commentsCount: 2,
  sharesCount: 1,
  status: "published",
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/content/posts"]}>
        <ContentPosts />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ContentPosts", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminContentPosts).mockResolvedValue({
      list: [post],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("renders the post author, engagement summary, and status", async () => {
    renderPage();

    expect(await screen.findByText("这是一段帖子摘要")).toBeTruthy();
    expect(screen.getByText("赞 3")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("已发布")).toBeTruthy();
    expect(screen.getByText("共 1 条帖子")).toBeTruthy();
    expect(screen.getByRole("link", { name: "查看详情" })).toHaveAttribute(
      "href",
      "/content/posts/post-1",
    );
  });
});
