import type {
  CreateRbacRoleRequest,
  RbacRoleDetail,
  RbacRoleListResponse,
  ReplaceRbacRolePermissionsRequest,
  UpdateRbacRoleRequest,
} from "@petcare/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../auth";
import {
  createRbacRole,
  deleteRbacRole,
  fetchRbacRole,
  fetchRbacRoles,
  replaceRbacRolePermissions,
  updateRbacRole,
} from "./roles";

vi.mock("../auth", () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const role: RbacRoleDetail = {
  id: "role-1",
  roleName: "operator",
  description: "Operations role",
  isSystem: false,
  isActive: true,
  permissionCount: 1,
  userCount: 1,
  updatedAt: "2026-08-02T00:00:00.000Z",
  permissionCodes: ["system.view"],
  userIds: ["user-1"],
};

describe("RBAC role API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists roles with the shared pagination query and unwrapped response", async () => {
    const response: RbacRoleListResponse = { list: [role], total: 1, page: 2, pageSize: 20 };

    vi.mocked(apiClient.get).mockResolvedValue({ data: response });

    await expect(
      fetchRbacRoles({ page: 2, pageSize: 20, roleName: "operator", isActive: true }),
    ).resolves.toEqual(response);
    expect(apiClient.get).toHaveBeenCalledWith("/admin/rbac/roles", {
      params: { page: 2, pageSize: 20, roleName: "operator", isActive: true },
    });
  });

  it("gets a role detail by its identifier", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: role });

    await expect(fetchRbacRole("role-1")).resolves.toEqual(role);
    expect(apiClient.get).toHaveBeenCalledWith("/admin/rbac/roles/role-1");
  });

  it("creates and updates roles with shared request contracts", async () => {
    const createRequest: CreateRbacRoleRequest = {
      roleName: "dispatcher",
      description: "Dispatches care",
    };
    const updateRequest: UpdateRbacRoleRequest = { roleName: "senior-dispatcher", isActive: false };

    vi.mocked(apiClient.post).mockResolvedValue({ data: role });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: role });

    await expect(createRbacRole(createRequest)).resolves.toEqual(role);
    await expect(updateRbacRole("role-1", updateRequest)).resolves.toEqual(role);

    expect(apiClient.post).toHaveBeenCalledWith("/admin/rbac/roles", createRequest);
    expect(apiClient.patch).toHaveBeenCalledWith("/admin/rbac/roles/role-1", updateRequest);
  });

  it("deletes a role without expecting a response body", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });

    await expect(deleteRbacRole("role-1")).resolves.toBeUndefined();
    expect(apiClient.delete).toHaveBeenCalledWith("/admin/rbac/roles/role-1");
  });

  it("replaces role permissions with the shared replacement payload", async () => {
    const request: ReplaceRbacRolePermissionsRequest = { permissionCodes: ["system.view"] };

    vi.mocked(apiClient.put).mockResolvedValue({ data: role });

    await expect(replaceRbacRolePermissions("role-1", request)).resolves.toEqual(role);
    expect(apiClient.put).toHaveBeenCalledWith("/admin/rbac/roles/role-1/permissions", request);
  });
});
