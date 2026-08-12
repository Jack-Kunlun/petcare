import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "../../auth/auth.service";
import type { AccessTokenPayload } from "../../auth/auth.types";

/** Requires the current token subject to retain at least one active backend role. */
@Injectable()
export class ActiveAdministratorGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException("登录状态已失效");
    }

    const authorization = await this.authService.getCurrentUserAuthorization(userId);

    if (!authorization?.roles.length) {
      throw new ForbiddenException("当前账号不具备后台管理员权限");
    }

    return true;
  }
}
