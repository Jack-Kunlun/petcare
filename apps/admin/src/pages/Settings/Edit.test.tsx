import {
  SYSTEM_CONFIG_ERROR_CODE,
  type FeeConfig,
  type RatingThresholdConfig,
  type SopConfig,
} from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ratingApi from "../../api/system-settings/rating-threshold";
import * as sopApi from "../../api/system-settings/sop";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import SettingsEdit from "./Edit";
import { FeeEditor } from "./FeeEditor";
import { RatingThresholdEditor } from "./RatingThresholdEditor";
import { SopEditor } from "./SopEditor";

vi.mock("../../api/system-settings/rating-threshold");
vi.mock("../../api/system-settings/sop");

const sop: SopConfig = {
  steps: Array.from({ length: 5 }, (_, index) => ({
    stepNumber: index + 1,
    stepName: `步骤 ${index + 1}`,
    instruction: `完成第 ${index + 1} 步并上传完整服务记录`,
    expectedDurationMinutes: 5,
    minimumPhotoCount: 1,
    videoRequired: false,
  })),
  violationRules: [
    {
      severity: "minor",
      description: "未按要求上传完整服务记录时由管理员复核处理",
      serviceFeeDeductionBps: 0,
      ratingDeductionScore: 0,
      suspensionDays: 0,
      retrainingRequired: false,
      sortOrder: 1,
    },
  ],
};

const rating: RatingThresholdConfig = {
  evaluationWindow: 30,
  minimumSampleSize: 5,
  warningScore: 350,
  suspensionScore: 300,
  retrainingRequirement: "完成平台再培训",
};

const fee: FeeConfig = {
  platformCommissionBps: 1000,
  rewardServiceFeeCents: 200,
  withdrawalFeeBps: 100,
  minimumWithdrawalFeeCents: 100,
};

const auth: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "operator",
    phone: "13800138000",
    nickname: "运营主管",
    roles: ["operator"],
    permissions: [
      "system.view",
      "system.sop_config",
      "system.threshold_config",
      "system.fee_config",
      "system.publish",
    ],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
};

function renderEdit(route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/settings/:domain/edit" element={<SettingsEdit />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );

  return queryClient;
}

