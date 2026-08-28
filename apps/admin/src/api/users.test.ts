import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./auth";
import { fetchAdminUser, fetchAdminUsers } from "./users";

vi.mock("./auth", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("fetchAdminUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("通过管理员用户接口传递分页和筛选参数", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { list: [], total: 0, page: 2, pageSize: 20 },
    });

    await expect(
      fetchAdminUsers({
        page: 2,
        pageSize: 20,
        keyword: "小宠",
        userType: "provider",
        status: "active",
      }),
    ).resolves.toEqual({ list: [], total: 0, page: 2, pageSize: 20 });

    expect(apiClient.get).toHaveBeenCalledWith("/admin/users", {
      params: {
        page: 2,
        pageSize: 20,
        keyword: "小宠",
        userType: "provider",
        status: "active",
      },
    });
  });

  it("通过用户标识查询后台用户详情", async () => {
    const detail = {
      id: "user-1",
      phone: null,
      username: null,
      nickname: "小宠家长",
      avatar: null,
      userType: "pet_owner" as const,
      status: "active" as const,
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
      profile: { bio: "喜欢猫咪" },
      activity: { petCount: 1, postCount: 2, commentCount: 3, favoriteCount: 4 },
    };

    vi.mocked(apiClient.get).mockResolvedValue({ data: detail });

    await expect(fetchAdminUser("user-1")).resolves.toEqual(detail);
    expect(apiClient.get).toHaveBeenCalledWith("/admin/users/user-1");
  });
});
