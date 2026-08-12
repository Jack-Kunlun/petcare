import { HttpStatus, Injectable } from "@nestjs/common";
import {
  ADMIN_ACCOUNT_ERROR_CODE,
  type AdminAccountProfile,
  type UpdateAdminAccountPasswordRequest,
} from "@petcare/shared-types";
import { PasswordService } from "../../auth/password.service";
import { TokenService } from "../../auth/token.service";
import { ApiException } from "../../common/http/api-exception";
import { AppLogger } from "../../logging/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";

const profileSelect = {
  id: true,
  username: true,
  phone: true,
  nickname: true,
  avatar: true,
  status: true,
  createdAt: true,
  roles: {
    where: { role: { isActive: true } },
    select: { role: { select: { roleName: true } } },
  },
} as const;

export interface AdminAccountMutationContext {
  userId: string;
  sessionId: string;
  requestId: string;
}

/** Owns safe profile reads and self-service mutations for the current administrator. */
@Injectable()
export class AdminAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly logger: AppLogger,
  ) {}

  async getProfile(userId: string): Promise<AdminAccountProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });

    if (!user) {
      throw new ApiException("RESOURCE_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
    }

    return {
      id: user.id,
      username: user.username,
      maskedPhone: this.maskPhone(user.phone),
      nickname: user.nickname,
      avatar: user.avatar,
      status: user.status,
      roles: user.roles.map((assignment) => assignment.role.roleName),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, nickname: string): Promise<void> {
    const normalizedNickname = nickname.trim();

    if (!normalizedNickname || /\p{Cc}/u.test(normalizedNickname)) {
      throw new ApiException("VALIDATION_FAILED", "昵称格式无效", HttpStatus.BAD_REQUEST);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { nickname: normalizedNickname },
    });
  }

  async changePassword(
    context: AdminAccountMutationContext,
    request: UpdateAdminAccountPasswordRequest,
  ): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: context.userId },
      select: { passwordHash: true, sessionVersion: true },
    });

    if (!current?.passwordHash) {
      throw this.passwordError(
        ADMIN_ACCOUNT_ERROR_CODE.PASSWORD_NOT_CONFIGURED,
        "当前账号未配置密码",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!(await this.passwordService.verify(current.passwordHash, request.currentPassword))) {
      throw this.passwordError(
        ADMIN_ACCOUNT_ERROR_CODE.CURRENT_PASSWORD_INVALID,
        "当前密码不正确",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (await this.passwordService.verify(current.passwordHash, request.newPassword)) {
      throw this.passwordError(
        ADMIN_ACCOUNT_ERROR_CODE.PASSWORD_REUSED,
        "新密码不能与当前密码相同",
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await this.passwordService.hash(request.newPassword);
    const result = await this.prisma.user.updateMany({
      where: {
        id: context.userId,
        passwordHash: current.passwordHash,
        sessionVersion: current.sessionVersion,
      },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });

    if (result.count !== 1) {
      throw this.passwordError(
        ADMIN_ACCOUNT_ERROR_CODE.CONCURRENT_UPDATE,
        "密码已被其他操作更新，请刷新后重试",
        HttpStatus.CONFLICT,
      );
    }

    await this.tokenService.revokeSession(context.sessionId);
    this.logger.write("info", "admin_account.password_changed", {
      userId: context.userId,
      sessionId: context.sessionId,
      requestId: context.requestId,
    });
  }

  private maskPhone(phone: string): string {
    return /^\d{11}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : "****";
  }

  private passwordError(code: string, message: string, status: HttpStatus): ApiException {
    return new ApiException(code, message, status);
  }
}
