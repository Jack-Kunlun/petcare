import { describe, expect, it } from "vitest";
import {
  COMPLAINT_ACTION,
  COMPLAINT_STATUS,
  DECISION_LEVEL,
  type AdminComplaintListResponse,
} from "./complaint-dispute";

describe("complaint dispute contracts", () => {
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
});
