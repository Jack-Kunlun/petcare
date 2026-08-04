import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../auth";
import { fetchAdminClassroomArticles } from "./articles";
import { fetchAdminContentPosts } from "./posts";
import { fetchAdminContentRewards } from "./rewards";

vi.mock("../auth", () => ({
  apiClient: { get: vi.fn() },
}));

describe("content api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the rewards endpoint with shared query types", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { list: [], total: 0, page: 1, pageSize: 20 },
    });
    const query = { page: 1, pageSize: 20, status: "pending_confirm" as const };

    await expect(fetchAdminContentRewards(query)).resolves.toEqual({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(apiClient.get).toHaveBeenCalledWith("/admin/content/rewards", { params: query });
  });

  it("calls post and article endpoints", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { list: [], total: 0, page: 1, pageSize: 20 },
    });

    await fetchAdminContentPosts({ page: 1, pageSize: 20, status: "published" });
    await fetchAdminClassroomArticles({ page: 1, pageSize: 20, status: "draft" });

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/admin/content/posts", {
      params: { page: 1, pageSize: 20, status: "published" },
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/admin/content/articles", {
      params: { page: 1, pageSize: 20, status: "draft" },
    });
  });
});
