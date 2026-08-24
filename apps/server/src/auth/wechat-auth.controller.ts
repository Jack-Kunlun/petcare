import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { MiniappUser, WechatSession } from "@petcare/shared-types";
import { Request } from "express";
import { ApiException } from "../common/http/api-exception";
import { ApiStandardErrors, ApiSuccessResponse } from "../common/swagger/api-response.decorators";
import { AccessTokenGuard } from "./access-token.guard";
import { AccessTokenPayload } from "./auth.types";
import {
  MiniappUserResponseDto,
  WechatAuthenticatedResponseDto,
  WechatLoginResponseDto,
  WechatSessionResponseDto,
} from "./dto/wechat-auth-response.dto";
import {
  WechatBindPhoneDto,
  WechatLoginDto,
  WechatLogoutDto,
  WechatRefreshDto,
} from "./dto/wechat-auth.dto";
import { WechatAuthService } from "./wechat-auth.service";

type AuthRequest = Request & { user?: AccessTokenPayload };

@ApiTags("auth")
@Controller("auth/wechat")
export class WechatAuthController {
  constructor(private readonly wechatAuthService: WechatAuthService) {}

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "使用微信登录凭证登录小程序" })
  @ApiSuccessResponse(WechatLoginResponseDto)
  @ApiStandardErrors(400, 401, 403, 503)
  login(@Body() dto: WechatLoginDto): ReturnType<WechatAuthService["login"]> {
    return this.wechatAuthService.login(dto.loginCode);
  }

  @Post("bind-phone")
  @HttpCode(200)
  @ApiOperation({ summary: "绑定微信授权手机号并完成登录" })
  @ApiSuccessResponse(WechatAuthenticatedResponseDto)
  @ApiStandardErrors(400, 401, 403, 409, 503)
  bindPhone(@Body() dto: WechatBindPhoneDto): Promise<WechatSession & { status: "authenticated" }> {
    return this.wechatAuthService.bindPhone(dto.bindToken, dto.phoneCode);
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "刷新小程序登录会话" })
  @ApiSuccessResponse(WechatSessionResponseDto)
  @ApiStandardErrors(400, 401, 403)
  refresh(@Body() dto: WechatRefreshDto): Promise<WechatSession> {
    return this.wechatAuthService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "退出小程序登录" })
  @ApiNoContentResponse({ description: "退出成功" })
  @ApiStandardErrors(400, 500)
  async logout(@Body() dto: WechatLogoutDto): Promise<void> {
    await this.wechatAuthService.logout(dto.refreshToken);
  }

  @Get("me")
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取当前小程序用户" })
  @ApiSuccessResponse(MiniappUserResponseDto)
  @ApiStandardErrors(401, 403)
  me(@Req() request: AuthRequest): Promise<MiniappUser> {
    const userId = request.user?.sub;

    if (!userId) {
      throw new ApiException(
        "AUTH_SESSION_EXPIRED",
        "登录状态已失效，请重新登录",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.wechatAuthService.getCurrentUser(userId);
  }
}
