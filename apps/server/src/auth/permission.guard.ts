import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { AccessTokenPayload } from "./auth.types";
import { PERMISSIONS_METADATA_KEY } from "./permissions.decorator";

/** 按路由声明的权限代码校验当前后台管理员授权。 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  /** 校验当前管理员是否拥有路由声明的全部权限。 */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException("登录状态已失效");
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const authorization = await this.authService.getCurrentUserAuthorization(userId);
    const permissionSet = new Set(authorization?.permissions);

    if (!authorization || !requiredPermissions.every((code) => permissionSet.has(code))) {
      throw new ForbiddenException("缺少所需操作权限");
    }

    return true;
  }
}
