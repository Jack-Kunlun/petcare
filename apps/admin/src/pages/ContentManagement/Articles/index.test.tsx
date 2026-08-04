import type { AdminClassroomArticleListItem } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminClassroomArticles } from "../../../api/content/articles";
import ContentArticles from ".";

vi.mock("../../../api/content/articles", () => ({ fetchAdminClassroomArticles: vi.fn() }));

const article: AdminClassroomArticleListItem = {
  id: "article-1",
  title: "幼犬喂养课堂",
  summary: "基础喂养知识",
  coverUrl: null,
  status: "draft",
  author: null,
  publishedAt: null,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

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
    vi.mocked(fetchAdminClassroomArticles).mockResolvedValue({
      list: [article],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("renders draft article metadata and system author fallback", async () => {
    renderPage();

    expect(await screen.findByText("幼犬喂养课堂")).toBeTruthy();
    expect(screen.getByText("系统文章")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("草稿")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("未发布")).toBeTruthy();
  });
});
