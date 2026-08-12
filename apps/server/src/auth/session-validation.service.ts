import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SessionValidationService {
  constructor(private readonly prismaService: PrismaService) {}

  async assertActiveVersion(userId: string, sessionVersion: number): Promise<void> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { status: true, sessionVersion: true },
    });

    if (!user || user.status !== "active" || user.sessionVersion !== sessionVersion) {
      throw new ApiException("AUTH_SESSION_EXPIRED", "登录状态已失效", HttpStatus.UNAUTHORIZED);
    }
  }
}
