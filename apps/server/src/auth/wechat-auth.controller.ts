import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { WechatSession } from "@petcare/shared-types";
import { ApiStandardErrors, ApiSuccessResponse } from "../common/swagger/api-response.decorators";
import { WechatSessionResponseDto } from "./dto/wechat-auth-response.dto";
import { WechatLoginDto, WechatLogoutDto, WechatRefreshDto } from "./dto/wechat-auth.dto";
import { WechatAuthService } from "./wechat-auth.service";

@ApiTags("auth")
@Controller("auth/wechat")
export class WechatAuthController {
  constructor(private readonly wechatAuthService: WechatAuthService) {}

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "使用微信登录凭证登录小程序" })
  @ApiSuccessResponse(WechatSessionResponseDto)
  @ApiStandardErrors(400, 401, 403, 503)
  login(@Body() dto: WechatLoginDto): Promise<WechatSession> {
    return this.wechatAuthService.login(dto.loginCode);
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
}
