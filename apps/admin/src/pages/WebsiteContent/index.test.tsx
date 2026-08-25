import type { WebsiteContentOverviewResponse } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as websiteContentApi from "../../api/website-content";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import WebsiteContent from ".";

vi.mock("../../api/website-content", async () => {
  const actual = await vi.importActual<typeof import("../../api/website-content")>(
    "../../api/website-content",
  );

  return { ...actual, fetchWebsiteContentOverview: vi.fn() };
});

const contentKeys = [
  "site_shell",
  "home",
  "services",
  "trust",
  "companions",
  "about",
  "contact",
  "help",
  "privacy",
  "terms",
] as const;

const overview: WebsiteContentOverviewResponse = contentKeys.map((contentKey, index) => ({
  contentKey,
  draftRevision: index + 1,
  publishedBusinessVersion: index === 0 ? null : index,
  hasUnpublishedChanges: index === 1,
  lastEditedBy: { id: "admin-1", displayName: "运营主管" },
  lastEditedAt: "2026-08-13T00:00:00.000Z",
  publishedAt: index === 0 ? null : "2026-08-12T10:20:00.000Z",
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

function renderOverview(permissions = authenticated.user?.permissions ?? []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const context: AuthContextValue = {
    ...authenticated,
    user: authenticated.user ? { ...authenticated.user, permissions } : null,
  };

  render(
    <AuthContext.Provider value={context}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WebsiteContent />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe("WebsiteContent overview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders ten fixed content units with draft, publish, editor and unpublished-change state", async () => {
    vi.mocked(websiteContentApi.fetchWebsiteContentOverview).mockResolvedValue(overview);
    renderOverview();

    expect(await screen.findByRole("list", { name: "官网内容单元" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("草稿 r2")).toBeInTheDocument();
    expect(screen.getByText("已发布 v1")).toBeInTheDocument();
    expect(screen.getAllByText("运营主管")).toHaveLength(10);
    expect(screen.getAllByText("有未发布变更")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "编辑草稿" })).toHaveLength(10);
    expect(screen.getAllByRole("link", { name: "编辑草稿" })[0]).toHaveAttribute(
      "href",
      "/website-content/site_shell/edit",
    );
    expect(
      screen
        .getAllByRole("link", { name: "编辑草稿" })
        .some((link) => link.getAttribute("href") === "/website-content/help/edit"),
    ).toBe(true);
  });

  it("shows retryable loading failure without hiding the overview route", async () => {
    vi.mocked(websiteContentApi.fetchWebsiteContentOverview).mockRejectedValue(
      new Error("offline"),
    );
    renderOverview();

    expect(await screen.findByRole("alert")).toHaveTextContent("官网内容加载失败");
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });

  it("hides edit actions without the independent website.edit permission", async () => {
    vi.mocked(websiteContentApi.fetchWebsiteContentOverview).mockResolvedValue(overview);
    renderOverview(["website.view"]);

    await screen.findByRole("list", { name: "官网内容单元" });
    expect(screen.queryByRole("link", { name: "编辑草稿" })).toBeNull();
  });
});
