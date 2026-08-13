import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionGuard } from "../../auth/permission.guard";
import { PERMISSIONS_METADATA_KEY } from "../../auth/permissions.decorator";
import { WebsiteContentAuditService } from "./website-content-audit.service";

type WebsiteContentRequest = {
  user?: { sub?: string };
  requestId?: string;
};

/** Adds best-effort Website Content audit recording around the shared central permission evaluator. */
@Injectable()
export class WebsiteContentPermissionGuard implements CanActivate {
  constructor(
    private readonly permissionGuard: PermissionGuard,
    private readonly audit: WebsiteContentAuditService,
    private readonly reflector: Reflector,
  ) {}

  /** Delegates authorization and records forbidden Website commands without altering their 403 result. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await this.permissionGuard.canActivate(context);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        await this.recordDenied(context).catch(() => undefined);
      }

      throw error;
    }
  }

  private async recordDenied(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest<WebsiteContentRequest>();
    const permissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const permissionCode = permissions?.join(",") ?? "website.unknown";

    await this.audit.record({
      operatorId: request.user?.sub ?? "unknown",
      action: "permission_denied",
      targetType: "website_content_permission",
      targetId: null,
      requestId: request.requestId ?? "unknown",
      result: {
        status: "denied",
        permissionCode,
        occurredAt: new Date().toISOString(),
      },
    });
  }
}
