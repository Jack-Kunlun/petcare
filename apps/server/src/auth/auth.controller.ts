import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { ConfigService } from "../config/config.service";
import { AccessTokenGuard } from "./access-token.guard";
import { AdminGuard } from "./admin.guard";
import { AuthService, LoginResult } from "./auth.service";
import { AccessTokenPayload } from "./auth.types";
import { CaptchaService } from "./captcha.service";
import { PasswordLoginDto } from "./dto/password-login.dto";
import { SendSmsCodeDto } from "./dto/send-sms-code.dto";
import { SmsLoginDto } from "./dto/sms-login.dto";

const REFRESH_COOKIE = "petcare_refresh_token";

type AuthRequest = Request & {
  user?: AccessTokenPayload;
  cookies?: Record<string, string>;
};

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Get("captcha")
  @ApiOperation({ summary: "获取管理员短信登录图形验证码" })
  getCaptcha() {
    return this.captchaService.create();
  }

  @Post("sms/send")
  @HttpCode(200)
  @ApiOperation({ summary: "发送管理员登录验证码" })
  sendSmsCode(@Body() dto: SendSmsCodeDto) {
    return this.authService.sendSmsCode(dto.phone, dto.captchaId, dto.captchaCode);
  }

  @Post("login/password")
  @HttpCode(200)
  @ApiOperation({ summary: "使用手机号或账号加密码登录" })
  async loginWithPassword(
    @Body() dto: PasswordLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginWithPassword(dto.identifier, dto.password);

    return this.completeLogin(result, response);
  }

  @Post("login/sms")
  @HttpCode(200)
  @ApiOperation({ summary: "使用手机号和验证码登录" })
  async loginWithSms(@Body() dto: SmsLoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.loginWithSms(dto.phone, dto.code);

    return this.completeLogin(result, response);
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "刷新管理员登录状态" })
  async refresh(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];

    if (!refreshToken) {
      throw new UnauthorizedException("登录状态已失效");
    }

    const result = await this.authService.refresh(refreshToken);

    return this.completeLogin(result, response);
  }

  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "退出管理员登录" })
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get("me")
  @UseGuards(AccessTokenGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取当前管理员" })
  me(@Req() request: AuthRequest) {
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException("登录状态已失效");
    }

    return this.authService.getCurrentUser(userId);
  }

  private completeLogin(result: LoginResult, response: Response) {
    response.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.configService.refreshTokenTtlSeconds * 1000,
    });

    return { accessToken: result.accessToken, user: result.user };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: this.configService.nodeEnv === "production",
      path: "/api/auth",
    };
  }
}