function setupRatingDraft(config: RatingThresholdConfig = rating) {
  vi.mocked(ratingApi.fetchRatingThresholdCurrent).mockResolvedValue({
    id: "rating-v1",
    domain: "rating_threshold",
    version: 1,
    status: "published",
    config: rating,
    changeSummary: "初始化",
    publishedBy: "admin-1",
    publishedAt: "2026-08-01T00:00:00.000Z",
  });
  vi.mocked(ratingApi.fetchRatingThresholdDraft).mockResolvedValue({
    id: "rating-draft",
    domain: "rating_threshold",
    revision: 2,
    config,
    changeSummary: "调整评分规则",
    updatedBy: "admin-1",
    updatedAt: "2026-08-02T00:00:00.000Z",
  });
  vi.mocked(ratingApi.fetchRatingThresholdHistory).mockResolvedValue({
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
}

function setupSopDraft() {
  vi.mocked(sopApi.fetchSopCurrent).mockResolvedValue({
    id: "sop-feeding-v1",
    domain: "sop:feeding",
    version: 1,
    status: "published",
    config: sop,
    changeSummary: "初始化",
    publishedBy: "admin-1",
    publishedAt: "2026-08-01T00:00:00.000Z",
  });
  vi.mocked(sopApi.fetchSopDraft).mockResolvedValue({
    id: "sop-feeding-draft",
    domain: "sop:feeding",
    revision: 2,
    config: sop,
    changeSummary: "调整服务流程",
    updatedBy: "admin-1",
    updatedAt: "2026-08-02T00:00:00.000Z",
  });
  vi.mocked(sopApi.fetchSopHistory).mockResolvedValue({
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
}

describe("Settings domain editors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SOP 编辑器始终提供顺序固定的五个步骤", () => {
    render(<SopEditor initialValue={sop} onChange={vi.fn()} />);

    expect(screen.getAllByRole("group", { name: /第 \d 步/ })).toHaveLength(5);
    expect(
      within(screen.getByRole("group", { name: "第 1 步" })).getByLabelText(/步骤名称/),
    ).toHaveValue("步骤 1");
    expect(
      within(screen.getByRole("group", { name: "第 5 步" })).getByLabelText(/步骤名称/),
    ).toHaveValue("步骤 5");
  });

  it("SOP 名称、说明和数值错误在字段旁显示，摘要可用键盘聚焦首个错误控件", async () => {
    const user = userEvent.setup();

    setupSopDraft();
    renderEdit("/settings/sop/edit?serviceType=feeding");

    const firstStep = await screen.findByRole("group", { name: "第 1 步" });
    const stepName = within(firstStep).getByLabelText(/步骤名称/);
    const instruction = within(firstStep).getByLabelText(/执行说明/);
    const duration = within(firstStep).getByRole("spinbutton", { name: /预计时长/ });

    await user.clear(stepName);
    await user.clear(instruction);
    await user.clear(duration);

    const nameError = within(firstStep).getByText("第 1 步“步骤名称”至少 2 个字符");
    const instructionError = within(firstStep).getByText("第 1 步“执行说明”至少 10 个字符");
    const durationError = within(firstStep).getByText("第 1 步“预计时长”请输入 1 至 240 的整数");

    expect(stepName).toHaveAttribute("id", "settings-field-steps-0-stepName");
    expect(stepName).toHaveAttribute("aria-invalid", "true");
    expect(stepName).toHaveAttribute("aria-describedby", nameError.id);
    expect(instruction).toHaveAttribute("aria-describedby", instructionError.id);
    expect(duration).toHaveAttribute("aria-describedby", durationError.id);
    expect(duration.nextElementSibling).toBe(durationError);

    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    const summary = screen.getByRole("heading", { name: "请先修正表单问题" }).parentElement!;
    const firstErrorButton = within(summary).getByRole("button", {
      name: "第 1 步“步骤名称”至少 2 个字符",
    });

    await waitFor(() => expect(summary).toHaveFocus());
    await user.tab();
    expect(firstErrorButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(stepName).toHaveFocus();
    expect(sopApi.saveSopDraft).not.toHaveBeenCalled();
  });

  it("评分编辑器展示星级并只输出整数契约", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<RatingThresholdEditor initialValue={rating} onChange={onChange} />);

    const warning = screen.getByRole("spinbutton", { name: "预警评分" });

    expect(warning).toHaveValue(3.5);
    await user.clear(warning);
    await user.type(warning, "3.75");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ warningScore: 375 }),
      expect.objectContaining({}),
    );

    await user.clear(warning);
    await user.type(warning, "3.756");
    await user.tab();

    const warningError = screen.getByText("最多保留两位小数");

    expect(warning).toHaveAttribute("aria-describedby", warningError.id);
  });

  it("费率编辑器阻止超过两位小数并在字段旁展示错误", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<FeeEditor initialValue={fee} onChange={onChange} />);

    const commission = screen.getByRole("spinbutton", { name: "平台佣金" });

    expect(commission).toHaveValue(10);
    await user.clear(commission);
    await user.type(commission, "10.555");
    await user.tab();

    const commissionError = screen.getByText("最多保留两位小数");

    expect(commission).toHaveAttribute("aria-describedby", commissionError.id);
    expect(onChange).toHaveBeenLastCalledWith(null, {
      platformCommissionBps: "最多保留两位小数",
    });
  });

  it("SOP 服务类型切换会加载对应配置并保持五步结构", async () => {
    const user = userEvent.setup();

    vi.mocked(sopApi.fetchSopCurrent).mockImplementation(async (serviceType) => ({
      id: `${serviceType}-v1`,
      domain: `sop:${serviceType}`,
      version: 1,
      status: "published",
      config: {
        ...sop,
        steps: sop.steps.map((step) => ({ ...step, stepName: `${serviceType}-${step.stepName}` })),
      },
      changeSummary: "初始化",
      publishedBy: "admin-1",
      publishedAt: "2026-08-01T00:00:00.000Z",
    }));
    vi.mocked(sopApi.fetchSopDraft).mockRejectedValue({ response: { status: 404 } });
    vi.mocked(sopApi.fetchSopHistory).mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    renderEdit("/settings/sop/edit?serviceType=feeding");

    expect(await screen.findByDisplayValue("feeding-步骤 1")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "遛宠" }));
    expect(await screen.findByDisplayValue("walking-步骤 1")).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /第 \d 步/ })).toHaveLength(5);
    await waitFor(() => expect(sopApi.fetchSopCurrent).toHaveBeenCalledWith("walking"));
  });

  it("最近发布历史加载失败时独立提示并可重试，不阻断配置编辑", async () => {
    const user = userEvent.setup();

    setupRatingDraft();
    vi.mocked(ratingApi.fetchRatingThresholdHistory)
      .mockRejectedValueOnce(new Error("history unavailable"))
      .mockResolvedValueOnce({
        list: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

    renderEdit("/settings/rating_threshold/edit");

    expect(await screen.findByRole("spinbutton", { name: "预警评分" })).toBeEnabled();
    expect(await screen.findByRole("alert", { name: "最近发布历史加载失败" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新加载发布历史" }));

    expect(await screen.findByText("暂无已发布版本。")).toBeInTheDocument();
    expect(ratingApi.fetchRatingThresholdHistory).toHaveBeenCalledTimes(2);
  });

  it("当前版本与草稿同时失败时仍展示发布历史错误并允许独立重试", async () => {
    const user = userEvent.setup();

    setupRatingDraft();
    vi.mocked(ratingApi.fetchRatingThresholdCurrent).mockRejectedValue(
      new Error("current unavailable"),
    );
    vi.mocked(ratingApi.fetchRatingThresholdDraft).mockRejectedValue(
      new Error("draft unavailable"),
    );
    vi.mocked(ratingApi.fetchRatingThresholdHistory)
      .mockRejectedValueOnce(new Error("history unavailable"))
      .mockResolvedValueOnce({
        list: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

    renderEdit("/settings/rating_threshold/edit");

    expect(await screen.findByRole("alert", { name: "当前生效版本加载失败" })).toBeInTheDocument();
    expect(await screen.findByRole("alert", { name: "草稿状态加载失败" })).toBeInTheDocument();
    expect(await screen.findByRole("alert", { name: "最近发布历史加载失败" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新加载发布历史" }));

    expect(await screen.findByText("暂无已发布版本。")).toBeInTheDocument();
    expect(ratingApi.fetchRatingThresholdHistory).toHaveBeenCalledTimes(2);
  });

  it("当前版本加载失败时独立提示并重试，不遮蔽已加载草稿", async () => {
    const user = userEvent.setup();

    setupRatingDraft();
    vi.mocked(ratingApi.fetchRatingThresholdCurrent)
      .mockRejectedValueOnce(new Error("current unavailable"))
      .mockResolvedValueOnce({
        id: "rating-v1",
        domain: "rating_threshold",
        version: 1,
        status: "published",
        config: rating,
        changeSummary: "初始化",
        publishedBy: "admin-1",
        publishedAt: "2026-08-01T00:00:00.000Z",
      });

    renderEdit("/settings/rating_threshold/edit");

    expect(await screen.findByRole("spinbutton", { name: "预警评分" })).toBeEnabled();
    expect(await screen.findByRole("alert", { name: "当前生效版本加载失败" })).toBeInTheDocument();
    expect(screen.queryByRole("alert", { name: "草稿状态加载失败" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新加载当前版本" }));

    await waitFor(() => expect(ratingApi.fetchRatingThresholdCurrent).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("alert", { name: "当前生效版本加载失败" })).not.toBeInTheDocument(),
    );
  });

  it("草稿重试成功后以真实草稿替换当前版本，并按草稿配置和 revision 保存", async () => {
    const user = userEvent.setup();
    const draftConfig = { ...rating, warningScore: 375 };

    setupRatingDraft();
    vi.mocked(ratingApi.fetchRatingThresholdDraft)
      .mockRejectedValueOnce(new Error("draft unavailable"))
      .mockResolvedValueOnce({
        id: "rating-draft",
        domain: "rating_threshold",
        revision: 7,
        config: draftConfig,
        changeSummary: "采用草稿评分规则",
        updatedBy: "admin-1",
        updatedAt: "2026-08-02T00:00:00.000Z",
      });
    vi.mocked(ratingApi.saveRatingThresholdDraft).mockResolvedValue({
      id: "rating-draft",
      domain: "rating_threshold",
      revision: 8,
      config: draftConfig,
      changeSummary: "采用草稿评分规则",
      updatedBy: "admin-1",
      updatedAt: "2026-08-02T01:00:00.000Z",
    });

    renderEdit("/settings/rating_threshold/edit");

    expect(await screen.findByRole("spinbutton", { name: "预警评分" })).toHaveValue(3.5);
    expect(await screen.findByRole("alert", { name: "草稿状态加载失败" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存草稿" })).toBeDisabled();
    expect(screen.queryByRole("alert", { name: "当前生效版本加载失败" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新加载草稿状态" }));

    await waitFor(() => expect(ratingApi.fetchRatingThresholdDraft).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("spinbutton", { name: "预警评分" })).toHaveValue(3.75),
    );
    expect(screen.getByLabelText(/变更摘要/)).toHaveValue("采用草稿评分规则");
    await waitFor(() => expect(screen.getByRole("button", { name: "保存草稿" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(ratingApi.saveRatingThresholdDraft).toHaveBeenCalledWith({
        revision: 7,
        config: draftConfig,
        changeSummary: "采用草稿评分规则",
      }),
    );
    expect(ratingApi.fetchRatingThresholdCurrent).toHaveBeenCalledTimes(1);
  });

  it.each(["current-first", "draft-first"] as const)(
    "并发查询按 %s 返回时始终以草稿作为编辑源",
    async (returnOrder) => {
      const draftConfig = { ...rating, warningScore: 375 };
      let resolveCurrent!: (
        value: Awaited<ReturnType<typeof ratingApi.fetchRatingThresholdCurrent>>,
      ) => void;
      let resolveDraft!: (
        value: Awaited<ReturnType<typeof ratingApi.fetchRatingThresholdDraft>>,
      ) => void;
      const currentPromise = new Promise<
        Awaited<ReturnType<typeof ratingApi.fetchRatingThresholdCurrent>>
      >((resolve) => {
        resolveCurrent = resolve;
      });
      const draftPromise = new Promise<
        Awaited<ReturnType<typeof ratingApi.fetchRatingThresholdDraft>>
      >((resolve) => {
        resolveDraft = resolve;
      });

      vi.mocked(ratingApi.fetchRatingThresholdCurrent).mockReturnValue(currentPromise);
      vi.mocked(ratingApi.fetchRatingThresholdDraft).mockReturnValue(draftPromise);
      vi.mocked(ratingApi.fetchRatingThresholdHistory).mockResolvedValue({
        list: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      renderEdit("/settings/rating_threshold/edit");
      const current = {
        id: "rating-v1",
        domain: "rating_threshold" as const,
        version: 1,
        status: "published" as const,
        config: rating,
        changeSummary: "当前版本摘要",
        publishedBy: "admin-1",
        publishedAt: "2026-08-01T00:00:00.000Z",
      };
      const draft = {
        id: "rating-draft",
        domain: "rating_threshold" as const,
        revision: 7,
        config: draftConfig,
        changeSummary: "草稿摘要",
        updatedBy: "admin-1",
        updatedAt: "2026-08-02T00:00:00.000Z",
      };

      if (returnOrder === "current-first") {
        await act(async () => resolveCurrent(current));
        await act(async () => resolveDraft(draft));
      } else {
        await act(async () => resolveDraft(draft));
        await act(async () => resolveCurrent(current));
      }

      expect(await screen.findByRole("spinbutton", { name: "预警评分" })).toHaveValue(3.75);
      expect(screen.getByLabelText(/变更摘要/)).toHaveValue("草稿摘要");
      expect(screen.getByText(/当前草稿修订版：/)).toHaveTextContent("7");
    },
  );

  it("保存草稿时提交当前 revision 并展示服务端新 revision", async () => {
    const user = userEvent.setup();

    setupRatingDraft();
    vi.mocked(ratingApi.saveRatingThresholdDraft).mockResolvedValue({
      id: "rating-draft",
      domain: "rating_threshold",
      revision: 3,
      config: rating,
      changeSummary: "调整评分规则",
      updatedBy: "admin-1",
      updatedAt: "2026-08-02T01:00:00.000Z",
    });

    renderEdit("/settings/rating_threshold/edit");
    await screen.findByRole("heading", { name: "编辑评分阈值" });
    await screen.findByRole("spinbutton", { name: "预警评分" });
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(ratingApi.saveRatingThresholdDraft).toHaveBeenCalledWith({
        revision: 2,
        config: rating,
        changeSummary: "调整评分规则",
      }),
    );
    expect(await screen.findByText("草稿已保存，当前修订版为 3。")).toBeInTheDocument();
  });

  it("字段差异经二次确认发布，提交期间禁用并失效所有设置查询", async () => {
    const user = userEvent.setup();

    setupRatingDraft();
    vi.mocked(ratingApi.fetchRatingThresholdDiff).mockResolvedValue([
      { path: "warningScore", label: "预警评分", before: 350, after: 375, changeType: "modified" },
    ]);
    let resolvePublish!: (
      value: Awaited<ReturnType<typeof ratingApi.publishRatingThresholdDraft>>,
    ) => void;

    vi.mocked(ratingApi.publishRatingThresholdDraft).mockReturnValue(
      new Promise((resolve) => {
        resolvePublish = resolve;
      }),
    );
    const queryClient = renderEdit("/settings/rating_threshold/edit");
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await screen.findByRole("spinbutton", { name: "预警评分" });
    await user.click(screen.getByRole("button", { name: "检查并发布" }));
    await screen.findByRole("button", { name: "继续发布" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "检查并发布" }));
    await user.click(await screen.findByRole("button", { name: "继续发布" }));
    await user.click(screen.getByRole("button", { name: "确认发布" }));

    const pendingButton = screen.getByRole("button", { name: "正在发布…" });

    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(ratingApi.publishRatingThresholdDraft).toHaveBeenCalledOnce();

    resolvePublish({
      id: "rating-v2",
      domain: "rating_threshold",
      version: 2,
      status: "published",
      config: rating,
      changeSummary: "调整评分规则",
      publishedBy: "admin-1",
      publishedAt: "2026-08-02T02:00:00.000Z",
    });
    expect(await screen.findByText("版本 v2 已发布。")).toBeInTheDocument();
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["system-settings", "overview"] });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["system-settings", "rating_threshold", "feeding", "current"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["system-settings", "rating_threshold", "feeding", "draft"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["system-settings", "rating_threshold", "feeding", "history"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["system-settings", "rating_threshold", "feeding", "diff"],
      });
    });
  });

  it("字段差异加载失败时显示错误并可重试，成功前不能继续发布", async () => {
    const user = userEvent.setup();

    setupRatingDraft();
    vi.mocked(ratingApi.fetchRatingThresholdDiff)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([
        {
          path: "warningScore",
          label: "预警评分",
          before: 350,
          after: 375,
          changeType: "modified",
        },
      ]);

    renderEdit("/settings/rating_threshold/edit");
    await screen.findByRole("spinbutton", { name: "预警评分" });
    await user.click(screen.getByRole("button", { name: "检查并发布" }));

    expect(await screen.findByRole("alert", { name: "字段差异加载失败" })).toBeInTheDocument();
    expect(screen.queryByText("没有字段差异。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续发布" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "重新加载字段差异" }));

    expect(await within(screen.getByRole("dialog")).findByText("预警评分")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续发布" })).toBeEnabled();
    expect(ratingApi.fetchRatingThresholdDiff).toHaveBeenCalledTimes(2);
  });

  it("409 会关闭陈旧确认、保留本地输入并刷新服务端 revision", async () => {
    const user = userEvent.setup();

    setupRatingDraft();
    const serverDraft = {
      id: "rating-draft",
      domain: "rating_threshold" as const,
      revision: 4,
      config: { ...rating, warningScore: 360 },
      changeSummary: "其他管理员更新",
      updatedBy: "admin-2",
      updatedAt: "2026-08-02T03:00:00.000Z",
    };

    vi.mocked(ratingApi.fetchRatingThresholdDraft)
      .mockResolvedValueOnce({
        id: "rating-draft",
        domain: "rating_threshold",
        revision: 2,
        config: rating,
        changeSummary: "调整评分规则",
        updatedBy: "admin-1",
        updatedAt: "2026-08-02T00:00:00.000Z",
      })
      .mockResolvedValue(serverDraft);
    vi.mocked(ratingApi.saveRatingThresholdDraft)
      .mockResolvedValueOnce({
        ...serverDraft,
        revision: 3,
        config: { ...rating, warningScore: 375 },
        changeSummary: "调整评分规则",
      })
      .mockResolvedValueOnce({
        ...serverDraft,
        revision: 5,
        config: { ...rating, warningScore: 375 },
        changeSummary: "协调并重新保存评分规则",
      });
    vi.mocked(ratingApi.fetchRatingThresholdDiff).mockResolvedValue([
      { path: "warningScore", label: "预警评分", before: 350, after: 375, changeType: "modified" },
    ]);
    const conflict = new axios.AxiosError("conflict", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 409,
      data: {
        code: SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT,
        message: "版本冲突",
        data: null,
        meta: {},
      },
    } as never);

    vi.mocked(ratingApi.publishRatingThresholdDraft).mockRejectedValue(conflict);

    renderEdit("/settings/rating_threshold/edit");
    const warning = await screen.findByRole("spinbutton", { name: "预警评分" });

    await user.clear(warning);
    await user.type(warning, "3.75");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));
    await screen.findByText("草稿已保存，当前修订版为 3。");
    await user.click(screen.getByRole("button", { name: "检查并发布" }));
    await user.click(await screen.findByRole("button", { name: "继续发布" }));
    await user.click(screen.getByRole("button", { name: "确认发布" }));

    expect(await screen.findByText("检测到版本冲突")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "最终发布确认" })).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "预警评分" })).toHaveValue(3.75);
    expect(screen.getByText("服务端当前修订版：4")).toBeInTheDocument();
    expect(screen.getByText(/有未保存变更/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "检查并发布" })).toBeDisabled();

    await user.clear(screen.getByLabelText(/变更摘要/));
    await user.type(screen.getByLabelText(/变更摘要/), "协调并重新保存评分规则");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(ratingApi.saveRatingThresholdDraft).toHaveBeenLastCalledWith({
        revision: 4,
        config: { ...rating, warningScore: 375 },
        changeSummary: "协调并重新保存评分规则",
      }),
    );
    expect(await screen.findByText("草稿已保存，当前修订版为 5。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "检查并发布" })).toBeEnabled();
  });

  it("提交字段错误时聚焦错误摘要且不发送保存请求", async () => {
    const user = userEvent.setup();

    setupRatingDraft();
    renderEdit("/settings/rating_threshold/edit");

    const warning = await screen.findByRole("spinbutton", { name: "预警评分" });

    await user.clear(warning);
    await user.type(warning, "3.756");
    await user.tab();
    expect(screen.getByText("最多保留两位小数")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    const summary = screen.getByRole("heading", { name: "请先修正表单问题" }).parentElement;

    await waitFor(() => expect(summary).toHaveFocus());
    expect(ratingApi.saveRatingThresholdDraft).not.toHaveBeenCalled();
  });
});
