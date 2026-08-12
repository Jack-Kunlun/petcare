import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AdminAccountProfile } from "@petcare/shared-types";
import type { Response } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { REFRESH_COOKIE, refreshCookieOptions } from "../../auth/refresh-cookie";
import type { RequestWithId } from "../../common/http/api-response.types";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { ConfigService } from "../../config/config.service";
import { ActiveAdministratorGuard } from "./active-administrator.guard";
import { AdminAccountService, type AdminAccountMutationContext } from "./admin-account.service";
import {
  AdminAccountProfileDto,
  UpdateAdminAccountPasswordDto,
  UpdateAdminAccountProfileDto,
} from "./dto/admin-account.dto";

type AuthenticatedRequest = RequestWithId & { user: AccessTokenPayload };

/** Exposes the current backend administrator's self-service profile endpoints. */
@ApiTags("admin-account")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ActiveAdministratorGuard)
@Controller("admin/account")
export class AdminAccountController {
  constructor(
    private readonly adminAccountService: AdminAccountService,
    private readonly configService: ConfigService,
  ) {}

  @Get("profile")
  @ApiOperation({ summary: "获取当前管理员个人资料" })
  @ApiSuccessResponse(AdminAccountProfileDto)
  @ApiStandardErrors(401, 403, 404, 500)
  getProfile(@Req() request: AuthenticatedRequest): Promise<AdminAccountProfile> {
    return this.adminAccountService.getProfile(request.user.sub);
  }

  @Patch("profile")
  @ApiOperation({ summary: "更新当前管理员昵称" })
  @ApiStandardErrors(400, 401, 403, 500)
  async updateProfile(
    @Body() dto: UpdateAdminAccountProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.adminAccountService.updateProfile(request.user.sub, dto.nickname);
  }

  @Put("password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "修改当前管理员密码" })
  @ApiNoContentResponse({ description: "密码修改成功" })
  @ApiStandardErrors(400, 401, 403, 409, 500)
  async changePassword(
    @Body() dto: UpdateAdminAccountPasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const context: AdminAccountMutationContext = {
      userId: request.user.sub,
      sessionId: request.user.sid,
      requestId: request.requestId,
    };

    await this.adminAccountService.changePassword(context, dto);
    response.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.configService));
  }
}
