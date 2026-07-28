import { createHash, randomBytes } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { MiniappUser, WechatLoginResult, WechatSession } from "@petcare/shared-types";
import { ApiException } from "../common/http/api-exception";
import { RedisService } from "../config/redis.service";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "./token.service";
import { WechatApiClient } from "./wechat-api.client";

interface MiniappUserRecord {
  id: string;
  openid: string | null;
  phone: string;
  username: string | null;
  nickname: string;
  avatar: string | null;
  userType: string;
  status: string;
  roles: Array<{ role: { roleName: string; isActive: boolean } }>;
}

const BIND_TOKEN_TTL_SECONDS = 300;
const miniappUserSelect = {
  id: true,
  openid: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
  userType: true,
  status: true,
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
    private readonly redisService: RedisService,
    private readonly wechatApiClient: WechatApiClient,
    private readonly tokenService: TokenService,
  ) {}

  async login(loginCode: string): Promise<WechatLoginResult> {
    const { openid } = await this.wechatApiClient.exchangeLoginCode(loginCode);
    const user = await this.prismaService.user.findUnique({
      where: { openid },
      select: miniappUserSelect,
    });

    if (user) {
      this.assertActive(user);

      return {
        status: "authenticated",
        ...(await this.issueSession(user)),
      };
    }

    const bindToken = randomBytes(32).toString("base64url");

    await this.redisService.set(this.bindTokenKey(bindToken), openid, BIND_TOKEN_TTL_SECONDS);

    return { status: "phone_required", bindToken };
  }

  async bindPhone(bindToken: string, phoneCode: string): Promise<WechatSession> {
    const phone = await this.wechatApiClient.getPhoneNumber(phoneCode);
    const openid = await this.redisService.getAndDelete(this.bindTokenKey(bindToken));

    if (!openid) {
      throw new ApiException(
        "AUTH_BIND_TOKEN_EXPIRED",
        "登录状态已过期，请重新登录",
        HttpStatus.UNAUTHORIZED,
      );
    }

    let user: MiniappUserRecord;

    try {
      user = await this.prismaService.$transaction(async (transaction) => {
        const [openidUser, phoneUser] = await Promise.all([
          transaction.user.findUnique({
            where: { openid },
            select: miniappUserSelect,
          }),
          transaction.user.findUnique({
            where: { phone },
            select: miniappUserSelect,
          }),
        ]);

        if (openidUser) {
          this.assertActive(openidUser);
        }

        if (phoneUser) {
          this.assertActive(phoneUser);
        }

        if (openidUser && phoneUser && openidUser.id !== phoneUser.id) {
          throw this.accountConflict();
        }

        if (openidUser) {
          if (openidUser.phone !== phone) {
            throw this.accountConflict();
          }

          return openidUser;
        }

        if (phoneUser) {
          if (phoneUser.openid && phoneUser.openid !== openid) {
            throw this.accountConflict();
          }

          if (!phoneUser.openid) {
            return transaction.user.update({
              where: { id: phoneUser.id },
              data: { openid },
              select: miniappUserSelect,
            });
          }

          return phoneUser;
        }

        return transaction.user.create({
          data: {
            openid,
            phone,
            nickname: `宠友${phone.slice(-4)}`,
            userType: "pet_owner",
            status: "active",
          },
          select: miniappUserSelect,
        });
      });
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      if (this.isUniqueConstraintError(error)) {
        throw this.accountConflict();
      }

      throw error;
    }

    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<WechatSession> {
    const { userId } = await this.tokenService.consumeRefresh(refreshToken);
    const user = await this.findSessionUser(userId);

    return this.issueSession(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revoke(refreshToken);
  }

  async getCurrentUser(userId: string): Promise<MiniappUser> {
    return this.toMiniappUser(await this.findSessionUser(userId));
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
      phone: user.phone,
      roles: user.roles
        .filter((assignment) => assignment.role.isActive)
        .map((assignment) => assignment.role.roleName),
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

  private toMiniappUser(user: MiniappUserRecord): MiniappUser {
    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      userType: user.userType,
    };
  }

  private bindTokenKey(bindToken: string): string {
    const digest = createHash("sha256").update(bindToken).digest("hex");

    return `auth:wechat-bind:${digest}`;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }

  private accountConflict(): ApiException {
    return new ApiException(
      "AUTH_ACCOUNT_CONFLICT",
      "该微信或手机号已绑定其他账号，请联系管理员",
      HttpStatus.CONFLICT,
    );
  }
}
