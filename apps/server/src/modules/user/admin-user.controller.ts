import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { AdminGuard } from "../../auth/admin.guard";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { AdminUserListQueryDto } from "./dto/admin-user-list-query.dto";
import { AdminUserListResponseDto } from "./dto/user-response.dto";
import { UserService } from "./user.service";

@ApiTags("admin-users")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, AdminGuard)
@Controller("admin/users")
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: "获取后台用户列表" })
  @ApiSuccessResponse(AdminUserListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findAll(@Query() query: AdminUserListQueryDto) {
    return this.userService.findAdminPage(query);
  }
}
