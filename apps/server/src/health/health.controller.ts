import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardErrors, ApiSuccessResponse } from "../common/swagger/api-response.decorators";
import { HealthResponseDto } from "./dto/health-response.dto";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "检查服务健康状态" })
  @ApiSuccessResponse(HealthResponseDto)
  @ApiStandardErrors(500)
  check(): HealthResponseDto {
    return { status: "ok" };
  }
}
