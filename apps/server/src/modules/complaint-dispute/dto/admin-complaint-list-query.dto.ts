import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  COMPLAINT_QUEUE,
  COMPLAINT_STATUS,
  type AdminComplaintQueue,
  type AdminComplaintListQuery,
  type ComplaintStatus,
} from "@petcare/shared-types";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

const COMPLAINT_STATUSES = Object.values(COMPLAINT_STATUS);
const COMPLAINT_QUEUES = Object.values(COMPLAINT_QUEUE);

/** 校验并描述后台投诉案件分页筛选参数。 */
export class AdminComplaintListQueryDto implements AdminComplaintListQuery {
  /** 从 1 开始的页码。 */
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  /** 每页返回的案件数量。 */
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  /** 当前选择的后台投诉工作队列。 */
  @ApiPropertyOptional({ enum: COMPLAINT_QUEUES, default: COMPLAINT_QUEUE.MINE })
  @IsOptional()
  @IsIn(COMPLAINT_QUEUES)
  queue: AdminComplaintQueue = COMPLAINT_QUEUE.MINE;

  /** 可选的投诉状态筛选值。 */
  @ApiPropertyOptional({ enum: COMPLAINT_STATUSES })
  @IsOptional()
  @IsIn(COMPLAINT_STATUSES)
  status?: ComplaintStatus;

  /** 可选的订单或当事人搜索关键词。 */
  @ApiPropertyOptional({ description: "订单号或当事人关键词", maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  keyword?: string;

  /** 可选的当前处理管理员唯一标识。 */
  @ApiPropertyOptional({ description: "当前处理管理员唯一标识", format: "uuid" })
  @IsOptional()
  @IsUUID()
  handlerId?: string;
}
