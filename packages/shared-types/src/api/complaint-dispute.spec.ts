import { describe, expect, it } from "vitest";
import {
  COMPLAINT_ACTION,
  COMPLAINT_STATUS,
  DECISION_LEVEL,
  DISPUTE_EXECUTION_TASK_TYPE,
  DISPUTE_EXECUTION_TASK_STATUS,
  type AdminComplaintListResponse,
  type ClaimComplaintRequest,
  type ComplaintDetail,
  type CreateComplaintRequest,
  type DisputeExecutionTaskDetailResponse,
  type DisputeExecutionTaskListResponse,
  type RetryDisputeExecutionTaskResponse,
  type SubmitComplaintStatementRequest,
  type TransferComplaintRequest,
} from "./complaint-dispute";

describe("complaint dispute contracts", () => {
  it("shares the superseded terminal execution status", () => {
    expect(DISPUTE_EXECUTION_TASK_STATUS.SUPERSEDED).toBe("superseded");
  });

  it("exposes every state required by the two-level decision workflow", () => {
    expect(Object.values(COMPLAINT_STATUS)).toEqual([
      "pending_response",
      "unassigned",
      "processing_initial",
      "initial_decided",
      "processing_final",
      "closed",
      "withdrawn",
    ]);
    expect(Object.values(DECISION_LEVEL)).toEqual(["initial", "final"]);
  });

  it("keeps admin pagination in the shared response shape", () => {
    const response: AdminComplaintListResponse = {
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    expect(Object.keys(response)).toEqual(["list", "total", "page", "pageSize"]);
  });

  it("shares execution task list, detail, and retry responses", () => {
    expect(Object.values(DISPUTE_EXECUTION_TASK_TYPE)).toEqual([
      "refund",
      "settlement",
      "complainant_credit",
      "respondent_credit",
    ]);

    const task = {
      id: "task-1",
      complaintId: "complaint-1",
      decisionLevel: DECISION_LEVEL.FINAL,
      taskType: "respondent_credit",
      status: DISPUTE_EXECUTION_TASK_STATUS.FAILED,
      failureReason: "temporary failure",
      retryCount: 2,
      nextRetryAt: "2026-08-04T12:02:00.000Z",
      completedAt: null,
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    } satisfies RetryDisputeExecutionTaskResponse;
    const detail: DisputeExecutionTaskDetailResponse = task;
    const response: DisputeExecutionTaskListResponse = {
      list: [detail],
      total: 1,
      page: 1,
      pageSize: 100,
    };

    expect(Object.keys(response)).toEqual(["list", "total", "page", "pageSize"]);
    expect(response.list[0]).toEqual(task);
  });

  it("defines server-controlled allowed actions", () => {
    expect(COMPLAINT_ACTION).toMatchObject({
      RESPOND: "respond",
      WITHDRAW: "withdraw",
      SECOND_APPEAL: "second_appeal",
      CLAIM: "claim",
      TRANSFER: "transfer",
      INITIAL_DECIDE: "initial_decide",
      FINAL_DECIDE: "final_decide",
      RETRY_EXECUTION: "retry_execution",
    });
  });

  it("shares every user command field required by the complaint workflow", () => {
    const createRequest: CreateComplaintRequest = {
      orderId: "order-1",
      complaintType: "service_quality",
      reason: "服务过程与约定不符",
      evidenceUrls: ["https://cdn.example/evidence.jpg"],
      expectedSolution: "申请部分退款",
    };
    const statementRequest: SubmitComplaintStatementRequest = {
      statement: "补充新的事实和证据",
      evidenceUrls: ["https://cdn.example/new-evidence.jpg"],
      version: 2,
    };

    expect(createRequest).toMatchObject({
      complaintType: "service_quality",
      expectedSolution: "申请部分退款",
    });
    expect(statementRequest.version).toBe(2);
  });

  it("shares every administrator assignment command field", () => {
    const claimRequest: ClaimComplaintRequest = {
      version: 2,
    };
    const transferRequest: TransferComplaintRequest = {
      targetAdminId: "admin-2",
      reason: "当前管理员需要回避该案件",
      version: 3,
    };

    expect(claimRequest).toEqual({ version: 2 });
    expect(transferRequest).toEqual({
      targetAdminId: "admin-2",
      reason: "当前管理员需要回避该案件",
      version: 3,
    });
  });

  it("shares the complete user complaint detail read model", () => {
    const detail = {
      complaintType: "service_quality",
      expectedSolution: "申请部分退款",
      statements: [
        {
          id: "statement-1",
          stage: "initial",
          authorId: "owner-1",
          statement: "服务过程与约定不符",
          evidenceUrls: [],
          createdAt: "2026-07-30T00:00:00.000Z",
        },
      ],
      events: [
        {
          id: "event-1",
          actorId: "owner-1",
          action: "create",
          fromStatus: null,
          toStatus: "pending_response",
          payload: null,
          createdAt: "2026-07-30T00:00:00.000Z",
        },
      ],
    } satisfies Pick<
      ComplaintDetail,
      "complaintType" | "expectedSolution" | "statements" | "events"
    >;

    expect(detail.statements[0]?.createdAt).toBe("2026-07-30T00:00:00.000Z");
    expect(detail.events[0]?.toStatus).toBe(COMPLAINT_STATUS.PENDING_RESPONSE);
  });
});
