import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { CLASSROOM_ARTICLE_CATEGORY } from "@petcare/shared-types";
import type {
  ClassroomArticleCategory,
  PublicClassroomArticleDetail,
  PublicClassroomArticleListQuery,
  PublicClassroomArticleListResponse,
} from "@petcare/shared-types";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { ClassroomArticleService } from "./classroom-article.service";
import {
  PublicClassroomArticleDetailDto,
  PublicClassroomArticleListResponseDto,
} from "./dto/content-response.dto";

const classroomArticleCategories = Object.values(CLASSROOM_ARTICLE_CATEGORY);

/** Pagination input for publicly readable classroom articles. */
class PublicClassroomArticleListQueryDto implements PublicClassroomArticleListQuery {
  /** One-based result page. */
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  /** Number of results per page. */
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  /** Optional title, summary, or body search text. */
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;

  /** Optional exact controlled article category. */
  @ApiPropertyOptional({ enum: classroomArticleCategories })
  @IsOptional()
  @IsIn(classroomArticleCategories)
  category?: ClassroomArticleCategory;
}

/** Provides published classroom articles for unauthenticated official website visitors. */
@ApiTags("content")
@Controller("content/articles")
export class PublicContentController {
  constructor(private readonly articleService: ClassroomArticleService) {}

  /** Returns the public, published classroom article page. */
  @Get()
  @ApiOperation({ summary: "Get published classroom articles" })
  @ApiSuccessResponse(PublicClassroomArticleListResponseDto)
  @ApiStandardErrors(400, 500)
  findArticles(
    @Query() query: PublicClassroomArticleListQueryDto,
  ): Promise<PublicClassroomArticleListResponse> {
    return this.articleService.findPublishedArticlePage(query);
  }

  /** Returns one public, published classroom article by its stable ID route value. */
  @Get(":slug")
  @ApiOperation({ summary: "Get a published classroom article" })
  @ApiSuccessResponse(PublicClassroomArticleDetailDto)
  @ApiStandardErrors(400, 404, 500)
  findArticle(@Param("slug") slug: string): Promise<PublicClassroomArticleDetail> {
    return this.articleService.findPublishedArticleBySlug(slug);
  }
}
