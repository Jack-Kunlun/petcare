import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  AdminCommunityPostComment,
  AdminCommunityPostCommentListResponse,
  AdminCommunityPostReportResponse,
  AdminClassroomArticleDetail,
  AdminClassroomArticleListResponse,
  AdminContentPostDetail,
  AdminContentPostListResponse,
  UploadAdminClassroomArticleMediaResponse,
} from "@petcare/shared-types";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { WebsitePublicMediaAssetDto } from "../website-content/dto/website-media.dto";
import { validateWebsiteMediaFile } from "../website-content/media/website-media-file";
import { websiteContentInvalidMedia } from "../website-content/website-content.errors";
import { WebsiteMediaService } from "../website-content/website-media.service";
import { ClassroomArticleService } from "./classroom-article.service";
import { CommunityPostService } from "./community-post.service";
import { ContentService } from "./content.service";
import {
  AdminClassroomArticleStateDto,
  CreateAdminClassroomArticleDto,
  UpdateAdminClassroomArticleDto,
} from "./dto/admin-classroom-article.dto";
import { AdminContentPostStateDto } from "./dto/admin-community-post.dto";
import {
  AdminClassroomArticleListQueryDto,
  AdminContentPostListQueryDto,
} from "./dto/admin-content-query.dto";
import {
  AdminCommunityPostCommentOfflineDto,
  CommunityPostPaginationQueryDto,
} from "./dto/community-post.dto";
import {
  AdminClassroomArticleDetailDto,
  AdminClassroomArticleListResponseDto,
  AdminCommunityPostCommentDto,
  AdminCommunityPostCommentListResponseDto,
  AdminCommunityPostReportResponseDto,
  AdminContentPostDetailDto,
  AdminContentPostListResponseDto,
} from "./dto/content-response.dto";

type AuthRequest = Request & { user: AccessTokenPayload };
type MultipartFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

