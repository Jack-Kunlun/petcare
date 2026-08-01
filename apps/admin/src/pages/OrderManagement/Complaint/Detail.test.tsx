import type { AdminComplaintDetail, DisputeExecutionTaskView } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimAdminComplaint,
  fetchAdminComplaint,
  fetchExecutionTasks,
  retryExecutionTask,
  submitFinalDecision,
  transferAdminComplaint,
} from "../../../api/complaints";
import ComplaintDetailPage from "./Detail";

vi.mock("../../../api/complaints", () => ({
  claimAdminComplaint: vi.fn(),
  fetchAdminComplaint: vi.fn(),
  fetchExecutionTasks: vi.fn(),
  retryExecutionTask: vi.fn(),
  submitFinalDecision: vi.fn(),
  submitInitialDecision: vi.fn(),
  transferAdminComplaint: vi.fn(),
}));

const detail: AdminComplaintDetail = {
  id: "complaint-1",
  caseNumber: "CP20260729001",
  orderId: "order-1",
  order: {
    id: "order-1",
    orderType: "reward",
    serviceType: "feeding",
    allocatableAmount: 10000,
    status: "completed",
    serviceTime: "2026-07-28T08:00:00.000Z",
  },
  complainantId: "owner-1",
  complainant: { id: "owner-1", nickname: "豆包家长", phone: "17600000001" },
  respondentId: "provider-1",
  respondent: { id: "provider-1", nickname: "安心宠护", phone: "17600000002" },
  complaintType: "service_quality",
  expectedSolution: "申请部分退款",
  status: "processing_final",
  reason: "服务过程与约定不符",
  evidenceUrls: ["https://cdn.example/initial.jpg"],
  respondentStatement: "实际服务已按约定完成",
  respondentEvidenceUrls: ["https://cdn.example/response.jpg"],
  handlerId: "admin-1",
  handler: { id: "admin-1", nickname: "值班管理员", phone: "17600000003" },
  initialDecision: {
    liability: "respondent",
    reason: "现有证据支持投诉方主张。",
    refundAmount: 3000,
    settlementAmount: 7000,
    complainantCreditDelta: 0,
    respondentCreditDelta: -5,
    version: 3,
  },
  finalDecision: null,
  statements: [
    {
      id: "s1",
      stage: "initial",
      authorId: "owner-1",
      statement: "服务过程与约定不符",
      evidenceUrls: ["https://cdn.example/initial.jpg"],
      createdAt: "2026-07-29T00:00:00.000Z",
    },
    {
      id: "s2",
      stage: "response",
      authorId: "provider-1",
      statement: "实际服务已按约定完成",
      evidenceUrls: [],
      createdAt: "2026-07-29T02:00:00.000Z",
    },
  ],
  events: [
    {
      id: "e1",
      actorId: "owner-1",
      action: "create",
      fromStatus: null,
      toStatus: "pending_response",
      payload: null,
      createdAt: "2026-07-29T00:00:00.000Z",
    },
  ],
  secondAppealDeadline: "2026-08-01T00:00:00.000Z",
  allowedActions: ["transfer", "final_decide", "retry_execution"],
  version: 3,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

const failedTask: DisputeExecutionTaskView = {
  id: "task-1",
  complaintId: "complaint-1",
  decisionLevel: "initial",
  taskType: "refund",
  status: "failed",
  failureReason: "暂时失败",
  retryCount: 1,
  nextRetryAt: null,
  completedAt: null,
  createdAt: detail.createdAt,
  updatedAt: detail.updatedAt,
};

function renderPage(value = detail) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");

  vi.mocked(fetchAdminComplaint).mockResolvedValue(value);
  render(
    <MemoryRouter initialEntries={["/orders/complaints/complaint-1"]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/orders/complaints/:id" element={<ComplaintDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );

  return { invalidate };
}

describe("ComplaintDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchExecutionTasks).mockResolvedValue({
      list: [failedTask],
      total: 1,
      page: 1,
      pageSize: 100,
    });
  });

  it("按顺序展示完整卷宗并且只显示服务端允许的操作", async () => {
    renderPage();
    await screen.findByText("CP20260729001");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);

    expect(headings.slice(0, 6)).toEqual([
      "订单信息",
      "双方当事人",
      "投诉内容",
      "陈述与证据",
      "裁决记录",
      "案件时间线",
    ]);
    expect(screen.getByRole("button", { name: "转派案件" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作出最终裁决" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "认领案件" })).not.toBeInTheDocument();
  });

  it("验证金额必须为非负整数且合计不超过订单可分配金额", async () => {
    const user = userEvent.setup();

    renderPage({ ...detail, allowedActions: ["initial_decide"] });
    await user.click(await screen.findByRole("button", { name: "作出初审裁决" }));
    fireEvent.change(screen.getByLabelText("裁决理由"), {
      target: { value: "已有证据能够支持本次初审裁决结果。" },
    });
    fireEvent.change(screen.getByLabelText("退款金额（分）"), { target: { value: "5000.5" } });
    await user.click(screen.getByRole("button", { name: "预览裁决影响" }));
    expect(screen.getByText("金额必须为非负整数分")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("退款金额（分）"), { target: { value: "6000" } });
    fireEvent.change(screen.getByLabelText("结算金额（分）"), { target: { value: "5000" } });
    await user.click(screen.getByRole("button", { name: "预览裁决影响" }));
    expect(screen.getByText("退款与结算合计不能超过订单可分配金额 10000 分")).toBeInTheDocument();
  });

  it("预览终审影响并经过二次确认提交", async () => {
    const user = userEvent.setup();

    vi.mocked(submitFinalDecision).mockResolvedValue(detail);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "作出最终裁决" }));
    await user.type(screen.getByLabelText("裁决理由"), "新增证据足以支持最终责任认定。");
    await user.type(screen.getByLabelText("退款金额（分）"), "5000");
    await user.type(screen.getByLabelText("结算金额（分）"), "5000");
    await user.type(screen.getByLabelText("投诉方信用分变化"), "2");
    await user.type(screen.getByLabelText("被投诉方信用分变化"), "-8");
    await user.click(screen.getByRole("button", { name: "预览裁决影响" }));
    expect(await screen.findByText("退款 ¥50.00")).toBeInTheDocument();
    expect(screen.getByText("结算 ¥50.00")).toBeInTheDocument();
    expect(screen.getByText("投诉方信用 +2")).toBeInTheDocument();
    expect(screen.getByText("被投诉方信用 -8")).toBeInTheDocument();
    expect(screen.getByText("最终裁决提交后不可再次申诉")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "提交最终裁决" }));
    expect(screen.getByRole("dialog", { name: "确认提交最终裁决" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认提交" }));
    expect(submitFinalDecision).toHaveBeenCalledWith(
      "complaint-1",
      expect.objectContaining({ refundAmount: 5000, version: 3 }),
    );
  }, 10_000);

  it("预览后修改字段会作废旧快照并提交重新预览的当前值", async () => {
    const user = userEvent.setup();

    vi.mocked(submitFinalDecision).mockResolvedValue(detail);
    renderPage({ ...detail, allowedActions: ["final_decide"] });
    await user.click(await screen.findByRole("button", { name: "作出最终裁决" }));
    await user.type(screen.getByLabelText("裁决理由"), "新增证据足以支持最终责任认定。");
    await user.type(screen.getByLabelText("退款金额（分）"), "5000");
    await user.type(screen.getByLabelText("结算金额（分）"), "5000");
    await user.click(screen.getByRole("button", { name: "预览裁决影响" }));
    expect(screen.getByRole("button", { name: "提交最终裁决" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("退款金额（分）"));
    await user.type(screen.getByLabelText("退款金额（分）"), "4000");
    expect(screen.queryByRole("button", { name: "提交最终裁决" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("裁决影响预览")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "预览裁决影响" }));
    await user.click(screen.getByRole("button", { name: "提交最终裁决" }));
    await user.click(screen.getByRole("button", { name: "确认提交" }));
    expect(submitFinalDecision).toHaveBeenCalledWith(
      "complaint-1",
      expect.objectContaining({ refundAmount: 4000, settlementAmount: 5000 }),
    );
  });

  it("裁决弹窗圈定焦点、分层响应 Escape 并在关闭后恢复触发按钮焦点", async () => {
    const user = userEvent.setup();

    renderPage({ ...detail, allowedActions: ["final_decide"] });
    const trigger = await screen.findByRole("button", { name: "作出最终裁决" });

    await user.click(trigger);
    expect(screen.getByLabelText("责任划分")).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "预览裁决影响" })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("责任划分")).toHaveFocus();

    await user.type(screen.getByLabelText("裁决理由"), "新增证据足以支持最终责任认定。");
    await user.click(screen.getByRole("button", { name: "预览裁决影响" }));
    await user.click(screen.getByRole("button", { name: "提交最终裁决" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "返回检查" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("heading", { name: "作出最终裁决" })).toBeInTheDocument();
    expect(screen.getByLabelText("责任划分")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("转派弹窗自动聚焦、圈定焦点并在 Escape 后恢复触发按钮焦点", async () => {
    const user = userEvent.setup();

    renderPage({ ...detail, allowedActions: ["transfer"] });
    const trigger = await screen.findByRole("button", { name: "转派案件" });

    await user.click(trigger);
    expect(screen.getByLabelText("目标管理员 ID")).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "确认转派" })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("目标管理员 ID")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("发生 409 时提示案件状态变化并刷新详情", async () => {
    const user = userEvent.setup();

    vi.mocked(claimAdminComplaint).mockRejectedValue(
      new axios.AxiosError("conflict", "409", undefined, undefined, { status: 409 } as never),
    );
    renderPage({ ...detail, allowedActions: ["claim"] });
    await user.click(await screen.findByRole("button", { name: "认领案件" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("案件状态已变化");
    await waitFor(() => expect(fetchAdminComplaint).toHaveBeenCalledTimes(2));
  });

  it("认领成功后刷新案件列表与详情", async () => {
    const user = userEvent.setup();

    vi.mocked(claimAdminComplaint).mockResolvedValue(detail);
    const { invalidate } = renderPage({ ...detail, allowedActions: ["claim"] });

    await user.click(await screen.findByRole("button", { name: "认领案件" }));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-complaints"] });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["admin-complaint", "complaint-1"],
      });
    });
  });

  it("转派成功后提交当前版本并刷新案件列表与详情", async () => {
    const user = userEvent.setup();

    vi.mocked(transferAdminComplaint).mockResolvedValue(detail);
    const { invalidate } = renderPage({ ...detail, allowedActions: ["transfer"] });

    await user.click(await screen.findByRole("button", { name: "转派案件" }));
    await user.type(screen.getByLabelText("目标管理员 ID"), "admin-2");
    await user.type(screen.getByLabelText("转派原因"), "按案件专业方向转派");
    await user.click(screen.getByRole("button", { name: "确认转派" }));

    expect(transferAdminComplaint).toHaveBeenCalledWith("complaint-1", {
      targetAdminId: "admin-2",
      reason: "按案件专业方向转派",
      version: 3,
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-complaints"] });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["admin-complaint", "complaint-1"],
      });
    });
  });

  it("仅失败的执行任务允许重试并在成功后刷新列表与详情", async () => {
    const user = userEvent.setup();

    vi.mocked(retryExecutionTask).mockResolvedValue({ ...failedTask, status: "pending" });
    const { invalidate } = renderPage();

    await user.click(await screen.findByRole("button", { name: "重试退款任务" }));
    expect(retryExecutionTask).toHaveBeenCalledWith("complaint-1", "task-1", { version: 3 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-complaints"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-complaint", "complaint-1"] });
  });
});
