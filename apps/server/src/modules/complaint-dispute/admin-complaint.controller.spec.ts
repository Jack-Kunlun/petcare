import { type INestApplication, HttpStatus, RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import { COMPLAINT_QUEUE, COMPLAINT_STATUS } from "@petcare/shared-types";
import { validate } from "class-validator";
import supertest from "supertest";
import { AppModule } from "../../app.module";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { DisputeResolverGuard } from "../../auth/dispute-resolver.guard";
import { PermissionGuard } from "../../auth/permission.guard";
import { PERMISSIONS_METADATA_KEY } from "../../auth/permissions.decorator";
import { ConfigService } from "../../config/config.service";
import { RedisService } from "../../config/redis.service";
import { AppLogger } from "../../logging/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminComplaintController } from "./admin-complaint.controller";
import { ComplaintCommandService } from "./complaint-command.service";
import { ComplaintDeadlineService } from "./complaint-deadline.service";
import { ComplaintDisputeModule } from "./complaint-dispute.module";
import { ComplaintQueryService } from "./complaint-query.service";
import { DisputeDecisionService } from "./dispute-decision.service";
import { DisputeExecutionService } from "./dispute-execution.service";
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
  const executionService = {
    findTasks: jest.fn(),
    retryTask: jest.fn(),
  };
  const controller = new AdminComplaintController(
    commandService as unknown as ComplaintCommandService,
    queryService as unknown as ComplaintQueryService,
    decisionService as unknown as DisputeDecisionService,
    executionService as unknown as DisputeExecutionService,
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
    executionService.findTasks.mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 100,
    });
    executionService.retryTask.mockResolvedValue({
      id: "task-1",
      complaintId: "complaint-1",
      status: "succeeded",
    });
    queryService.findAdminPage.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 });
    queryService.findForAdmin.mockResolvedValue(detail);
  });

  it("uses the fixed admin API route and both authentication guards", () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminComplaintController)).toBe("admin/complaints");
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminComplaintController) as unknown[];

    expect(guards).toEqual(
      expect.arrayContaining([AccessTokenGuard, PermissionGuard, DisputeResolverGuard]),
    );
    expect(
      Reflect.getMetadata(PERMISSIONS_METADATA_KEY, AdminComplaintController.prototype.findAll),
    ).toEqual(["dispute.read"]);
    expect(
      Reflect.getMetadata(PERMISSIONS_METADATA_KEY, AdminComplaintController.prototype.decideFinal),
    ).toEqual(["dispute.resolve"]);
  });

  it("passes administrator filters and identity to list and detail reads", async () => {
    const query = {
      page: 1,
      pageSize: 20,
      queue: COMPLAINT_QUEUE.MINE,
      status: COMPLAINT_STATUS.UNASSIGNED,
    } as AdminComplaintListQueryDto;

    await expect(controller.findAll(query, request)).resolves.toEqual({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    await expect(controller.findOne("complaint-1", request)).resolves.toBe(detail);

    expect(queryService.findAdminPage).toHaveBeenCalledWith(query, "admin-1");
    expect(queryService.findForAdmin).toHaveBeenCalledWith("complaint-1", {
      id: "admin-1",
      roles: ["complaint_admin"],
    });
    expect(
      JSON.stringify(
        Reflect.getMetadata("swagger/apiResponse", AdminComplaintController.prototype.findAll),
      ),
    ).toContain("AdminComplaintListResponseDto");
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

  it("lists execution tasks and retries only within the route complaint", async () => {
    await expect(controller.findExecutionTasks("complaint-1", 1, 100)).resolves.toEqual({
      list: [],
      total: 0,
      page: 1,
      pageSize: 100,
    });
    await expect(
      controller.retryExecutionTask("complaint-1", "task-1", request, { version: 3 }),
    ).resolves.toMatchObject({
      id: "task-1",
      status: "succeeded",
    });

    expect(executionService.findTasks).toHaveBeenCalledWith("complaint-1", 1, 100);
    expect(executionService.retryTask).toHaveBeenCalledWith("task-1", "admin-1", "complaint-1", 3);
  });

  it("exposes the execution task list and retry routes", () => {
    const listHandler = AdminComplaintController.prototype.findExecutionTasks;
    const retryHandler = AdminComplaintController.prototype.retryExecutionTask;

    expect(Reflect.getMetadata(PATH_METADATA, listHandler)).toBe(":id/execution-tasks");
    expect(Reflect.getMetadata(METHOD_METADATA, listHandler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, retryHandler)).toBe(
      ":id/execution-tasks/:taskId/retry",
    );
    expect(Reflect.getMetadata(METHOD_METADATA, retryHandler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, retryHandler)).toBe(HttpStatus.OK);
    expect(JSON.stringify(Reflect.getMetadata("swagger/apiResponse", listHandler))).toContain(
      "DisputeExecutionTaskListResponseDto",
    );
    expect(JSON.stringify(Reflect.getMetadata("swagger/apiResponse", retryHandler))).toContain(
      "RetryDisputeExecutionTaskResponseDto",
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
    const queueErrors = await validate(
      Object.assign(new AdminComplaintListQueryDto(), { queue: "unknown_queue" }),
    );
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
    expect(queueErrors.map((error) => error.property)).toContain("queue");
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

  it("registers the complaint module and exposes its execution task routes", async () => {
    const complaintId = "11111111-1111-4111-8111-111111111111";
    const taskId = "22222222-2222-4222-8222-222222222222";
    let app: INestApplication | undefined;

    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[]).toContain(
      ComplaintDisputeModule,
    );
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ComplaintDisputeModule) as unknown[],
    ).toContain(AdminComplaintController);

    executionService.findTasks.mockResolvedValue({
      list: [],
      total: 0,
      page: 1,
      pageSize: 100,
    });
    const moduleReference = await Test.createTestingModule({
      controllers: [AdminComplaintController],
      providers: [
        { provide: ComplaintCommandService, useValue: commandService },
        { provide: ComplaintQueryService, useValue: queryService },
        { provide: DisputeDecisionService, useValue: decisionService },
        { provide: DisputeExecutionService, useValue: executionService },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: {
          switchToHttp(): { getRequest(): { user?: { sub: string; roles: string[] } } };
        }) {
          context.switchToHttp().getRequest().user = {
            sub: "admin-1",
            roles: ["complaint_admin"],
          };

          return true;
        },
      })
      .overrideGuard(DisputeResolverGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    try {
      app = moduleReference.createNestApplication();
      await app.init();

      await supertest(app.getHttpServer())
        .get(`/admin/complaints/${complaintId}/execution-tasks`)
        .expect(HttpStatus.OK);
      await supertest(app.getHttpServer())
        .post(`/admin/complaints/${complaintId}/execution-tasks/${taskId}/retry`)
        .send({ version: 3 })
        .expect(HttpStatus.OK);

      expect(executionService.findTasks).toHaveBeenCalledWith(complaintId, 1, 100);
      expect(executionService.retryTask).toHaveBeenCalledWith(taskId, "admin-1", complaintId, 3);
    } finally {
      await app?.close();
    }
  });

  it("compiles the real complaint module with only external boundaries replaced", async () => {
    const moduleReference = await Test.createTestingModule({
      imports: [ComplaintDisputeModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue({})
      .overrideProvider(ConfigService)
      .useValue({
        nodeEnv: "test",
        jwtSecret: "test-secret-that-is-at-least-32-characters",
      })
      .overrideProvider(AppLogger)
      .useValue({ write: jest.fn() })
      .compile();

    expect(moduleReference.get(ComplaintCommandService)).toBeInstanceOf(ComplaintCommandService);
    expect(moduleReference.get(ComplaintDeadlineService)).toBeInstanceOf(ComplaintDeadlineService);

    await moduleReference.close();
  });
});
