import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { ApiException } from "../common/http/api-exception";
import { ApiStandardErrors, ApiSuccessResponse } from "../common/swagger/api-response.decorators";
import { ConfigService } from "../config/config.service";
import { AccessTokenGuard } from "./access-token.guard";
import { AdminGuard } from "./admin.guard";
import { AuthService, LoginResult } from "./auth.service";
import { AccessTokenPayload } from "./auth.types";
import { CaptchaChallenge, CaptchaService } from "./captcha.service";
import {
  AdminLoginResponseDto,
  AdminUserResponseDto,
  CaptchaResponseDto,
  MessageResponseDto,
} from "./dto/auth-response.dto";
import { PasswordLoginDto } from "./dto/password-login.dto";
import { SendSmsCodeDto } from "./dto/send-sms-code.dto";
import { SmsLoginDto } from "./dto/sms-login.dto";

const REFRESH_COOKIE = "petcare_refresh_token";

type AuthRequest = Request & {
  user?: AccessTokenPayload;
  cookies?: Record<string, string>;
};

type LoginResponse = Pick<LoginResult, "accessToken" | "user">;

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
  @ApiSuccessResponse(CaptchaResponseDto)
  @ApiStandardErrors(500)
  getCaptcha(): Promise<CaptchaChallenge> {
    return this.captchaService.create();
  }

  @Post("sms/send")
  @HttpCode(200)
  @ApiOperation({ summary: "发送管理员登录验证码" })
  @ApiSuccessResponse(MessageResponseDto)
  @ApiStandardErrors(400, 429, 500)
  sendSmsCode(@Body() dto: SendSmsCodeDto): Promise<{ message: string }> {
    return this.authService.sendSmsCode(dto.phone, dto.captchaId, dto.captchaCode);
  }

  @Post("login/password")
  @HttpCode(200)
  @ApiOperation({ summary: "使用手机号或账号加密码登录" })
  @ApiSuccessResponse(AdminLoginResponseDto)
  @ApiStandardErrors(400, 401, 500)
  async loginWithPassword(
    @Body() dto: PasswordLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.loginWithPassword(dto.identifier, dto.password);

    return this.completeLogin(result, response);
  }

  @Post("login/sms")
  @HttpCode(200)
  @ApiOperation({ summary: "使用手机号和验证码登录" })
  @ApiSuccessResponse(AdminLoginResponseDto)
  @ApiStandardErrors(400, 401, 500)
  async loginWithSms(
    @Body() dto: SmsLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.authService.loginWithSms(dto.phone, dto.code);

    return this.completeLogin(result, response);
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "刷新管理员登录状态" })
  @ApiSuccessResponse(AdminLoginResponseDto)
  @ApiStandardErrors(401, 500)
  async refresh(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];

    if (!refreshToken) {
      throw new ApiException("AUTH_SESSION_EXPIRED", "登录状态已失效", HttpStatus.UNAUTHORIZED);
    }

    const result = await this.authService.refresh(refreshToken);

    return this.completeLogin(result, response);
  }

  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "退出管理员登录" })
  @ApiNoContentResponse({ description: "退出成功" })
  @ApiStandardErrors(500)
  async logout(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
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
  @ApiSuccessResponse(AdminUserResponseDto)
  @ApiStandardErrors(401, 403, 500)
  me(@Req() request: AuthRequest): Promise<AdminUserResponseDto> {
    const userId = request.user?.sub;

    if (!userId) {
      throw new ApiException("AUTH_SESSION_EXPIRED", "登录状态已失效", HttpStatus.UNAUTHORIZED);
    }

    return this.authService.getCurrentUser(userId);
  }

  private completeLogin(result: LoginResult, response: Response): LoginResponse {
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
