import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  MINIAPP_ACCOUNT_ERROR_CODE,
  type MiniappUserProfile,
  type UpdateMiniappProfileRequest,
} from "@petcare/shared-types";
import { VerificationCodeService } from "../../auth/verification-code.service";
import { ApiException } from "../../common/http/api-exception";
import { Prisma } from "../../generated/prisma/client";
import { AppLogger } from "../../logging/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { DetectedAvatarFile } from "../../public-avatar-storage/avatar-file";
import {
  PUBLIC_AVATAR_STORAGE,
  type PublicAvatarStorage,
} from "../../public-avatar-storage/public-avatar-storage.types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- cancellation queries arrive in the next task.
const ACTIVE_CANCELLATION_BLOCKING_STATUSES = [
  "pending_confirm",
  "confirmed",
  "in_progress",
  "disputed",
] as const;

const miniappProfileSelect = {
  id: true,
  nickname: true,
  avatar: true,
  avatarObjectKey: true,
  phone: true,
  userType: true,
  status: true,
  profile: { select: { address: true, bio: true } },
} as const;

/** Owns the authenticated Miniapp user's editable account profile. */
@Injectable()
export class MiniappAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly logger: AppLogger,
    @Inject(PUBLIC_AVATAR_STORAGE) private readonly avatarStorage: PublicAvatarStorage,
  ) {}

  async getProfile(userId: string): Promise<MiniappUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: miniappProfileSelect,
    });

    if (!user) {
      throw new ApiException("RESOURCE_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
    }

    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      phoneMasked: this.maskPhone(user.phone),
      profileComplete: user.phone !== null,
      userType: user.userType,
      region: user.profile?.address ?? null,
      bio: user.profile?.bio ?? null,
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateMiniappProfileRequest,
  ): Promise<MiniappUserProfile> {
    const nickname = this.normalizeRequiredText(input.nickname, 24, "昵称");
    const region = this.normalizeOptionalText(input.region, 80, "所在地区");
    const bio = this.normalizeOptionalText(input.bio, 200, "个人简介");

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname,
        profile: {
          upsert: {
            create: { address: region, bio },
            update: { address: region, bio },
          },
        },
      },
    });

    return this.getProfile(userId);
  }

  async sendPhoneCode(userId: string, phone: string): Promise<void> {
    await this.requireUnboundAccount(userId);
    await this.verificationCodeService.send({
      phone,
      purpose: "miniapp_bind_phone",
      subject: userId,
    });
  }

  async bindPhone(userId: string, phone: string, code: string): Promise<MiniappUserProfile> {
    await this.requireUnboundAccount(userId);

    const valid = await this.verificationCodeService.verifyAndConsume({
      phone,
      code,
      purpose: "miniapp_bind_phone",
    });

    if (!valid) {
      throw new ApiException(
        MINIAPP_ACCOUNT_ERROR_CODE.VERIFICATION_CODE_INVALID,
        "验证码无效或已过期",
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        const result = await transaction.user.updateMany({
          where: { id: userId, phone: null, status: "active" },
          data: { phone },
        });

        if (result.count !== 1) {
          throw this.phoneAlreadyBound();
        }
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ApiException(
          MINIAPP_ACCOUNT_ERROR_CODE.PHONE_CONFLICT,
          "该手机号已绑定其他账户",
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }

    return this.getProfile(userId);
  }

  async replaceAvatar(userId: string, file: DetectedAvatarFile): Promise<MiniappUserProfile> {
    const uploaded = await this.avatarStorage.upload({
      scope: "user-avatars",
      userId,
      ...file,
    });

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
    } catch (error) {
      await this.deleteAvatarObject(userId, uploaded.objectKey);

      if (this.isSerializationConflict(error)) {
        throw new ApiException(
          "ACCOUNT_CONCURRENT_UPDATE",
          "头像已被其他操作更新，请刷新后重试",
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }

    return this.getProfile(userId);
  }

  private async requireUnboundAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user) {
      throw new ApiException("RESOURCE_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
    }

    if (user.phone !== null) {
      throw this.phoneAlreadyBound();
    }
  }

  private normalizeRequiredText(value: string, maxLength: number, field: string): string {
    const normalized = value.trim();

    if (!normalized || normalized.length > maxLength || /\p{Cc}/u.test(normalized)) {
      throw new ApiException("VALIDATION_FAILED", `${field}格式无效`, HttpStatus.BAD_REQUEST);
    }

    return normalized;
  }

  private normalizeOptionalText(
    value: string | null,
    maxLength: number,
    field: string,
  ): string | null {
    if (value === null || value.trim() === "") {
      return null;
    }

    return this.normalizeRequiredText(value, maxLength, field);
  }

  private maskPhone(phone: string | null): string | null {
    if (!phone) {
      return null;
    }

    return /^\d{11}$/u.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : "****";
  }

  private phoneAlreadyBound(): ApiException {
    return new ApiException(
      MINIAPP_ACCOUNT_ERROR_CODE.PHONE_ALREADY_BOUND,
      "当前账户已绑定手机号",
      HttpStatus.CONFLICT,
    );
  }

  private isUniqueConflict(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
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
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
  }

  private isManagedAvatarObjectKey(userId: string, objectKey: string | null): objectKey is string {
    return objectKey?.startsWith(`public/user-avatars/${userId}/`) ?? false;
  }

  private async deleteAvatarObject(userId: string, objectKey: string | null): Promise<void> {
    if (!this.isManagedAvatarObjectKey(userId, objectKey)) {
      return;
    }

    try {
      await this.avatarStorage.delete(objectKey);
    } catch {
      this.logger.write("error", "miniapp_account.avatar_cleanup_failed", {
        userId,
        objectKey,
      });
    }
  }
}
