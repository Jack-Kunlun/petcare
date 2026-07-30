import { HttpStatus, RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { COMPLAINT_STATUS } from "@petcare/shared-types";
import { validate } from "class-validator";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { DisputeResolverGuard } from "../../auth/dispute-resolver.guard";
import { AdminComplaintController } from "./admin-complaint.controller";
import { ComplaintCommandService } from "./complaint-command.service";
import { ComplaintQueryService } from "./complaint-query.service";
import { DisputeDecisionService } from "./dispute-decision.service";
import { AdminComplaintListQueryDto } from "./dto/admin-complaint-list-query.dto";
import { SubmitDisputeDecisionDto } from "./dto/submit-dispute-decision.dto";
import { ClaimComplaintDto, TransferComplaintDto } from "./dto/transfer-complaint.dto";

describe("AdminComplaintController", () => {
  const commandService = {
    claim: jest.fn(),
    transfer: jest.fn(),
  };
  const queryService = {
    findAdminPage: jest.fn(),
    findForAdmin: jest.fn(),
  };
  const decisionService = {
    decideInitial: jest.fn(),
    decideFinal: jest.fn(),
  };
  const controller = new AdminComplaintController(
    commandService as unknown as ComplaintCommandService,
    queryService as unknown as ComplaintQueryService,
    decisionService as unknown as DisputeDecisionService,
  );
  const request = {
    user: {
      sub: "admin-1",
      roles: ["complaint_admin"],
    },
  } as Parameters<AdminComplaintController["findOne"]>[1];
  const detail = { id: "complaint-1" };

  beforeEach(() => {
    jest.resetAllMocks();
    commandService.claim.mockResolvedValue("complaint-1");
    commandService.transfer.mockResolvedValue("complaint-1");
    decisionService.decideInitial.mockResolvedValue("complaint-1");
    decisionService.decideFinal.mockResolvedValue("complaint-1");
    queryService.findAdminPage.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 });
    queryService.findForAdmin.mockResolvedValue(detail);
  });

  it("uses the fixed admin API route and both authentication guards", () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminComplaintController)).toBe("admin/complaints");
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminComplaintController) as unknown[];

    expect(guards).toEqual(expect.arrayContaining([AccessTokenGuard, DisputeResolverGuard]));
  });

  it("passes administrator filters and identity to list and detail reads", async () => {
    const query = {
      page: 1,
      pageSize: 20,
      status: COMPLAINT_STATUS.UNASSIGNED,
    } as AdminComplaintListQueryDto;

    await expect(controller.findAll(query)).resolves.toEqual({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    await expect(controller.findOne("complaint-1", request)).resolves.toBe(detail);

    expect(queryService.findAdminPage).toHaveBeenCalledWith(query);
    expect(queryService.findForAdmin).toHaveBeenCalledWith("complaint-1", {
      id: "admin-1",
      roles: ["complaint_admin"],
    });
  });

  it("forwards claim and transfer commands without trusting a super-admin request field", async () => {
    const claimDto = { version: 2 } as ClaimComplaintDto;
    const transferDto = {
      targetAdminId: "admin-2",
      reason: "转交给当班管理员继续处理",
      version: 3,
    } as TransferComplaintDto;

    await expect(controller.claim("complaint-1", request, claimDto)).resolves.toBe(detail);
    await expect(controller.transfer("complaint-1", request, transferDto)).resolves.toBe(detail);

    expect(commandService.claim).toHaveBeenCalledWith(
      "complaint-1",
      { id: "admin-1", roles: ["complaint_admin"] },
      2,
    );
    expect(commandService.transfer).toHaveBeenCalledWith(
      "complaint-1",
      { id: "admin-1", roles: ["complaint_admin"] },
      "admin-2",
      "转交给当班管理员继续处理",
      3,
    );
  });

  it("forwards both decision levels through the shared administrator actor", async () => {
    const dto = {
      liability: "respondent",
      reason: "现有证据能够证明服务未按订单约定完成",
      refundAmount: 1000,
      settlementAmount: 2000,
      complainantCreditDelta: 0,
      respondentCreditDelta: -5,
      version: 3,
    } as SubmitDisputeDecisionDto;

    await expect(controller.decideInitial("complaint-1", request, dto)).resolves.toBe(detail);
    await expect(controller.decideFinal("complaint-1", request, dto)).resolves.toBe(detail);

    expect(decisionService.decideInitial).toHaveBeenCalledWith(
      "complaint-1",
      { id: "admin-1", roles: ["complaint_admin"] },
      dto,
    );
    expect(decisionService.decideFinal).toHaveBeenCalledWith(
      "complaint-1",
      { id: "admin-1", roles: ["complaint_admin"] },
      dto,
    );
  });

  it.each(["claim", "transfer", "decideInitial", "decideFinal"] as const)(
    "uses HTTP 200 for %s",
    (methodName) => {
      const handler = AdminComplaintController.prototype[methodName];

      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(HttpStatus.OK);
    },
  );

  it("validates assignment and decision request fields at the HTTP boundary", async () => {
    const transferErrors = await validate(
      Object.assign(new TransferComplaintDto(), {
        targetAdminId: "not-a-uuid",
        reason: "x",
        version: 0,
      }),
    );
    const decisionErrors = await validate(
      Object.assign(new SubmitDisputeDecisionDto(), {
        liability: "respondent",
        reason: "too short",
        refundAmount: 1.5,
        settlementAmount: 0,
        complainantCreditDelta: -101,
        respondentCreditDelta: 101,
        version: 0,
      }),
    );

    expect(transferErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["targetAdminId", "reason", "version"]),
    );
    expect(decisionErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        "reason",
        "refundAmount",
        "complainantCreditDelta",
        "respondentCreditDelta",
        "version",
      ]),
    );
  });
});
