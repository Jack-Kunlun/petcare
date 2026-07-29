import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import {
  assertComplaintAction,
  getAllowedComplaintActions,
  type ComplaintActionContext,
} from "./complaint-state-machine";

const base = (overrides: Partial<ComplaintActionContext> = {}): ComplaintActionContext => ({
  status: "pending_response",
  viewerId: "viewer-1",
  viewerRole: "other",
  assignedAdminId: null,
  isSuperAdmin: false,
  isOrderParty: false,
  appealDeadlineAt: null,
  hasSecondAppealed: false,
  hasFailedExecution: false,
  now: new Date("2026-08-01T00:00:00.000Z"),
  ...overrides,
});

describe("getAllowedComplaintActions", () => {
  it("allows only the respondent to answer a pending complaint", () => {
    expect(
      getAllowedComplaintActions(base({ status: "pending_response", viewerRole: "respondent" })),
    ).toContain("respond");
    expect(
      getAllowedComplaintActions(base({ status: "pending_response", viewerRole: "complainant" })),
    ).toContain("withdraw");
  });

  it.each(["pending_response", "unassigned", "processing_initial"] as const)(
    "allows the complainant to withdraw before the initial decision in %s",
    (status) => {
      expect(getAllowedComplaintActions(base({ status, viewerRole: "complainant" }))).toContain(
        "withdraw",
      );
    },
  );

  it("opens second appeals until the exact deadline", () => {
    const deadline = new Date("2026-08-04T00:00:00.000Z");

    expect(
      getAllowedComplaintActions(
        base({
          status: "initial_decided",
          viewerRole: "complainant",
          now: new Date("2026-08-03T23:59:59.999Z"),
          appealDeadlineAt: deadline,
          hasSecondAppealed: false,
        }),
      ),
    ).toContain("second_appeal");
    expect(
      getAllowedComplaintActions(
        base({
          status: "initial_decided",
          viewerRole: "complainant",
          now: deadline,
          appealDeadlineAt: deadline,
          hasSecondAppealed: false,
        }),
      ),
    ).not.toContain("second_appeal");
  });

  it("never exposes an action after closure", () => {
    expect(getAllowedComplaintActions(base({ status: "closed" }))).toEqual([]);
  });

  it.each([
    ["pending_response", "complainant", ["withdraw"]],
    ["pending_response", "respondent", ["respond"]],
    ["pending_response", "admin", []],
    ["pending_response", "other", []],
    ["unassigned", "complainant", ["withdraw"]],
    ["unassigned", "respondent", []],
    ["unassigned", "admin", ["claim"]],
    ["unassigned", "other", []],
    ["processing_initial", "complainant", ["withdraw"]],
    ["processing_initial", "respondent", []],
    ["processing_initial", "admin", ["transfer", "initial_decide"]],
    ["processing_initial", "other", []],
    ["initial_decided", "complainant", ["second_appeal"]],
    ["initial_decided", "respondent", ["second_appeal"]],
    ["initial_decided", "admin", []],
    ["initial_decided", "other", []],
    ["processing_final", "complainant", []],
    ["processing_final", "respondent", []],
    ["processing_final", "admin", ["transfer", "final_decide"]],
    ["processing_final", "other", []],
    ["closed", "complainant", []],
    ["closed", "respondent", []],
    ["closed", "admin", []],
    ["closed", "other", []],
    ["withdrawn", "complainant", []],
    ["withdrawn", "respondent", []],
    ["withdrawn", "admin", []],
    ["withdrawn", "other", []],
  ] as const)("returns %j for %s viewed by %s", (status, viewerRole, expectedActions) => {
    expect(
      getAllowedComplaintActions(
        base({
          status,
          viewerRole,
          assignedAdminId:
            viewerRole === "admin" && ["processing_initial", "processing_final"].includes(status)
              ? "viewer-1"
              : null,
          appealDeadlineAt:
            status === "initial_decided" ? new Date("2026-08-02T00:00:00.000Z") : null,
        }),
      ),
    ).toEqual(expectedActions);
  });

  it("allows the assigned administrator and a super administrator to decide", () => {
    const assignedAdmin = base({
      status: "processing_initial",
      viewerRole: "admin",
      assignedAdminId: "viewer-1",
    });
    const superAdmin = base({
      status: "processing_final",
      viewerRole: "admin",
      assignedAdminId: "another-admin",
      isSuperAdmin: true,
    });

    expect(getAllowedComplaintActions(assignedAdmin)).toContain("initial_decide");
    expect(getAllowedComplaintActions(superAdmin)).toContain("final_decide");
  });

  it("blocks an unassigned administrator and any administrator who is an order party", () => {
    expect(
      getAllowedComplaintActions(
        base({ status: "processing_initial", viewerRole: "admin", assignedAdminId: null }),
      ),
    ).not.toContain("initial_decide");
    expect(
      getAllowedComplaintActions(
        base({
          status: "processing_final",
          viewerRole: "admin",
          assignedAdminId: "viewer-1",
          isSuperAdmin: true,
          isOrderParty: true,
        }),
      ),
    ).toEqual([]);
  });

  it("does not expose a duplicate respondent statement after the workflow advances", () => {
    expect(
      getAllowedComplaintActions(base({ status: "unassigned", viewerRole: "respondent" })),
    ).not.toContain("respond");
  });

  it.each(["complainant", "respondent"] as const)(
    "does not expose a duplicate second appeal for the %s",
    (viewerRole) => {
      expect(
        getAllowedComplaintActions(
          base({
            status: "initial_decided",
            viewerRole,
            appealDeadlineAt: new Date("2026-08-02T00:00:00.000Z"),
            hasSecondAppealed: true,
          }),
        ),
      ).not.toContain("second_appeal");
    },
  );

  it.each(["complainant", "respondent"] as const)(
    "keeps the original appeal window open for an eligible %s during final processing",
    (viewerRole) => {
      const deadline = new Date("2026-08-04T00:00:00.000Z");
      const otherParty = base({
        status: "processing_final",
        viewerRole,
        appealDeadlineAt: deadline,
        now: new Date("2026-08-03T23:59:59.999Z"),
        hasSecondAppealed: false,
      });

      expect(getAllowedComplaintActions(otherParty)).toContain("second_appeal");
      expect(getAllowedComplaintActions({ ...otherParty, hasSecondAppealed: true })).not.toContain(
        "second_appeal",
      );
      expect(getAllowedComplaintActions({ ...otherParty, now: deadline })).not.toContain(
        "second_appeal",
      );
      expect(
        getAllowedComplaintActions(
          base({
            status: "processing_final",
            viewerRole: "admin",
            assignedAdminId: "viewer-1",
            appealDeadlineAt: deadline,
          }),
        ),
      ).toContain("final_decide");
    },
  );

  it("allows only eligible administrators to retry failed execution", () => {
    expect(
      getAllowedComplaintActions(
        base({
          status: "closed",
          viewerRole: "admin",
          assignedAdminId: "viewer-1",
          hasFailedExecution: true,
        }),
      ),
    ).toEqual(["retry_execution"]);
    expect(
      getAllowedComplaintActions(
        base({
          status: "closed",
          viewerRole: "admin",
          assignedAdminId: "viewer-1",
          isOrderParty: true,
          hasFailedExecution: true,
        }),
      ),
    ).toEqual([]);
  });
});

describe("assertComplaintAction", () => {
  it("does not throw for an allowed action", () => {
    expect(() => {
      assertComplaintAction(base({ viewerRole: "respondent" }), "respond");
    }).not.toThrow();
  });

  it("throws the shared conflict exception for a disallowed action", () => {
    try {
      assertComplaintAction(base({ status: "closed" }), "respond");
      throw new Error("Expected assertComplaintAction to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({ code: "COMPLAINT_ACTION_NOT_ALLOWED" });
      expect((error as ApiException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });
});
