import type { AdminUserListItem, ReplaceRbacRoleUsersRequest } from "@petcare/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../auth";
import { fetchRbacRoleUsers, replaceRbacRoleUsers } from "./users";

vi.mock("../auth", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const users: AdminUserListItem[] = [
  {
    id: "user-1",
    phone: "13800138000",
    username: "operator",
    nickname: "Operator",
    avatar: null,
    userType: "provider",
    status: "active",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    provider: null,
  },
];

describe("RBAC role user API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets users assigned to a role", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: users });

    await expect(fetchRbacRoleUsers("role-1")).resolves.toEqual(users);
    expect(apiClient.get).toHaveBeenCalledWith("/admin/rbac/roles/role-1/users");
  });

  it("replaces assigned role users with the shared replacement payload", async () => {
    const request: ReplaceRbacRoleUsersRequest = { userIds: ["user-1", "user-2"] };

    vi.mocked(apiClient.put).mockResolvedValue({ data: users });

    await expect(replaceRbacRoleUsers("role-1", request)).resolves.toEqual(users);
    expect(apiClient.put).toHaveBeenCalledWith("/admin/rbac/roles/role-1/users", request);
  });
});
