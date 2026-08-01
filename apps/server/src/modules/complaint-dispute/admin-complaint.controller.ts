import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { DisputeResolverGuard } from "../../auth/dispute-resolver.guard";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { ComplaintCommandService, type AdminActor } from "./complaint-command.service";
import { ComplaintQueryService } from "./complaint-query.service";
import { DisputeDecisionService } from "./dispute-decision.service";
import { DisputeExecutionService } from "./dispute-execution.service";
import { AdminComplaintListQueryDto } from "./dto/admin-complaint-list-query.dto";
import { ComplaintListResponseDto, ComplaintResponseDto } from "./dto/complaint-response.dto";
import { SubmitDisputeDecisionDto } from "./dto/submit-dispute-decision.dto";
import { ClaimComplaintDto, TransferComplaintDto } from "./dto/transfer-complaint.dto";

type AuthRequest = Request & { user?: AccessTokenPayload };

@ApiTags("admin-complaints")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, DisputeResolverGuard)
@Controller("admin/complaints")
export class AdminComplaintController {
  constructor(
    private readonly commandService: ComplaintCommandService,
    private readonly queryService: ComplaintQueryService,
    private readonly decisionService: DisputeDecisionService,
    private readonly executionService: DisputeExecutionService,
  ) {}

  /** 返回后台投诉案件分页列表。 */
  @Get()
  @ApiOperation({ summary: "获取后台投诉案件列表" })
  @ApiSuccessResponse(ComplaintListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findAll(@Query() query: AdminComplaintListQueryDto) {
    return this.queryService.findAdminPage(query);
  }

  /** 返回管理员视角的投诉案件详情。 */
  @Get(":id")
  @ApiOperation({ summary: "获取后台投诉案件详情" })
  @ApiSuccessResponse(ComplaintResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findOne(@Param("id", new ParseUUIDPipe()) id: string, @Req() request: AuthRequest) {
    return this.queryService.findForAdmin(id, this.actor(request));
  }

  /** 分页返回指定投诉的裁决执行任务。 */
  @Get(":id/execution-tasks")
  @ApiOperation({ summary: "获取投诉裁决执行任务" })
  @ApiStandardErrors(400, 401, 403, 500)
  findExecutionTasks(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(100), ParseIntPipe) pageSize: number,
  ) {
    return this.executionService.findTasks(id, page, pageSize);
  }

  /** 由当前管理员原子认领未分配案件。 */
  @Post(":id/claim")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "认领投诉案件" })
  @ApiSuccessResponse(ComplaintResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  async claim(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthRequest,
    @Body() dto: ClaimComplaintDto,
  ) {
    const admin = this.actor(request);

    await this.commandService.claim(id, admin, dto.version);

    return this.queryService.findForAdmin(id, admin);
  }

  /** 将案件转交给另一个有效管理员。 */
  @Post(":id/transfer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "转交投诉案件" })
  @ApiSuccessResponse(ComplaintResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  async transfer(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthRequest,
    @Body() dto: TransferComplaintDto,
  ) {
    const admin = this.actor(request);

    await this.commandService.transfer(id, admin, dto.targetAdminId, dto.reason, dto.version);

    return this.queryService.findForAdmin(id, admin);
  }

  /** 提交案件初裁并开启二次申诉窗口。 */
  @Post(":id/decisions/initial")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "提交投诉案件初裁" })
  @ApiSuccessResponse(ComplaintResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  async decideInitial(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthRequest,
    @Body() dto: SubmitDisputeDecisionDto,
  ) {
    const admin = this.actor(request);

    await this.decisionService.decideInitial(id, admin, dto);

    return this.queryService.findForAdmin(id, admin);
  }

  /** 提交案件终裁并关闭投诉。 */
  @Post(":id/decisions/final")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "提交投诉案件终裁" })
  @ApiSuccessResponse(ComplaintResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  async decideFinal(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthRequest,
    @Body() dto: SubmitDisputeDecisionDto,
  ) {
    const admin = this.actor(request);

    await this.decisionService.decideFinal(id, admin, dto);

    return this.queryService.findForAdmin(id, admin);
  }

  /** 仅重试当前投诉下仍为失败状态的裁决执行任务。 */
  @Post(":id/execution-tasks/:taskId/retry")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "重试失败的投诉裁决执行任务" })
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  retryExecutionTask(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("taskId", new ParseUUIDPipe()) taskId: string,
    @Req() request: AuthRequest,
  ) {
    return this.executionService.retryTask(taskId, request.user!.sub, id);
  }

  /** 仅从访问令牌构建服务端信任的管理员身份。 */
  private actor(request: AuthRequest): AdminActor {
    return {
      id: request.user!.sub,
      roles: request.user!.roles,
    };
  }
}
