import type { WebsiteContentVersion } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as websiteApi from "../../api/website-content";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import WebsiteContentDetail from "./Detail";

vi.mock("../../api/website-content", async () => {
  const actual = await vi.importActual<typeof import("../../api/website-content")>(
    "../../api/website-content",
  );

  return {
    ...actual,
    fetchWebsiteContentDraft: vi.fn(),
    fetchWebsiteContentHistoryVersion: vi.fn(),
    restoreWebsiteContent: vi.fn(),
  };
});

const version: WebsiteContentVersion = {
  id: "version-1",
  contentKey: "home",
  revision: 3,
  businessVersion: 2,
  status: "superseded",
  changeSummary: "更新首页可信度文案",
  seo: { title: "PetCare 首页", description: "可信赖的宠物服务", canonicalPath: "/", image: null },
  sections: [],
  sourceVersionId: null,
  createdBy: { id: "admin-1", displayName: "运营管理员" },
  createdAt: "2026-08-12T00:00:00.000Z",
  publishedBy: { id: "admin-1", displayName: "运营管理员" },
  publishedAt: "2026-08-12T00:00:00.000Z",
};

const auth: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "operator",
    phone: "13800138000",
    nickname: "运营管理员",
    avatar: null,
    roles: ["operator"],
    permissions: ["website.view", "website.publish"],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
  updateUserSummary: vi.fn(),
  invalidateLocalSession: vi.fn(),
};

function renderDetail(
  permissions = auth.user?.permissions ?? [],
  initialEntry = "/website-content/home/history/version-1",
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const context: AuthContextValue = {
    ...auth,
    user: auth.user ? { ...auth.user, permissions } : null,
  };

  render(
    <AuthContext.Provider value={context}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/website-content/:contentKey/history/:versionId"
              element={<WebsiteContentDetail />}
            />
            <Route path="/website-content/:contentKey/edit" element={<h1>官网内容编辑</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe("WebsiteContentDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(websiteApi.fetchWebsiteContentHistoryVersion).mockResolvedValue(version);
    vi.mocked(websiteApi.fetchWebsiteContentDraft).mockResolvedValue({
      ...version,
      id: "draft-1",
      status: "draft",
      businessVersion: null,
      publishedBy: null,
      publishedAt: null,
      revision: 4,
    });
    vi.mocked(websiteApi.restoreWebsiteContent).mockResolvedValue({
      ...version,
      id: "draft-2",
      status: "draft",
      businessVersion: null,
      publishedBy: null,
      publishedAt: null,
      revision: 5,
    });
  });

  it("rejects historical commercial content keys before requesting history", () => {
    renderDetail(auth.user?.permissions, "/website-content/trust/history/version-1");

    expect(screen.getByRole("heading", { name: "历史版本路径无效" })).toBeInTheDocument();
    expect(websiteApi.fetchWebsiteContentHistoryVersion).not.toHaveBeenCalled();
    expect(websiteApi.fetchWebsiteContentDraft).not.toHaveBeenCalled();
  });

  it("uses the shared narrow layout and opens the same restore dialog from both actions", async () => {
    const user = userEvent.setup();

    renderDetail();

    expect(await screen.findByRole("heading", { name: "历史版本 v2" })).toBeInTheDocument();
    const page = document.querySelector("section.editor-page");

    expect(page).toHaveClass("max-w-[var(--editor-width-narrow)]");
    const header = within(page?.querySelector("header.editor-page__header") as HTMLElement);
    const content = within(page?.querySelector("div.editor-page__content") as HTMLElement);

    expect(header.getByRole("link", { name: "返回官网内容编辑" })).toBeInTheDocument();
    expect(header.getByText("历史版本")).toBeInTheDocument();
    expect(header.getByRole("button", { name: "顶部恢复为新草稿" })).toBeEnabled();
    expect(content.getByRole("button", { name: "恢复为新草稿" })).toBeEnabled();

    await user.click(header.getByRole("button", { name: "顶部恢复为新草稿" }));
    expect(screen.getByRole("dialog", { name: "确认创建恢复草稿" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.click(content.getByRole("button", { name: "恢复为新草稿" }));
    expect(screen.getByRole("dialog", { name: "确认创建恢复草稿" })).toBeInTheDocument();
  });

  it("keeps top and lower restore actions unavailable when the current draft cannot be read", async () => {
    vi.mocked(websiteApi.fetchWebsiteContentDraft).mockRejectedValue(new Error("network down"));

    renderDetail();

    await screen.findByRole("heading", { name: "历史版本 v2" });
    await screen.findByRole("alert");
    const page = document.querySelector("section.editor-page");
    const header = within(page?.querySelector("header.editor-page__header") as HTMLElement);
    const content = within(page?.querySelector("div.editor-page__content") as HTMLElement);

    expect(header.getByRole("button", { name: "顶部恢复为新草稿" })).toBeDisabled();
    expect(content.getByRole("button", { name: "恢复为新草稿" })).toBeDisabled();
  });

  it("does not render either restore action without website.publish", async () => {
    renderDetail([]);

    await screen.findByRole("heading", { name: "历史版本 v2" });

    expect(screen.queryByRole("button", { name: "顶部恢复为新草稿" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "恢复为新草稿" })).not.toBeInTheDocument();
    expect(screen.getByText("需要 website.publish 权限。")).toBeInTheDocument();
  });

  it("reads a historical version and restores it as a new draft", async () => {
    const user = userEvent.setup();

    renderDetail();
    expect(await screen.findByRole("heading", { name: "历史版本 v2" })).toBeInTheDocument();
    expect(screen.getByText("更新首页可信度文案")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "恢复为新草稿" }));
    await user.click(screen.getByRole("button", { name: "确认创建草稿" }));
    await waitFor(() =>
      expect(websiteApi.restoreWebsiteContent).toHaveBeenCalledWith("home", {
        versionId: "version-1",
        revision: 4,
        changeSummary: expect.any(String),
      }),
    );
    expect(await screen.findByRole("heading", { name: "官网内容编辑" })).toBeInTheDocument();
  });
});
