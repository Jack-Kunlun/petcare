import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as feeApi from "../../api/system-settings/fee";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import SettingsDetail from "./Detail";

vi.mock("../../api/system-settings/fee");

const auth: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "operator",
    phone: "13800138000",
    nickname: "运营主管",
    avatar: null,
    roles: ["operator"],
    permissions: ["system.view", "system.fee_config", "system.publish"],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
  updateUserSummary: vi.fn(),
  invalidateLocalSession: vi.fn(),
};

function renderDetail(permissions = auth.user?.permissions ?? []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const context: AuthContextValue = {
    ...auth,
    user: auth.user ? { ...auth.user, permissions } : null,
  };

  render(
    <AuthContext.Provider value={context}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/settings/fee/history/fee-v1"]}>
          <Routes>
            <Route path="/settings/:domain/history/:versionId" element={<SettingsDetail />} />
            <Route path="/settings/:domain/edit" element={<h1>配置编辑器</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe("Settings history detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(feeApi.fetchFeeVersion).mockResolvedValue({
      id: "fee-v1",
      domain: "fee",
      version: 1,
      status: "superseded",
      config: {
        platformCommissionBps: 1000,
        rewardServiceFeeCents: 200,
        withdrawalFeeBps: 100,
        minimumWithdrawalFeeCents: 100,
      },
      changeSummary: "初始费率",
      publishedBy: "admin-1",
      publishedAt: "2026-08-01T00:00:00.000Z",
    });
    vi.mocked(feeApi.fetchFeeDraft).mockRejectedValue({ response: { status: 404 } });
    vi.mocked(feeApi.restoreFeeDraft).mockResolvedValue({
      id: "fee-draft",
      domain: "fee",
      revision: 1,
      config: {
        platformCommissionBps: 1000,
        rewardServiceFeeCents: 200,
        withdrawalFeeBps: 100,
        minimumWithdrawalFeeCents: 100,
      },
      changeSummary: "从历史版本 v1 复制",
      updatedBy: "admin-1",
      updatedAt: "2026-08-02T00:00:00.000Z",
    });
  });

  it("uses the shared narrow layout and opens the same copy dialog from both actions", async () => {
    const user = userEvent.setup();

    renderDetail();

    expect(await screen.findByRole("heading", { name: "费率设置 v1" })).toBeInTheDocument();
    const page = document.querySelector("section.editor-page");

    expect(page).toHaveClass("max-w-[var(--editor-width-narrow)]");
    const header = within(page?.querySelector("header.editor-page__header") as HTMLElement);
    const content = within(page?.querySelector("div.editor-page__content") as HTMLElement);

    expect(header.getByRole("link", { name: "返回配置编辑器" })).toBeInTheDocument();
    expect(header.getByText("历史版本")).toBeInTheDocument();
    expect(header.getByRole("button", { name: "顶部复制为新草稿" })).toBeEnabled();
    expect(content.getByRole("button", { name: "复制为新草稿" })).toBeEnabled();

    await user.click(header.getByRole("button", { name: "顶部复制为新草稿" }));
    expect(screen.getByRole("dialog", { name: "复制历史版本" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    await user.click(content.getByRole("button", { name: "复制为新草稿" }));
    expect(screen.getByRole("dialog", { name: "复制历史版本" })).toBeInTheDocument();
  });

  it("只读展示历史详情并经确认复制为新草稿", async () => {
    const user = userEvent.setup();

    renderDetail();

    expect(await screen.findByRole("heading", { name: "费率设置 v1" })).toBeInTheDocument();
    expect(feeApi.fetchFeeVersion).toHaveBeenCalledWith("fee-v1");
    expect(feeApi.fetchFeeHistory).not.toHaveBeenCalled();
    expect(screen.getByText("平台佣金")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "复制为新草稿" }));
    expect(screen.getByRole("dialog", { name: "复制历史版本" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认复制" }));

    await waitFor(() =>
      expect(feeApi.restoreFeeDraft).toHaveBeenCalledWith({
        version: 1,
        revision: 0,
        changeSummary: "从历史版本 v1 复制",
      }),
    );
    expect(await screen.findByRole("heading", { name: "配置编辑器" })).toBeInTheDocument();
  });

  it("草稿状态查询失败时禁止复制，并可重试后恢复操作", async () => {
    const user = userEvent.setup();

    vi.mocked(feeApi.fetchFeeDraft)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(null as never);

    renderDetail();

    expect(await screen.findByRole("heading", { name: "费率设置 v1" })).toBeInTheDocument();
    expect(screen.getByRole("alert", { name: "草稿状态加载失败" })).toBeInTheDocument();
    const page = document.querySelector("section.editor-page");
    const header = within(page?.querySelector("header.editor-page__header") as HTMLElement);

    expect(header.getByRole("button", { name: "顶部复制为新草稿" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "复制为新草稿" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "重新检查草稿状态" }));

    await waitFor(() =>
      expect(header.getByRole("button", { name: "顶部复制为新草稿" })).toBeEnabled(),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "复制为新草稿" })).toBeEnabled());
    expect(feeApi.fetchFeeDraft).toHaveBeenCalledTimes(2);
  });

  it("does not render the restore mutation control without both exact permissions", async () => {
    renderDetail(["system.view", "system.fee_config"]);

    await screen.findByRole("heading", { name: "费率设置 v1" });

    expect(screen.queryByRole("button", { name: "复制为新草稿" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "顶部复制为新草稿" })).not.toBeInTheDocument();
    expect(screen.getByText("需要领域编辑和 system.publish 权限。")).toBeInTheDocument();
  });
});
