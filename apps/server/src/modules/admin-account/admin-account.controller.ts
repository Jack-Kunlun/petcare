import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { AdminAccountProfile, AdminAvatarResponse } from "@petcare/shared-types";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { REFRESH_COOKIE, refreshCookieOptions } from "../../auth/refresh-cookie";
import type { RequestWithId } from "../../common/http/api-response.types";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { ConfigService } from "../../config/config.service";
import { detectAvatarFile } from "../../public-avatar-storage/avatar-file";
import { ActiveAdministratorGuard } from "./active-administrator.guard";
import { AdminAccountService, type AdminAccountMutationContext } from "./admin-account.service";
import {
  AdminAccountProfileDto,
  AdminAvatarResponseDto,
  UploadAdminAvatarDto,
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
  @ApiSuccessResponse(AdminAccountProfileDto)
  @ApiStandardErrors(400, 401, 403, 500)
  updateProfile(
    @Body() dto: UpdateAdminAccountProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminAccountProfile> {
    return this.adminAccountService.updateProfile(request.user.sub, dto.nickname);
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

  @Put("avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiOperation({ summary: "上传当前管理员头像" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadAdminAvatarDto })
  @ApiSuccessResponse(AdminAvatarResponseDto)
  @ApiStandardErrors(400, 401, 403, 409, 413, 500, 503)
  replaceAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminAvatarResponse> {
    const context: AdminAccountMutationContext = {
      userId: request.user.sub,
      sessionId: request.user.sid,
      requestId: request.requestId,
    };

    return this.adminAccountService.replaceAvatar(
      context,
      detectAvatarFile(file?.buffer ?? Buffer.alloc(0), file?.mimetype ?? ""),
    );
  }

  @Delete("avatar")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除当前管理员头像" })
  @ApiNoContentResponse({ description: "头像删除成功" })
  @ApiStandardErrors(401, 403, 409, 500)
  async deleteAvatar(@Req() request: AuthenticatedRequest): Promise<void> {
    const context: AdminAccountMutationContext = {
      userId: request.user.sub,
      sessionId: request.user.sid,
      requestId: request.requestId,
    };

    await this.adminAccountService.deleteAvatar(context);
  }
}
