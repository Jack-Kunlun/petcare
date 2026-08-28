import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import type { AccessTokenPayload } from "../../auth/auth.types";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { AdminUserListQueryDto } from "./dto/admin-user-list-query.dto";
import { AdminUserDetailDto, AdminUserListResponseDto } from "./dto/user-response.dto";
import { UserService } from "./user.service";

type AuthRequest = Request & { user: AccessTokenPayload };

@ApiTags("admin-users")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller("admin/users")
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  /** 返回后台用户分页列表，查询参数已经由 DTO 完成转换与校验。 */
  @Get()
  @RequirePermissions("user.read")
  @ApiOperation({ summary: "获取后台用户列表" })
  @ApiSuccessResponse(AdminUserListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findAll(@Query() query: AdminUserListQueryDto) {
    return this.userService.findAdminPage(query);
  }

  /** 返回单个后台用户的账户详情。 */
  @Get(":id")
  @RequirePermissions("user.read")
  @ApiOperation({ summary: "获取后台用户详情" })
  @ApiSuccessResponse(AdminUserDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.userService.findAdminOne(id);
  }

  /** 拉黑一个正常用户并使其现有会话立即失效。 */
  @Post(":id/ban")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("user.update")
  @ApiOperation({ summary: "拉黑后台用户" })
  @ApiSuccessResponse(AdminUserDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  ban(@Param("id", ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    return this.userService.banAdminUser(id, request.user.sub);
  }

  /** 恢复一个已拉黑用户；原有会话仍保持失效。 */
  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("user.update")
  @ApiOperation({ summary: "恢复已拉黑后台用户" })
  @ApiSuccessResponse(AdminUserDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  restore(@Param("id", ParseUUIDPipe) id: string) {
    return this.userService.restoreAdminUser(id);
  }
}
