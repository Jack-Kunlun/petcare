import { randomInt } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { MiniappUserProfile, WechatSession } from "@petcare/shared-types";
import { ApiException } from "../common/http/api-exception";
import { CANCELLED_ACCOUNT_DATA } from "../modules/user/cancelled-account";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "./token.service";
import { WechatApiClient } from "./wechat-api.client";

interface MiniappUserRecord {
  id: string;
  openid: string | null;
  phone: string | null;
  username: string | null;
  nickname: string;
  avatar: string | null;
  sessionVersion: number;
  userType: string;
  status: string;
  profile?: {
    address: string | null;
    bio: string | null;
  } | null;
  roles: Array<{ role: { roleName: string; isActive: boolean } }>;
}

const miniappUserSelect = {
  id: true,
  openid: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
  sessionVersion: true,
  userType: true,
  status: true,
  profile: {
    select: {
      address: true,
      bio: true,
    },
  },
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
export class WechatAuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly wechatApiClient: WechatApiClient,
    private readonly tokenService: TokenService,
  ) {}

  /** Signs in a Miniapp user and silently creates a default account when needed. */
  async login(loginCode: string): Promise<WechatSession> {
    const { openid } = await this.wechatApiClient.exchangeLoginCode(loginCode);
    let user = await this.prismaService.user.findUnique({
      where: { openid },
      select: miniappUserSelect,
    });

    if (user?.status === "inactive") {
      await this.releaseCancelledIdentity(user.id, openid);
      user = null;
    }

    if (!user) {
      try {
        user = await this.prismaService.$transaction((transaction) =>
          transaction.user.create({
            data: {
              openid,
              phone: null,
              nickname: this.createNickname(),
              userType: "pet_owner",
              status: "active",
            },
            select: miniappUserSelect,
          }),
        );
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }

        user = await this.prismaService.user.findUnique({
          where: { openid },
          select: miniappUserSelect,
        });

        if (!user) {
          throw error;
        }
      }
    }

    this.assertActive(user);

    return this.issueSession(user);
  }

  /** Rotates a valid refresh token and issues the current Miniapp session. */
  async refresh(refreshToken: string): Promise<WechatSession> {
    const { userId } = await this.tokenService.consumeRefresh(refreshToken);
    const user = await this.findSessionUser(userId);

    return this.issueSession(user);
  }

  /** Revokes a Miniapp refresh token so it cannot be reused. */
  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revoke(refreshToken);
  }

  private async releaseCancelledIdentity(userId: string, openid: string): Promise<void> {
    await this.prismaService.$transaction(async (transaction) => {
      const released = await transaction.user.updateMany({
        where: { id: userId, openid, status: "inactive" },
        data: CANCELLED_ACCOUNT_DATA,
      });

      if (released.count === 1) {
        await transaction.userProfile.deleteMany({ where: { userId } });
      }
    });
  }

  private async findSessionUser(userId: string): Promise<MiniappUserRecord> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: miniappUserSelect,
    });

    if (!user) {
      throw new ApiException(
        "AUTH_SESSION_EXPIRED",
        "登录状态已失效，请重新登录",
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.assertActive(user);

    return user;
  }

  private async issueSession(user: MiniappUserRecord): Promise<WechatSession> {
    const tokens = await this.tokenService.issue({
      userId: user.id,
      username: user.username,
      roles: user.roles
        .filter((assignment) => assignment.role.isActive)
        .map((assignment) => assignment.role.roleName),
      sessionVersion: user.sessionVersion,
    });

    return {
      ...tokens,
      user: this.toMiniappUser(user),
    };
  }

  private assertActive(user: MiniappUserRecord): void {
    if (user.status !== "active") {
      throw new ApiException(
        "AUTH_ACCOUNT_DISABLED",
        "账号已被停用，请联系管理员",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private toMiniappUser(user: MiniappUserRecord): MiniappUserProfile {
    return {
      id: user.id,
      phoneMasked: this.maskPhone(user.phone),
      profileComplete: user.phone !== null,
      nickname: user.nickname,
      avatar: user.avatar,
      userType: user.userType,
      region: user.profile?.address ?? null,
      bio: user.profile?.bio ?? null,
    };
  }

  private maskPhone(phone: string | null): string | null {
    if (!phone) {
      return null;
    }

    return /^\d{11}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : "****";
  }

  private createNickname(): string {
    return `宠友${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
