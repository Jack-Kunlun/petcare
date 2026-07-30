import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessTokenPayload } from "./auth.types";

/** 允许普通管理员处理投诉纠纷的权限代码。 */
export const DISPUTE_RESOLVE_PERMISSION_CODE = "dispute.resolve";

@Injectable()
export class DisputeResolverGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  /** 校验当前账号仍有效且拥有纠纷裁决权限或超级管理员角色。 */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException("登录状态已失效");
    }

    const administrator = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: "active",
        roles: {
          some: {
            role: {
              isActive: true,
              OR: [
                { roleName: "super_admin" },
                {
                  permissions: {
                    some: {
                      permission: {
                        permissionCode: DISPUTE_RESOLVE_PERMISSION_CODE,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      select: {
        id: true,
        roles: {
          where: { role: { isActive: true } },
          select: { role: { select: { roleName: true } } },
        },
      },
    });

    if (!administrator) {
      throw new ForbiddenException("无权处理投诉纠纷");
    }

    request.user!.roles = administrator.roles.map((assignment) => assignment.role.roleName);

    return true;
  }
}