/** 提供内容域的后台查询、课堂文章编辑、发布和媒体上传接口。 */
@ApiTags("admin-content")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller("admin/content")
export class AdminContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly communityPosts: CommunityPostService,
    private readonly articleService: ClassroomArticleService,
    private readonly media: WebsiteMediaService,
  ) {}

  /** 返回后台社区帖子列表。 */
  @Get("posts")
  @RequirePermissions("content.post.read")
  @ApiOperation({ summary: "获取后台帖子列表" })
  @ApiSuccessResponse(AdminContentPostListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findPosts(@Query() query: AdminContentPostListQueryDto): Promise<AdminContentPostListResponse> {
    return this.contentService.findPostPage(query);
  }

  /** Returns full community post content and moderation history. */
  @Get("posts/:id")
  @RequirePermissions("content.post.read")
  @ApiOperation({ summary: "获取后台帖子详情" })
  @ApiSuccessResponse(AdminContentPostDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findPost(@Param("id") id: string): Promise<AdminContentPostDetail> {
    return this.contentService.findPostDetail(id);
  }

  /** Returns the reporter and reason context for one post. */
  @Get("posts/:id/reports")
  @RequirePermissions("content.post.report_read")
  @ApiOperation({ summary: "获取社区帖子举报记录" })
  @ApiSuccessResponse(AdminCommunityPostReportResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findPostReports(@Param("id") id: string): Promise<AdminCommunityPostReportResponse> {
    return this.communityPosts.findReportsForAdmin(id);
  }

  /** Returns every comment state and private commenter context to post moderators. */
  @Get("posts/:id/comments")
  @RequirePermissions("content.post.moderate_action")
  @ApiOperation({ summary: "获取社区帖子评论上下文" })
  @ApiSuccessResponse(AdminCommunityPostCommentListResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findPostComments(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query() query: CommunityPostPaginationQueryDto,
  ): Promise<AdminCommunityPostCommentListResponse> {
    return this.communityPosts.findCommentsForAdmin(id, query);
  }

  /** Idempotently removes one visible comment from public view. */
  @Post("posts/:postId/comments/:commentId/offline")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("content.post.moderate_action")
  @ApiOperation({ summary: "下架社区帖子评论" })
  @ApiSuccessResponse(AdminCommunityPostCommentDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  offlinePostComment(
    @Param("postId", new ParseUUIDPipe({ version: "4" })) postId: string,
    @Param("commentId", new ParseUUIDPipe({ version: "4" })) commentId: string,
    @Body() dto: AdminCommunityPostCommentOfflineDto,
  ): Promise<AdminCommunityPostComment> {
    return this.communityPosts.offlineComment(postId, commentId, dto);
  }

  /** Publishes one pending community post. */
  @Post("posts/:id/approve")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("content.post.moderate_action")
  @ApiOperation({ summary: "通过社区帖子审核" })
  @ApiSuccessResponse(AdminContentPostDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  approvePost(
    @Param("id") id: string,
    @Body() dto: AdminContentPostStateDto,
    @Req() request: AuthRequest,
  ): Promise<AdminContentPostDetail> {
    return this.contentService.approvePost(id, request.user.sub, dto);
  }

  /** Rejects one pending community post with a reason. */
  @Post("posts/:id/reject")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("content.post.moderate_action")
  @ApiOperation({ summary: "驳回社区帖子" })
  @ApiSuccessResponse(AdminContentPostDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  rejectPost(
    @Param("id") id: string,
    @Body() dto: AdminContentPostStateDto,
    @Req() request: AuthRequest,
  ): Promise<AdminContentPostDetail> {
    return this.contentService.rejectPost(id, request.user.sub, dto);
  }

  /** Takes one published community post offline with a reason. */
  @Post("posts/:id/offline")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("content.post.moderate_action")
  @ApiOperation({ summary: "下架社区帖子" })
  @ApiSuccessResponse(AdminContentPostDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  offlinePost(
    @Param("id") id: string,
    @Body() dto: AdminContentPostStateDto,
    @Req() request: AuthRequest,
  ): Promise<AdminContentPostDetail> {
    return this.contentService.offlinePost(id, request.user.sub, dto);
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
    return this.articleService.findArticlePage(query);
  }

  /** Validates and uploads one managed image for classroom article rich text. */
  @Post("articles/media-assets")
  @RequirePermissions("content.article.write_action")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({ summary: "上传课堂文章图片" })
  @ApiSuccessResponse(WebsitePublicMediaAssetDto)
  @ApiStandardErrors(400, 401, 403, 413, 503)
  async uploadArticleMedia(
    @UploadedFile() file: MultipartFile | undefined,
    @Req() request: AuthRequest,
  ): Promise<UploadAdminClassroomArticleMediaResponse> {
    if (!file) {
      throw websiteContentInvalidMedia("请选择要上传的图片");
    }

    const valid = await validateWebsiteMediaFile(file.buffer, file.originalname, file.mimetype);
    const asset = await this.media.upload(
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        operatorId: request.user.sub,
      },
      valid,
    );

    return asset.publicAsset;
  }

  /** Returns one classroom article for an authorized editor or publisher. */
  @Get("articles/:id")
  @RequirePermissions("content.article.write_action")
  @ApiOperation({ summary: "获取后台课堂文章详情" })
  @ApiSuccessResponse(AdminClassroomArticleDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findArticle(@Param("id") id: string): Promise<AdminClassroomArticleDetail> {
    return this.articleService.findAdminArticle(id);
  }

  /** Creates a new editable classroom article draft. */
  @Post("articles")
  @RequirePermissions("content.article.write_action")
  @ApiOperation({ summary: "新建课堂文章草稿" })
  @ApiSuccessResponse(AdminClassroomArticleDetailDto)
  @ApiStandardErrors(400, 401, 403, 500)
  createArticle(
    @Body() dto: CreateAdminClassroomArticleDto,
    @Req() request: AuthRequest,
  ): Promise<AdminClassroomArticleDetail> {
    return this.articleService.createDraft(request.user.sub, dto);
  }

  /** Updates a draft or offline classroom article. */
  @Put("articles/:id")
  @RequirePermissions("content.article.write_action")
  @ApiOperation({ summary: "编辑课堂文章" })
  @ApiSuccessResponse(AdminClassroomArticleDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  updateArticle(
    @Param("id") id: string,
    @Body() dto: UpdateAdminClassroomArticleDto,
  ): Promise<AdminClassroomArticleDetail> {
    return this.articleService.updateEditable(id, dto);
  }

  /** Publishes a draft or offline classroom article. */
  @Post("articles/:id/publish")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("content.article.publish_action")
  @ApiOperation({ summary: "发布课堂文章" })
  @ApiSuccessResponse(AdminClassroomArticleDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  publishArticle(
    @Param("id") id: string,
    @Body() dto: AdminClassroomArticleStateDto,
  ): Promise<AdminClassroomArticleDetail> {
    return this.articleService.publish(id, dto);
  }

  /** Takes a published classroom article offline. */
  @Post("articles/:id/offline")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("content.article.publish_action")
  @ApiOperation({ summary: "下线课堂文章" })
  @ApiSuccessResponse(AdminClassroomArticleDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  offlineArticle(
    @Param("id") id: string,
    @Body() dto: AdminClassroomArticleStateDto,
  ): Promise<AdminClassroomArticleDetail> {
    return this.articleService.offline(id, dto);
  }
}
