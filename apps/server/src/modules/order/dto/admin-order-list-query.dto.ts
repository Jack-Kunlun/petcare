import { ApiPropertyOptional } from "@nestjs/swagger";
import { ADMIN_ORDER_STATUS, ADMIN_ORDER_TYPE, ADMIN_SERVICE_TYPE } from "@petcare/shared-types";
import type {
  AdminOrderListQuery,
  AdminOrderStatus,
  AdminOrderType,
  AdminServiceType,
} from "@petcare/shared-types";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const orderTypes = Object.values(ADMIN_ORDER_TYPE);
const serviceTypes = Object.values(ADMIN_SERVICE_TYPE);
const orderStatuses = Object.values(ADMIN_ORDER_STATUS);

/** 校验并描述后台订单分页查询参数。 */
export class AdminOrderListQueryDto implements AdminOrderListQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ description: "订单号、用户手机号、用户昵称或宠物名" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;

  @ApiPropertyOptional({ enum: orderTypes })
  @IsOptional()
  @IsIn(orderTypes)
  orderType?: AdminOrderType;

  @ApiPropertyOptional({ enum: serviceTypes })
  @IsOptional()
  @IsIn(serviceTypes)
  serviceType?: AdminServiceType;

  @ApiPropertyOptional({
    enum: orderStatuses,
  })
  @IsOptional()
  @IsIn(orderStatuses)
  status?: AdminOrderStatus;
}
