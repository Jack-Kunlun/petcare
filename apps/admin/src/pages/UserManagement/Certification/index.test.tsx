import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminProviderCertifications } from "../../../api/provider-certifications";
import ProviderCertificationList from ".";

vi.mock("../../../api/provider-certifications", () => ({
  fetchAdminProviderCertifications: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={["/users/certifications"]}>
      <QueryClientProvider client={queryClient}>
        <ProviderCertificationList />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ProviderCertificationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminProviderCertifications).mockResolvedValue({
      list: [
        {
          id: "application-1",
          applicant: {
            id: "user-1",
            phone: "17679141878",
            username: "provider",
            nickname: "安心宠托",
            avatar: null,
          },
          realNameMasked: "张*",
          idCardVerified: true,
          trainingPassed: true,
          wechatScore: 680,
          status: "pending",
          createdAt: "2026-07-29T00:00:00.000Z",
          reviewedAt: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("loads pending applications by default", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "认证审核" })).toBeInTheDocument();
    expect(await screen.findByText("安心宠托")).toBeInTheDocument();
    expect(screen.getAllByText("待审核")).toHaveLength(2);
    expect(fetchAdminProviderCertifications).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      keyword: undefined,
      status: "pending",
    });
  });
});
