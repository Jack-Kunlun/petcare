import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AccessTokenPayload } from "./auth.types";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException("登录状态已失效");
    }

    const user = await this.authService.getCurrentUser(userId);

    if (!user.roles.includes("super_admin")) {
      throw new ForbiddenException("无权访问该后台功能");
    }

    return true;
  }
}
