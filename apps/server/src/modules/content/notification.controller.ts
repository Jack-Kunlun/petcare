import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import { NOTIFICATION_CATEGORY, NOTIFICATION_TYPE } from "@petcare/shared-types";
import type {
  NotificationCategory,
  NotificationListQuery,
  NotificationListResponse,
  NotificationReadAllResult,
  UserNotification,
} from "@petcare/shared-types";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { NotificationService } from "./notification.service";

const notificationCategories = Object.values(NOTIFICATION_CATEGORY);

type AuthRequest = Request & { user: AccessTokenPayload };

/** Validated pagination and category filter for notifications. */
export class NotificationListQueryDto implements NotificationListQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;

  @ApiPropertyOptional({ enum: notificationCategories })
  @IsOptional()
  @IsIn(notificationCategories)
  category?: NotificationCategory;
}

/** Recipient-safe notification response. */
class UserNotificationDto implements UserNotification {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ enum: Object.values(NOTIFICATION_TYPE) })
  type: UserNotification["type"];

  @ApiProperty({ enum: notificationCategories })
  category: NotificationCategory;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ format: "uuid", nullable: true })
  referenceId: string | null;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

/** Paginated notification response. */
class NotificationListResponseDto implements NotificationListResponse {
  @ApiProperty({ type: [UserNotificationDto] })
  list: UserNotificationDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

/** Mark-all-read result. */
class NotificationReadAllResultDto implements NotificationReadAllResult {
  @ApiProperty({ minimum: 0 })
  updatedCount: number;
}

/** Provides authenticated users with recipient-scoped notification reads and read commands. */
@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("notifications")
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  /** Returns notifications owned by the access-token subject. */
  @Get()
  @ApiOperation({ summary: "获取我的通知" })
  @ApiSuccessResponse(NotificationListResponseDto)
  @ApiStandardErrors(400, 401, 500)
  findMine(
    @Req() request: AuthRequest,
    @Query() query: NotificationListQueryDto,
  ): Promise<NotificationListResponse> {
    return this.notifications.findMine(request.user.sub, query);
  }

  /** Idempotently marks every notification owned by the access-token subject as read. */
  @Put("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "将我的全部通知标记为已读" })
  @ApiSuccessResponse(NotificationReadAllResultDto)
  @ApiStandardErrors(401, 500)
  markAllRead(@Req() request: AuthRequest): Promise<NotificationReadAllResult> {
    return this.notifications.markAllRead(request.user.sub);
  }

  /** Idempotently marks one owned notification as read. */
  @Put(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "将我的单条通知标记为已读" })
  @ApiSuccessResponse(UserNotificationDto)
  @ApiStandardErrors(400, 401, 404, 500)
  markRead(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<UserNotification> {
    return this.notifications.markRead(request.user.sub, id);
  }
}
