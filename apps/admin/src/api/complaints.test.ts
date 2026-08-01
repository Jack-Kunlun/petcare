import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./auth";
import {
  claimAdminComplaint,
  fetchAdminComplaint,
  fetchAdminComplaints,
  fetchExecutionTasks,
  retryExecutionTask,
  submitFinalDecision,
  submitInitialDecision,
  transferAdminComplaint,
} from "./complaints";

vi.mock("./auth", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const decision = {
  liability: "respondent" as const,
  reason: "服务方未按约定完成服务，证据材料足以支持退款。",
  refundAmount: 8800,
  settlementAmount: 0,
  complainantCreditDelta: 0,
  respondentCreditDelta: -10,
  version: 3,
};

describe("admin complaint API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the admin complaint queue with shared filters", async () => {
    const page = { list: [], total: 0, page: 1, pageSize: 20 };

    vi.mocked(apiClient.get).mockResolvedValue({ data: page });

    await expect(
      fetchAdminComplaints({
        page: 1,
        pageSize: 20,
        queue: "unassigned",
        status: "unassigned",
      }),
    ).resolves.toEqual(page);

    expect(apiClient.get).toHaveBeenCalledWith("/admin/complaints", {
      params: { page: 1, pageSize: 20, queue: "unassigned", status: "unassigned" },
    });
  });

  it("gets a complaint detail and its execution tasks", async () => {
    const detail = { id: "complaint-1" };
    const tasks = { list: [], total: 0, page: 2, pageSize: 20 };

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: detail }).mockResolvedValueOnce({
      data: tasks,
    });

    await expect(fetchAdminComplaint("complaint-1")).resolves.toEqual(detail);
    await expect(fetchExecutionTasks("complaint-1", { page: 2, pageSize: 20 })).resolves.toEqual(
      tasks,
    );

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/admin/complaints/complaint-1");
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      "/admin/complaints/complaint-1/execution-tasks",
      {
        params: { page: 2, pageSize: 20 },
      },
    );
  });

  it("submits claim, transfer, and initial decision requests with their optimistic versions", async () => {
    const detail = { id: "complaint-1" };

    vi.mocked(apiClient.post).mockResolvedValue({ data: detail });

    await claimAdminComplaint("complaint-1", { version: 1 });
    await transferAdminComplaint("complaint-1", {
      targetAdminId: "admin-2",
      reason: "按案件专业方向转交。",
      version: 2,
    });
    await submitInitialDecision("complaint-1", decision);

    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/admin/complaints/complaint-1/claim", {
      version: 1,
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, "/admin/complaints/complaint-1/transfer", {
      targetAdminId: "admin-2",
      reason: "按案件专业方向转交。",
      version: 2,
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(
      3,
      "/admin/complaints/complaint-1/decisions/initial",
      decision,
    );
  });

  it("submits final decision and retries an execution task", async () => {
    const detail = { id: "complaint-1" };
    const task = { id: "task-1" };

    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: detail }).mockResolvedValueOnce({
      data: task,
    });

    await expect(submitFinalDecision("complaint-1", decision)).resolves.toEqual(detail);
    await expect(retryExecutionTask("complaint-1", "task-1")).resolves.toEqual(task);

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/admin/complaints/complaint-1/decisions/final",
      decision,
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/admin/complaints/complaint-1/execution-tasks/task-1/retry",
    );
  });
});
