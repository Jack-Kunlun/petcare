import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { type AccessTokenPayload } from "../../auth/auth.types";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { AdminProviderCertificationListQueryDto } from "./dto/admin-provider-certification-list-query.dto";
import {
  AdminProviderCertificationDetailDto,
  AdminProviderCertificationListResponseDto,
} from "./dto/provider-certification-response.dto";
import { RejectProviderCertificationDto } from "./dto/reject-provider-certification.dto";
import { ProviderCertificationService } from "./provider-certification.service";

type AuthRequest = Request & { user?: AccessTokenPayload };

@ApiTags("admin-provider-certifications")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller("admin/provider-certifications")
export class AdminProviderCertificationController {
  constructor(private readonly service: ProviderCertificationService) {}

  /** 返回认证申请分页列表。 */
  @Get()
  @RequirePermissions("provider_certification.read")
  @ApiOperation({ summary: "获取宠托师认证申请列表" })
  @ApiSuccessResponse(AdminProviderCertificationListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findAll(@Query() query: AdminProviderCertificationListQueryDto) {
    return this.service.findAdminPage(query);
  }

  /** 返回单个认证申请详情。 */
  @Get(":id")
  @RequirePermissions("provider_certification.read")
  @ApiOperation({ summary: "获取宠托师认证申请详情" })
  @ApiSuccessResponse(AdminProviderCertificationDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.findAdminDetail(id);
  }

  /** 审核通过待审核认证申请。 */
  @Post(":id/approve")
  @RequirePermissions("user.approve_provider")
  @ApiOperation({ summary: "通过宠托师认证申请" })
  @ApiSuccessResponse(AdminProviderCertificationDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  approve(@Param("id", new ParseUUIDPipe()) id: string, @Req() request: AuthRequest) {
    return this.service.approve(id, request.user!.sub);
  }

  /** 填写原因并驳回待审核认证申请。 */
  @Post(":id/reject")
  @RequirePermissions("user.reject_provider")
  @ApiOperation({ summary: "驳回宠托师认证申请" })
  @ApiSuccessResponse(AdminProviderCertificationDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  reject(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: AuthRequest,
    @Body() dto: RejectProviderCertificationDto,
  ) {
    return this.service.reject(id, request.user!.sub, dto.reason);
  }
}
