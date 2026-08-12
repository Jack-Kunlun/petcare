import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSystemSettingsOverview } from "../../api/system-settings/overview";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import Settings from ".";

vi.mock("../../api/system-settings/overview", () => ({
  fetchSystemSettingsOverview: vi.fn(),
}));

const current = {
  id: "version-1",
  version: 1,
  status: "published" as const,
  changeSummary: "初始化配置",
  publishedBy: "系统管理员",
  publishedAt: "2026-08-01T08:00:00.000Z",
};

function renderSettings(
  permissions = [
    "system.view",
    "system.sop_config",
    "system.threshold_config",
    "system.fee_config",
  ],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const auth: AuthContextValue = {
    status: "authenticated",
    user: {
      id: "admin-1",
      username: "operator",
      phone: "13800138000",
      nickname: "运营主管",
      avatar: null,
      roles: ["operator"],
      permissions,
    },
    loginWithPassword: vi.fn(),
    loginWithSms: vi.fn(),
    getCaptcha: vi.fn(),
    sendSmsCode: vi.fn(),
    logout: vi.fn(),
    updateUserSummary: vi.fn(),
    invalidateLocalSession: vi.fn(),
  };

  render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe("Settings overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSystemSettingsOverview).mockResolvedValue({
      sop: {
        feeding: {
          current: { ...current, domain: "sop:feeding", config: { steps: [], violationRules: [] } },
          draft: null,
          pendingActions: [],
        },
        walking: {
          current: { ...current, domain: "sop:walking", config: { steps: [], violationRules: [] } },
          draft: {
            id: "draft-1",
            domain: "sop:walking",
            revision: 2,
            config: { steps: [], violationRules: [] },
            changeSummary: "更新遛宠流程",
            updatedBy: "运营主管",
            updatedAt: "2026-08-02T08:00:00.000Z",
          },
          pendingActions: ["存在待发布草稿"],
        },
        playing: {
          current: { ...current, domain: "sop:playing", config: { steps: [], violationRules: [] } },
          draft: null,
          pendingActions: [],
        },
      },
      ratingThreshold: {
        current: {
          ...current,
          domain: "rating_threshold",
          config: {
            evaluationWindow: 30,
            minimumSampleSize: 5,
            warningScore: 350,
            suspensionScore: 300,
            retrainingRequirement: "完成培训",
          },
        },
        draft: null,
        pendingActions: [],
      },
      fee: {
        current: {
          ...current,
          domain: "fee",
          config: {
            platformCommissionBps: 1000,
            rewardServiceFeeCents: 200,
            withdrawalFeeBps: 100,
            minimumWithdrawalFeeCents: 100,
          },
        },
        draft: null,
        pendingActions: [],
      },
    });
  });

  it("展示三个配置领域及草稿待办", async () => {
    renderSettings();

    expect(await screen.findByRole("heading", { name: "系统设置" })).toBeInTheDocument();
    expect(await screen.findByText("SOP 配置")).toBeInTheDocument();
    expect(screen.getByText("评分阈值")).toBeInTheDocument();
    expect(screen.getByText("费率设置")).toBeInTheDocument();
    expect(screen.getByText("有未发布草稿")).toBeInTheDocument();
  });

  it("加载、错误与空状态提供明确反馈和恢复操作", async () => {
    vi.mocked(fetchSystemSettingsOverview).mockRejectedValue(new Error("network"));
    renderSettings();

    expect(screen.getByLabelText("正在加载系统设置")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("系统设置加载失败");
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });

  it("没有任何版本时展示可理解的空状态", async () => {
    const empty = { current: null, draft: null, pendingActions: [] };

    vi.mocked(fetchSystemSettingsOverview).mockResolvedValue({
      sop: { feeding: empty, walking: empty, playing: empty },
      ratingThreshold: empty,
      fee: empty,
    });
    renderSettings();

    expect(await screen.findByRole("heading", { name: "暂无系统配置" })).toBeInTheDocument();
  });

  it("只有查看权限时不显示领域编辑入口", async () => {
    renderSettings(["system.view"]);

    await screen.findByText("SOP 配置");
    expect(screen.queryByRole("link", { name: /编辑配置/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("仅查看")).toHaveLength(3);
  });
});
