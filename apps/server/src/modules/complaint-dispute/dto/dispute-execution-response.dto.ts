import { ApiProperty } from "@nestjs/swagger";
import {
  DECISION_LEVEL,
  DISPUTE_EXECUTION_TASK_STATUS,
  DISPUTE_EXECUTION_TASK_TYPE,
  type DecisionLevel,
  type DisputeExecutionTaskListResponse,
  type DisputeExecutionTaskStatus,
  type DisputeExecutionTaskType,
  type DisputeExecutionTaskView,
  type RetryDisputeExecutionTaskResponse,
} from "@petcare/shared-types";

/** 裁决执行任务的 Swagger 响应模型。 */
export class DisputeExecutionTaskResponseDto implements DisputeExecutionTaskView {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty({ format: "uuid" }) complaintId: string;
  @ApiProperty({ enum: Object.values(DECISION_LEVEL) }) decisionLevel: DecisionLevel;
  @ApiProperty({ enum: Object.values(DISPUTE_EXECUTION_TASK_TYPE) })
  taskType: DisputeExecutionTaskType;
  @ApiProperty({ enum: Object.values(DISPUTE_EXECUTION_TASK_STATUS) })
  status: DisputeExecutionTaskStatus;
  @ApiProperty({ nullable: true }) failureReason: string | null;
  @ApiProperty({ minimum: 0 }) retryCount: number;
  @ApiProperty({ format: "date-time", nullable: true }) nextRetryAt: string | null;
  @ApiProperty({ format: "date-time", nullable: true }) completedAt: string | null;
  @ApiProperty({ format: "date-time" }) createdAt: string;
  @ApiProperty({ format: "date-time" }) updatedAt: string;
}

/** 裁决执行任务分页列表的 Swagger 响应模型。 */
export class DisputeExecutionTaskListResponseDto implements DisputeExecutionTaskListResponse {
  @ApiProperty({ type: [DisputeExecutionTaskResponseDto] })
  list: DisputeExecutionTaskResponseDto[];
  @ApiProperty({ minimum: 0 }) total: number;
  @ApiProperty({ minimum: 1 }) page: number;
  @ApiProperty({ minimum: 1 }) pageSize: number;
}

/** 管理员重试裁决执行任务后的 Swagger 响应模型。 */
export class RetryDisputeExecutionTaskResponseDto
  extends DisputeExecutionTaskResponseDto
  implements RetryDisputeExecutionTaskResponse {}
