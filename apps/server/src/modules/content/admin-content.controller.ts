import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  AdminClassroomArticleListResponse,
  AdminContentPostListResponse,
  AdminContentRewardListResponse,
} from "@petcare/shared-types";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { ContentService } from "./content.service";
import {
  AdminClassroomArticleListQueryDto,
  AdminContentPostListQueryDto,
  AdminContentRewardListQueryDto,
} from "./dto/admin-content-query.dto";
import {
  AdminClassroomArticleListResponseDto,
  AdminContentPostListResponseDto,
  AdminContentRewardListResponseDto,
} from "./dto/content-response.dto";

/** 提供内容域的后台只读分页接口。 */
@ApiTags("admin-content")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller("admin/content")
export class AdminContentController {
  constructor(private readonly contentService: ContentService) {}

  /** 返回后台悬赏内容列表。 */
  @Get("rewards")
  @RequirePermissions("content.reward.read")
  @ApiOperation({ summary: "获取后台悬赏内容列表" })
  @ApiSuccessResponse(AdminContentRewardListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findRewards(
    @Query() query: AdminContentRewardListQueryDto,
  ): Promise<AdminContentRewardListResponse> {
    return this.contentService.findRewardPage(query);
  }

  /** 返回后台社区帖子列表。 */
  @Get("posts")
  @RequirePermissions("content.post.read")
  @ApiOperation({ summary: "获取后台帖子列表" })
  @ApiSuccessResponse(AdminContentPostListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findPosts(@Query() query: AdminContentPostListQueryDto): Promise<AdminContentPostListResponse> {
    return this.contentService.findPostPage(query);
  }

  /** 返回后台课堂文章列表。 */
  @Get("articles")
  @RequirePermissions("content.article.read")
  @ApiOperation({ summary: "获取后台课堂文章列表" })
  @ApiSuccessResponse(AdminClassroomArticleListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findArticles(
    @Query() query: AdminClassroomArticleListQueryDto,
  ): Promise<AdminClassroomArticleListResponse> {
    return this.contentService.findArticlePage(query);
  }
}
