import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import { AuthTokens } from "./auth.types";
import { CaptchaService } from "./captcha.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { VerificationCodeService } from "./verification-code.service";

interface AdminUserRecord {
  id: string;
  username: string | null;
  phone: string;
  nickname: string;
  status: string;
  passwordHash: string | null;
  roles: Array<{ role: { roleName: string; isActive: boolean } }>;
}

export interface SafeAdminUser {
  id: string;
  username: string | null;
  phone: string;
  nickname: string;
  roles: string[];
}

export interface LoginResult extends AuthTokens {
  user: SafeAdminUser;
}

const adminUserSelect = {
  id: true,
  username: true,
  phone: true,
  nickname: true,
  status: true,
  passwordHash: true,
  roles: {
    select: {
      role: {
        select: {
          roleName: true,
          isActive: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly tokenService: TokenService,
    private readonly captchaService: CaptchaService,
  ) {}

  async sendSmsCode(
    phone: string,
    captchaId: string,
    captchaCode: string,
  ): Promise<{ message: string }> {
    const captchaMatches = await this.captchaService.verifyAndConsume(captchaId, captchaCode);

    if (!captchaMatches) {
      throw new ApiException(
        "AUTH_INVALID_CAPTCHA",
        "图形验证码错误或已过期",
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.prismaService.user.findFirst({
      where: {
        phone,
        status: "active",
        roles: {
          some: {
            role: { roleName: "super_admin", isActive: true },
          },
        },
      },
      select: { id: true },
    });

    if (user) {
      await this.verificationCodeService.send(phone);
    }

    return { message: "如果该手机号可用于后台登录，验证码将会发送" };
  }

  async loginWithPassword(identifier: string, password: string): Promise<LoginResult> {
    const user = await this.prismaService.user.findFirst({
      where: { OR: [{ phone: identifier }, { username: identifier }] },
      select: adminUserSelect,
    });

    if (!this.isActiveAdministrator(user) || !user.passwordHash) {
      throw this.invalidCredentials();
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, password);

    if (!passwordMatches) {
      throw this.invalidCredentials();
    }

    return this.issueSession(user);
  }

  async loginWithSms(phone: string, code: string): Promise<LoginResult> {
    const codeMatches = await this.verificationCodeService.verifyAndConsume(phone, code);

    if (!codeMatches) {
      throw this.invalidCredentials();
    }

    const user = await this.prismaService.user.findFirst({
      where: { phone },
      select: adminUserSelect,
    });

    if (!this.isActiveAdministrator(user)) {
      throw this.invalidCredentials();
    }

    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    const { userId } = await this.tokenService.consumeRefresh(refreshToken);
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: adminUserSelect,
    });

    if (!this.isActiveAdministrator(user)) {
      throw this.invalidCredentials();
    }

    return this.issueSession(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revoke(refreshToken);
  }

  async getCurrentUser(userId: string): Promise<SafeAdminUser> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: adminUserSelect,
    });

    if (!this.isActiveAdministrator(user)) {
      throw this.invalidCredentials();
    }

    return this.toSafeUser(user);
  }

  private async issueSession(user: AdminUserRecord): Promise<LoginResult> {
    const safeUser = this.toSafeUser(user);
    const tokens = await this.tokenService.issue({
      userId: user.id,
      username: user.username,
      phone: user.phone,
      roles: safeUser.roles,
    });

    return { ...tokens, user: safeUser };
  }

  private isActiveAdministrator(user: AdminUserRecord | null): user is AdminUserRecord {
    return (
      user?.status === "active" &&
      user.roles.some(
        (assignment) => assignment.role.roleName === "super_admin" && assignment.role.isActive,
      )
    );
  }

  private toSafeUser(user: AdminUserRecord): SafeAdminUser {
    return {
      id: user.id,
      username: user.username,
      phone: user.phone,
      nickname: user.nickname,
      roles: user.roles
        .filter((assignment) => assignment.role.isActive)
        .map((assignment) => assignment.role.roleName),
    };
  }

  private invalidCredentials(): ApiException {
    return new ApiException("AUTH_INVALID_CREDENTIALS", "账号或凭据错误", HttpStatus.UNAUTHORIZED);
  }
}
