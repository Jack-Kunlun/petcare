import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors, ApiSuccessResponse } from "../common/swagger/api-response.decorators";
import { RedisService } from "../config/redis.service";
import { PrismaService } from "../prisma/prisma.service";
import { HealthResponseDto } from "./dto/health-response.dto";

@ApiTags("health")
@Controller("ready")
export class ReadinessController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: "检查服务依赖就绪状态" })
  @ApiSuccessResponse(HealthResponseDto)
  @ApiStandardErrors(500)
  async check(): Promise<HealthResponseDto> {
    await Promise.all([this.prisma.$queryRaw`SELECT 1 AS ready`, this.redis.getClient().ping()]);

    return { status: "ok" };
  }
}
