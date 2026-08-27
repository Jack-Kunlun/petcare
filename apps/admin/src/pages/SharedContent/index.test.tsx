import type { WebsiteContentOverviewResponse } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as websiteContentApi from "../../api/website-content";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import SharedContent from ".";

vi.mock("../../api/website-content", async () => {
  const actual = await vi.importActual<typeof import("../../api/website-content")>(
    "../../api/website-content",
  );

  return { ...actual, fetchWebsiteContentOverview: vi.fn() };
});

const contentKeys = ["site_shell", "home", "about", "contact", "help", "privacy", "terms"] as const;

const overview: WebsiteContentOverviewResponse = contentKeys.map((contentKey, index) => ({
  contentKey,
  draftRevision: index + 1,
  publishedBusinessVersion: index,
  hasUnpublishedChanges: false,
  lastEditedBy: { id: "admin-1", displayName: "运营主管" },
  lastEditedAt: "2026-08-13T00:00:00.000Z",
  publishedAt: "2026-08-12T10:20:00.000Z",
}));

const authenticated: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "operator",
    phone: "13800138000",
    nickname: "运营主管",
    avatar: null,
    roles: ["operator"],
    permissions: ["website.view", "website.edit"],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
  updateUserSummary: vi.fn(),
  invalidateLocalSession: vi.fn(),
};

function renderOverview() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <AuthContext.Provider value={authenticated}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SharedContent />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe("SharedContent overview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps shared support and legal configuration outside Website management", async () => {
    vi.mocked(websiteContentApi.fetchWebsiteContentOverview).mockResolvedValue(overview);
    renderOverview();

    expect(await screen.findByRole("list", { name: "公共内容单元" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "公共内容配置" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "联系客服" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "帮助中心" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "官网首页" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "编辑帮助中心草稿" })).toHaveAttribute(
      "href",
      "/shared-content/help/edit",
    );
  });
});
