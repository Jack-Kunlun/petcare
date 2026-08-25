import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
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
import type { MiniappUserProfile } from "@petcare/shared-types";
import type { Request } from "express";
import { memoryStorage } from "multer";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { ApiException } from "../../common/http/api-exception";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { detectAvatarFile } from "../../public-avatar-storage/avatar-file";
import {
  BindMiniappPhoneDto,
  CancelMiniappAccountDto,
  MiniappUserProfileDto,
  SendMiniappPhoneCodeDto,
  UpdateMiniappProfileDto,
  UploadMiniappAvatarDto,
} from "./dto/miniapp-account.dto";
import { MiniappAccountService } from "./miniapp-account.service";

type MiniappRequest = Request & { user?: AccessTokenPayload };

/** Exposes authenticated current-user profile operations for the Miniapp. */
@ApiTags("users")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("users/me")
export class MiniappAccountController {
  constructor(private readonly miniappAccountService: MiniappAccountService) {}

  @Get()
  @ApiOperation({ summary: "获取当前小程序用户资料" })
  @ApiSuccessResponse(MiniappUserProfileDto)
  @ApiStandardErrors(401, 404, 500)
  getProfile(@Req() request: MiniappRequest): Promise<MiniappUserProfile> {
    return this.miniappAccountService.getProfile(this.requireUserId(request));
  }

  @Put()
  @ApiOperation({ summary: "更新当前小程序用户资料" })
  @ApiSuccessResponse(MiniappUserProfileDto)
  @ApiStandardErrors(400, 401, 404, 500)
  updateProfile(
    @Body() dto: UpdateMiniappProfileDto,
    @Req() request: MiniappRequest,
  ): Promise<MiniappUserProfile> {
    return this.miniappAccountService.updateProfile(this.requireUserId(request), dto);
  }

  @Post("avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiOperation({ summary: "上传当前小程序用户头像" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadMiniappAvatarDto })
  @ApiSuccessResponse(MiniappUserProfileDto)
  @ApiStandardErrors(400, 401, 404, 413, 500, 503)
  replaceAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: MiniappRequest,
  ): Promise<MiniappUserProfile> {
    return this.miniappAccountService.replaceAvatar(
      this.requireUserId(request),
      detectAvatarFile(file?.buffer ?? Buffer.alloc(0), file?.mimetype ?? ""),
    );
  }

  @Post("phone/code")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "发送小程序手机号绑定验证码" })
  @ApiNoContentResponse({ description: "验证码已发送" })
  @ApiStandardErrors(400, 401, 404, 409, 429, 500, 503)
  sendPhoneCode(
    @Body() dto: SendMiniappPhoneCodeDto,
    @Req() request: MiniappRequest,
  ): Promise<void> {
    return this.miniappAccountService.sendPhoneCode(this.requireUserId(request), dto.phone);
  }

  @Put("phone")
  @ApiOperation({ summary: "验证并绑定当前小程序用户手机号" })
  @ApiSuccessResponse(MiniappUserProfileDto)
  @ApiStandardErrors(400, 401, 404, 409, 500)
  bindPhone(
    @Body() dto: BindMiniappPhoneDto,
    @Req() request: MiniappRequest,
  ): Promise<MiniappUserProfile> {
    return this.miniappAccountService.bindPhone(this.requireUserId(request), dto.phone, dto.code);
  }

  @Post("cancellation/code")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "发送当前账户的注销验证码" })
  @ApiNoContentResponse({ description: "注销验证码已发送" })
  @ApiStandardErrors(400, 401, 403, 409, 429, 500, 503)
  sendCancellationCode(@Req() request: MiniappRequest): Promise<void> {
    return this.miniappAccountService.sendCancellationCode(this.requireUserId(request));
  }

  @Post("cancel")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "注销当前小程序账户" })
  @ApiNoContentResponse({ description: "账户已注销" })
  @ApiStandardErrors(400, 401, 403, 409, 429, 500)
  cancel(@Req() request: MiniappRequest, @Body() dto: CancelMiniappAccountDto): Promise<void> {
    return this.miniappAccountService.cancelAccount(this.requireUserId(request), dto.code);
  }

  private requireUserId(request: MiniappRequest): string {
    const userId = request.user?.sub;

    if (!userId) {
      throw new ApiException(
        "AUTH_SESSION_EXPIRED",
        "登录状态已失效，请重新登录",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return userId;
  }
}
