import { CanActivate, ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { MINIAPP_ACCOUNT_ERROR_CODE } from "@petcare/shared-types";
import { ApiException } from "../common/http/api-exception";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessTokenPayload } from "./auth.types";

@Injectable()
export class ProfileCompleteGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const userId = request.user?.sub;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { phone: true, status: true },
        })
      : null;

    if (!userId || !user || user.status !== "active") {
      throw new ApiException(
        "AUTH_SESSION_EXPIRED",
        "登录状态已失效，请重新登录",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.phone) {
      throw new ApiException(
        MINIAPP_ACCOUNT_ERROR_CODE.PROFILE_INCOMPLETE,
        "请先完善手机号",
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
