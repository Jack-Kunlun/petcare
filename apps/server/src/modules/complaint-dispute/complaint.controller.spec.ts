import { HttpStatus, RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { ComplaintCommandService } from "./complaint-command.service";
import { ComplaintQueryService } from "./complaint-query.service";
import { ComplaintController } from "./complaint.controller";
import type { CreateComplaintDto } from "./dto/create-complaint.dto";
import type {
  RespondComplaintDto,
  SubmitComplaintStatementDto,
  WithdrawComplaintDto,
} from "./dto/submit-complaint-statement.dto";

describe("ComplaintController", () => {
  const commandService = {
    createComplaint: jest.fn(),
    respond: jest.fn(),
    submitSecondAppeal: jest.fn(),
    withdraw: jest.fn(),
  };
  const queryService = {
    findMine: jest.fn(),
    findForUser: jest.fn(),
  };
  const controller = new ComplaintController(
    commandService as unknown as ComplaintCommandService,
    queryService as unknown as ComplaintQueryService,
  );
  const request = {
    user: {
      sub: "user-1",
    },
  } as Parameters<ComplaintController["create"]>[0];
  const detail = { id: "complaint-1" };

  beforeEach(() => {
    jest.resetAllMocks();
    commandService.createComplaint.mockResolvedValue("complaint-1");
    commandService.respond.mockResolvedValue("complaint-1");
    commandService.submitSecondAppeal.mockResolvedValue("complaint-1");
    commandService.withdraw.mockResolvedValue("complaint-1");
    queryService.findMine.mockResolvedValue({ list: [], total: 0, page: 2, pageSize: 10 });
    queryService.findForUser.mockResolvedValue(detail);
  });

  it("uses the access-token guard for every complaint endpoint", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ComplaintController) as unknown[];

    expect(guards).toContain(AccessTokenGuard);
  });

  it("passes the authenticated actor and DTO when creating a complaint", async () => {
    const dto = {
      orderId: "11111111-1111-4111-8111-111111111111",
      complaintType: "service_quality",
      reason: "服务过程与约定不符",
      evidenceUrls: [],
      expectedSolution: "申请部分退款",
    } as CreateComplaintDto;

    await expect(controller.create(request, dto)).resolves.toBe(detail);
    expect(commandService.createComplaint).toHaveBeenCalledWith("user-1", dto);
    expect(queryService.findForUser).toHaveBeenCalledWith("complaint-1", "user-1");
  });

  it("passes the authenticated actor and pagination when listing complaints", async () => {
    const page = await controller.findMine(request, 2, 10);

    expect(page).toEqual({ list: [], total: 0, page: 2, pageSize: 10 });
    expect(queryService.findMine).toHaveBeenCalledWith("user-1", 2, 10);
  });

  it("passes the authenticated actor when reading complaint detail", async () => {
    await expect(controller.findOne("complaint-1", request)).resolves.toBe(detail);
    expect(queryService.findForUser).toHaveBeenCalledWith("complaint-1", "user-1");
  });

  it("passes the authenticated actor and DTO when responding", async () => {
    const dto = {
      statement: "实际服务已按约定完成",
      evidenceUrls: [],
      version: 1,
    } as RespondComplaintDto;

    await expect(controller.respond("complaint-1", request, dto)).resolves.toBe(detail);
    expect(commandService.respond).toHaveBeenCalledWith("complaint-1", "user-1", dto);
    expect(queryService.findForUser).toHaveBeenCalledWith("complaint-1", "user-1");
  });

  it("passes the authenticated actor and DTO when appealing", async () => {
    const dto = {
      statement: "补充新的申诉理由",
      evidenceUrls: [],
      version: 2,
    } as SubmitComplaintStatementDto;

    await expect(controller.appeal("complaint-1", request, dto)).resolves.toBe(detail);
    expect(commandService.submitSecondAppeal).toHaveBeenCalledWith("complaint-1", "user-1", dto);
    expect(queryService.findForUser).toHaveBeenCalledWith("complaint-1", "user-1");
  });

  it("passes the authenticated actor and optimistic version when withdrawing", async () => {
    const dto = { version: 3 } as WithdrawComplaintDto;

    await expect(controller.withdraw("complaint-1", request, dto)).resolves.toBe(detail);
    expect(commandService.withdraw).toHaveBeenCalledWith("complaint-1", "user-1", 3);
    expect(queryService.findForUser).toHaveBeenCalledWith("complaint-1", "user-1");
  });

  it("uses 201 for create and 200 for complaint action posts", () => {
    expect(effectivePostStatus("create")).toBe(HttpStatus.CREATED);
    expect(effectivePostStatus("respond")).toBe(HttpStatus.OK);
    expect(effectivePostStatus("appeal")).toBe(HttpStatus.OK);
    expect(effectivePostStatus("withdraw")).toBe(HttpStatus.OK);
  });

  function effectivePostStatus(methodName: "create" | "respond" | "appeal" | "withdraw"): number {
    const handler = ComplaintController.prototype[methodName];

    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);

    return Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? HttpStatus.CREATED;
  }
});
