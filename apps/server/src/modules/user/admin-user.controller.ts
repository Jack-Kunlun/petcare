import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { AdminUserListQueryDto } from "./dto/admin-user-list-query.dto";
import { AdminUserListResponseDto } from "./dto/user-response.dto";
import { UserService } from "./user.service";

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
}
