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
import { lockUserRow } from "../../prisma/user-row-lock";
import type { DetectedAvatarFile } from "../../public-avatar-storage/avatar-file";
import {
  PUBLIC_AVATAR_STORAGE,
  type PublicAvatarStorage,
} from "../../public-avatar-storage/public-avatar-storage.types";
import { CANCELLED_ACCOUNT_DATA } from "./cancelled-account";

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

  /** Returns the authenticated Miniapp user's editable account profile. */
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

  /** Replaces the authenticated Miniapp user's editable text profile. */
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

  /** Sends a first-time phone-binding verification code for the active account. */
  async sendPhoneCode(userId: string, phone: string): Promise<void> {
    await this.requireUnboundAccount(userId);
    await this.verificationCodeService.send({
      phone,
      purpose: "miniapp_bind_phone",
      subject: userId,
    });
  }

  /** Sends an account-cancellation code to the user's bound phone when required. */
  async sendCancellationCode(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, status: true },
    });

    if (!user || user.status !== "active") {
      throw new ApiException(
        "AUTH_SESSION_EXPIRED",
        "登录状态已失效，请重新登录",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.phone === null) {
      throw this.cancellationCodeNotRequired();
    }

    if (await this.hasBlockingOrders(this.prisma.order, userId)) {
      throw this.activeOrderExists();
    }

    await this.verificationCodeService.send({
      phone: user.phone,
      purpose: "miniapp_cancel_account",
      subject: userId,
    });
  }

  /** Anonymizes and deactivates an eligible Miniapp account after any required verification. */
  async cancelAccount(userId: string, code?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, status: true },
    });

    if (!user || user.status !== "active") {
      throw new ApiException(
        "AUTH_SESSION_EXPIRED",
        "登录状态已失效，请重新登录",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (await this.hasBlockingOrders(this.prisma.order, userId)) {
      throw this.activeOrderExists();
    }

    if (user.phone === null) {
      if (code !== undefined) {
        throw this.cancellationCodeNotRequired();
      }
    } else {
      if (code === undefined) {
        throw this.cancellationCodeRequired();
      }

      if (!/^\d{6}$/u.test(code)) {
        throw this.verificationCodeInvalid();
      }

      const valid = await this.verificationCodeService.verifyAndConsume({
        phone: user.phone,
        code,
        purpose: "miniapp_cancel_account",
      });

      if (!valid) {
        throw this.verificationCodeInvalid();
      }
    }

    const avatarObjectKey = await this.withSerializableTransaction(async (transaction) => {
      const current = await lockUserRow(transaction, userId);

      if (current?.status !== "active") {
        throw new ApiException("AUTH_ACCOUNT_DISABLED", "账户已被停用", HttpStatus.FORBIDDEN);
      }

      if (current.phone !== user.phone) {
        throw current.phone === null
          ? this.cancellationCodeNotRequired()
          : this.cancellationCodeRequired();
      }

      if (await this.hasBlockingOrders(transaction.order, userId)) {
        throw this.activeOrderExists();
      }

      const avatar = await transaction.user.findUnique({
        where: { id: userId },
        select: { avatarObjectKey: true },
      });

      await transaction.userProfile.deleteMany({ where: { userId } });
      await transaction.user.update({
        where: { id: userId },
        data: CANCELLED_ACCOUNT_DATA,
      });

      return avatar?.avatarObjectKey ?? null;
    });

    await this.deleteAvatarObject(userId, avatarObjectKey);
  }

  /** Verifies and permanently binds the account's first phone number. */
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
        const current = await lockUserRow(transaction, userId);

        if (current?.status !== "active" || current.phone !== null) {
          throw this.phoneAlreadyBound();
        }

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

  /** Replaces the user's managed public avatar and removes the prior managed object. */
  async replaceAvatar(userId: string, file: DetectedAvatarFile): Promise<MiniappUserProfile> {
    const uploaded = await this.avatarStorage.upload({
      scope: "user-avatars",
      userId,
      ...file,
    });

    try {
      const oldObjectKey = await this.withSerializableTransaction(async (transaction) => {
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

  private async hasBlockingOrders(
    order: Prisma.TransactionClient["order"],
    userId: string,
  ): Promise<boolean> {
    const count = await order.count({
      where: {
        status: { in: [...ACTIVE_CANCELLATION_BLOCKING_STATUSES] },
        OR: [{ ownerId: userId }, { providerId: userId }],
      },
    });

    return count > 0;
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

  private async withSerializableTransaction<T>(
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

  private activeOrderExists(): ApiException {
    return new ApiException(
      MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS,
      "存在进行中的订单，暂时无法注销",
      HttpStatus.CONFLICT,
    );
  }

  private cancellationCodeNotRequired(): ApiException {
    return new ApiException(
      MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_NOT_REQUIRED,
      "当前账户未绑定手机号，无需验证码",
      HttpStatus.BAD_REQUEST,
    );
  }

  private cancellationCodeRequired(): ApiException {
    return new ApiException(
      MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_REQUIRED,
      "请输入账户注销验证码",
      HttpStatus.BAD_REQUEST,
    );
  }

  private verificationCodeInvalid(): ApiException {
    return new ApiException(
      MINIAPP_ACCOUNT_ERROR_CODE.VERIFICATION_CODE_INVALID,
      "验证码错误或已失效",
      HttpStatus.BAD_REQUEST,
    );
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
