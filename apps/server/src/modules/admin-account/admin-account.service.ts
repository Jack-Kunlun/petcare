import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ACCOUNT_ERROR_CODE,
  type AdminAvatarResponse,
  type AdminAccountProfile,
  type UpdateAdminAccountPasswordRequest,
} from "@petcare/shared-types";
import { PasswordService } from "../../auth/password.service";
import { TokenService } from "../../auth/token.service";
import { ApiException } from "../../common/http/api-exception";
import { Prisma } from "../../generated/prisma/client";
import { AppLogger } from "../../logging/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import { type DetectedAvatarFile } from "../../public-avatar-storage/avatar-file";
import {
  PUBLIC_AVATAR_STORAGE,
  type PublicAvatarStorage,
} from "../../public-avatar-storage/public-avatar-storage.types";

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
    @Inject(PUBLIC_AVATAR_STORAGE) private readonly avatarStorage: PublicAvatarStorage,
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

  async replaceAvatar(userId: string, file: DetectedAvatarFile): Promise<AdminAvatarResponse> {
    const uploaded = await this.avatarStorage.upload({ userId, ...file });

    try {
      const oldObjectKey = await this.withAvatarTransaction(async (transaction) => {
        const current = await transaction.user.findUnique({
          where: { id: userId },
          select: { avatarObjectKey: true },
        });

        await transaction.user.update({
          where: { id: userId },
          data: { avatar: uploaded.publicUrl, avatarObjectKey: uploaded.objectKey },
        });

        return current?.avatarObjectKey ?? null;
      });

      await this.deleteAvatarObject(userId, oldObjectKey);

      return { avatar: uploaded.publicUrl };
    } catch (error) {
      await this.deleteAvatarObject(userId, uploaded.objectKey);

      if (this.isSerializationConflict(error)) {
        throw this.avatarConcurrentUpdate();
      }

      throw error;
    }
  }

  async deleteAvatar(userId: string): Promise<void> {
    try {
      const oldObjectKey = await this.withAvatarTransaction(async (transaction) => {
        const current = await transaction.user.findUnique({
          where: { id: userId },
          select: { avatarObjectKey: true },
        });

        await transaction.user.update({
          where: { id: userId },
          data: { avatar: null, avatarObjectKey: null },
        });

        return current?.avatarObjectKey ?? null;
      });

      await this.deleteAvatarObject(userId, oldObjectKey);
    } catch (error) {
      if (this.isSerializationConflict(error)) {
        throw this.avatarConcurrentUpdate();
      }

      throw error;
    }
  }

  private maskPhone(phone: string): string {
    return /^\d{11}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : "****";
  }

  private passwordError(code: string, message: string, status: HttpStatus): ApiException {
    return new ApiException(code, message, status);
  }

  private isManagedAvatarObjectKey(userId: string, objectKey: string | null): objectKey is string {
    return objectKey?.startsWith(`public/admin-avatars/${userId}/`) ?? false;
  }

  private async withAvatarTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop -- serializable retries must complete in order.
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!this.isSerializationConflict(error) || attempt === 3) {
          throw error;
        }
      }
    }

    throw new Error("unreachable");
  }

  private isSerializationConflict(error: unknown): boolean {
    return (
      typeof error === "object" && error !== null && "code" in error && error.code === "P2034"
    );
  }

  private async deleteAvatarObject(userId: string, objectKey: string | null): Promise<void> {
    if (!this.isManagedAvatarObjectKey(userId, objectKey)) {
      return;
    }

    try {
      await this.avatarStorage.delete(objectKey);
    } catch {
      this.logger.write("error", "admin_account.avatar_cleanup_failed", { userId, objectKey });
    }
  }

  private avatarConcurrentUpdate(): ApiException {
    return new ApiException(
      ADMIN_ACCOUNT_ERROR_CODE.CONCURRENT_UPDATE,
      "头像已被其他操作更新，请刷新后重试",
      HttpStatus.CONFLICT,
    );
  }
}
