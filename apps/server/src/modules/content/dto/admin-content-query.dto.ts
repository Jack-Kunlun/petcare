import { ApiPropertyOptional } from "@nestjs/swagger";
import { ADMIN_CLASSROOM_ARTICLE_STATUS, ADMIN_CONTENT_POST_STATUS } from "@petcare/shared-types";
import type {
  AdminClassroomArticleListQuery,
  AdminClassroomArticleStatus,
  AdminContentPostListQuery,
  AdminContentPostStatus,
} from "@petcare/shared-types";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const postStatuses = Object.values(ADMIN_CONTENT_POST_STATUS);
const articleStatuses = Object.values(ADMIN_CLASSROOM_ARTICLE_STATUS);

/** 通用的内容分页字段。 */
abstract class ContentPaginationQuery {
  /** 页码，从 1 开始。 */
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  /** 每页条数，范围为 1 至 100。 */
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  /** 匹配内容标题、作者或正文的关键词。 */
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;
}

/** 后台帖子分页查询参数。 */
export class AdminContentPostListQueryDto
  extends ContentPaginationQuery
  implements AdminContentPostListQuery
{
  /** 帖子状态筛选。 */
  @ApiPropertyOptional({ enum: postStatuses })
  @IsOptional()
  @IsIn(postStatuses)
  status?: AdminContentPostStatus;
}

/** 后台课堂文章分页查询参数。 */
export class AdminClassroomArticleListQueryDto
  extends ContentPaginationQuery
  implements AdminClassroomArticleListQuery
{
  /** 文章状态筛选。 */
  @ApiPropertyOptional({ enum: articleStatuses })
  @IsOptional()
  @IsIn(articleStatuses)
  status?: AdminClassroomArticleStatus;
}
