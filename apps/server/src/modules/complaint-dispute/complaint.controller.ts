import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
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
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { ComplaintCommandService } from "./complaint-command.service";
import { ComplaintQueryService } from "./complaint-query.service";
import { ComplaintListResponseDto, ComplaintResponseDto } from "./dto/complaint-response.dto";
import { CreateComplaintDto } from "./dto/create-complaint.dto";
import {
  RespondComplaintDto,
  SubmitComplaintStatementDto,
  WithdrawComplaintDto,
} from "./dto/submit-complaint-statement.dto";

type AuthRequest = Request & { user?: AccessTokenPayload };

@ApiTags("complaints")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("complaints")
export class ComplaintController {
  constructor(
    private readonly commandService: ComplaintCommandService,
    private readonly queryService: ComplaintQueryService,
  ) {}

  /** 创建当前用户作为订单一方的投诉。 */
  @Post()
  @ApiOperation({ summary: "创建订单投诉" })
  @ApiSuccessResponse(ComplaintResponseDto, { status: 201 })
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  async create(@Req() request: AuthRequest, @Body() dto: CreateComplaintDto) {
    const id = await this.commandService.createComplaint(request.user!.sub, dto);

    return this.queryService.findForUser(id, request.user!.sub);
  }

  /** 分页返回当前用户参与的投诉。 */
  @Get()
  @ApiOperation({ summary: "获取我的投诉列表" })
  @ApiSuccessResponse(ComplaintListResponseDto)
  @ApiStandardErrors(400, 401, 500)
  findMine(
    @Req() request: AuthRequest,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.queryService.findMine(request.user!.sub, page, pageSize);
  }

  /** 返回当前订单当事方可见的投诉详情。 */
  @Get(":id")
  @ApiOperation({ summary: "获取投诉详情" })
  @ApiSuccessResponse(ComplaintResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findOne(@Param("id", new ParseUUIDPipe()) id: string, @Req() request: AuthRequest) {
    return this.queryService.findForUser(id, request.user!.sub);
  }

  /** 提交被投诉方的首次回应。 */
  @Post(":id/respond")
  @ApiOperation({ summary: "提交首次投诉回应" })
  @ApiSuccessResponse(ComplaintResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  async respond(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthRequest,
    @Body() dto: RespondComplaintDto,
  ) {
    await this.commandService.respond(id, request.user!.sub, dto);

    return this.queryService.findForUser(id, request.user!.sub);
  }

  /** 提交当前订单当事方的二次申诉。 */
  @Post(":id/appeals")
  @ApiOperation({ summary: "提交二次申诉" })
  @ApiSuccessResponse(ComplaintResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  async appeal(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthRequest,
    @Body() dto: SubmitComplaintStatementDto,
  ) {
    await this.commandService.submitSecondAppeal(id, request.user!.sub, dto);

    return this.queryService.findForUser(id, request.user!.sub);
  }

  /** 由投诉方在初裁前撤回投诉。 */
  @Post(":id/withdraw")
  @ApiOperation({ summary: "撤回投诉" })
  @ApiSuccessResponse(ComplaintResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  async withdraw(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthRequest,
    @Body() dto: WithdrawComplaintDto,
  ) {
    await this.commandService.withdraw(id, request.user!.sub, dto.version);

    return this.queryService.findForUser(id, request.user!.sub);
  }
}
