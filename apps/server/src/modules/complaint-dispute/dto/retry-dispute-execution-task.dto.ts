import { ApiProperty } from "@nestjs/swagger";
import type { RetryDisputeExecutionTaskRequest } from "@petcare/shared-types";
import { IsInt, Min } from "class-validator";

/** 校验管理员重试裁决执行任务时提交的并发版本。 */
export class RetryDisputeExecutionTaskDto implements RetryDisputeExecutionTaskRequest {
  /** 客户端读取投诉详情时获得的并发版本。 */
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}
