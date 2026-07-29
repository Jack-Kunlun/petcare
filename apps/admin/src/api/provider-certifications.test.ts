import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./auth";
import {
  approveAdminProviderCertification,
  fetchAdminProviderCertification,
  fetchAdminProviderCertifications,
  rejectAdminProviderCertification,
} from "./provider-certifications";

vi.mock("./auth", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("provider certification API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests the filtered certification page", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { list: [], total: 0, page: 1, pageSize: 20 },
    });

    await fetchAdminProviderCertifications({
      page: 1,
      pageSize: 20,
      status: "pending",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/admin/provider-certifications", {
      params: { page: 1, pageSize: 20, status: "pending" },
    });
  });

  it("requests detail and review actions", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: "application-1" } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: "application-1" } });

    await fetchAdminProviderCertification("application-1");
    await approveAdminProviderCertification("application-1");
    await rejectAdminProviderCertification("application-1", { reason: "资料不清晰" });

    expect(apiClient.get).toHaveBeenCalledWith("/admin/provider-certifications/application-1");
    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/admin/provider-certifications/application-1/approve",
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/admin/provider-certifications/application-1/reject",
      { reason: "资料不清晰" },
    );
  });
});
