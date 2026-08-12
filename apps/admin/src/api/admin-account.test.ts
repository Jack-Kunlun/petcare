import { describe, expect, it, vi } from "vitest";
import {
  changeAdminPassword,
  deleteAdminAvatar,
  getAdminAccountProfile,
  updateAdminAccountProfile,
  uploadAdminAvatar,
} from "./admin-account";
import { apiClient } from "./auth";

vi.mock("./auth", () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
  },
}));

describe("admin account API client", () => {
  it("gets and updates the current administrator profile", async () => {
    const profile = { id: "admin-1", nickname: "原昵称" };

    vi.mocked(apiClient.get).mockResolvedValue({ data: profile } as never);
    vi.mocked(apiClient.patch).mockResolvedValue({ data: undefined } as never);

    await expect(getAdminAccountProfile()).resolves.toBe(profile);
    await expect(updateAdminAccountProfile({ nickname: "新昵称" })).resolves.toBeUndefined();

    expect(apiClient.get).toHaveBeenCalledWith("/admin/account/profile");
    expect(apiClient.patch).toHaveBeenCalledWith("/admin/account/profile", {
      nickname: "新昵称",
    });
  });

  it("uploads the current administrator avatar as form data", async () => {
    const result = { avatar: "https://cdn/avatar.png" };
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    vi.mocked(apiClient.put).mockResolvedValue({ data: result } as never);

    await expect(uploadAdminAvatar(file)).resolves.toBe(result);

    expect(apiClient.put).toHaveBeenCalledWith("/admin/account/avatar", expect.any(FormData));
    const body = vi.mocked(apiClient.put).mock.calls[0]?.[1] as FormData;

    expect(body.get("file")).toBe(file);
  });

  it("deletes the avatar and changes the password without returning a body", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ status: 204, data: "" } as never);
    vi.mocked(apiClient.put).mockResolvedValue({ status: 204, data: "" } as never);
    const request = { currentPassword: "current-password", newPassword: "new-password" };

    await expect(deleteAdminAvatar()).resolves.toBeUndefined();
    await expect(changeAdminPassword(request)).resolves.toBeUndefined();

    expect(apiClient.delete).toHaveBeenCalledWith("/admin/account/avatar");
    expect(apiClient.put).toHaveBeenCalledWith("/admin/account/password", request);
  });
});
