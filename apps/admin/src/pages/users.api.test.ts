import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../auth/auth.api";
import { fetchAdminUsers } from "./users.api";

vi.mock("../auth/auth.api", () => ({
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
});
