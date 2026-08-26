import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import type {
  PublicCommunityPostComment,
  PublicCommunityPostCommentListResponse,
  CommunityPostLikeState,
  CommunityPostReportReceipt,
  MyCommunityPostListItem,
  MyCommunityPostListResponse,
  PublicCommunityPostDetail,
  PublicCommunityPostListResponse,
} from "@petcare/shared-types";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { CommunityPostService } from "./community-post.service";
import {
  CommunityPostLikeStateDto,
  CommunityPostReportReceiptDto,
  CreateCommunityPostCommentDto,
  CreateCommunityPostReportDto,
  CreateCommunityPostDto,
  MyCommunityPostListItemDto,
  MyCommunityPostListQueryDto,
  MyCommunityPostListResponseDto,
  PublicCommunityPostDetailDto,
  PublicCommunityPostCommentDto,
  PublicCommunityPostCommentListResponseDto,
  PublicCommunityPostListQueryDto,
  PublicCommunityPostListResponseDto,
} from "./dto/community-post.dto";

type AuthRequest = Request & { user: AccessTokenPayload };

/** Provides authenticated community submission and author-only moderation status reads. */
@ApiTags("community")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ProfileCompleteGuard)
@Controller("community/posts")
export class CommunityPostController {
  constructor(private readonly posts: CommunityPostService) {}

  /** Submits one community post into the pending moderation queue. */
  @Post()
  @ApiOperation({ summary: "提交待审核社区动态" })
  @ApiSuccessResponse(MyCommunityPostListItemDto, { status: 201 })
  @ApiStandardErrors(400, 401, 403, 429, 500, 503)
  create(
    @Req() request: AuthRequest,
    @Body() dto: CreateCommunityPostDto,
  ): Promise<MyCommunityPostListItem> {
    return this.posts.create(request.user.sub, dto);
  }

  /** Lists only the current author's posts and moderation outcomes. */
  @Get("mine")
  @ApiOperation({ summary: "获取我的社区动态" })
  @ApiSuccessResponse(MyCommunityPostListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findMine(
    @Req() request: AuthRequest,
    @Query() query: MyCommunityPostListQueryDto,
  ): Promise<MyCommunityPostListResponse> {
    return this.posts.findMine(request.user.sub, query);
  }

  /** Lists visible comments and marks comments owned by the authenticated viewer. */
  @Get(":id/comments")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "获取社区动态评论及当前用户删除权限" })
  @ApiSuccessResponse(PublicCommunityPostCommentListResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findComments(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query() query: PublicCommunityPostListQueryDto,
  ): Promise<PublicCommunityPostCommentListResponse> {
    return this.posts.findPublishedComments(id, query, request.user.sub);
  }

  /** Publishes one plain-text comment below a published post. */
  @Post(":id/comments")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "发表评论" })
  @ApiSuccessResponse(PublicCommunityPostCommentDto, { status: 201 })
  @ApiStandardErrors(400, 401, 403, 404, 500)
  createComment(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CreateCommunityPostCommentDto,
  ): Promise<PublicCommunityPostComment> {
    return this.posts.createComment(request.user.sub, id, dto);
  }

  /** Idempotently deletes one comment owned by the authenticated commenter. */
  @Delete(":postId/comments/:commentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除自己的评论" })
  @ApiNoContentResponse({ description: "社区评论已删除" })
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  deleteOwnComment(
    @Req() request: AuthRequest,
    @Param("postId", new ParseUUIDPipe({ version: "4" })) postId: string,
    @Param("commentId", new ParseUUIDPipe({ version: "4" })) commentId: string,
  ): Promise<void> {
    return this.posts.deleteOwnComment(request.user.sub, postId, commentId);
  }

  /** Returns the current user's like state for one published post. */
  @Get(":id/like")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "获取社区动态点赞状态" })
  @ApiSuccessResponse(CommunityPostLikeStateDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  findLikeState(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<CommunityPostLikeState> {
    return this.posts.findLikeState(request.user.sub, id);
  }

  /** Idempotently likes one published post. */
  @Put(":id/like")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "点赞社区动态" })
  @ApiSuccessResponse(CommunityPostLikeStateDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  like(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<CommunityPostLikeState> {
    return this.posts.like(request.user.sub, id);
  }

  /** Idempotently removes the current user's like from one published post. */
  @Delete(":id/like")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "取消点赞社区动态" })
  @ApiSuccessResponse(CommunityPostLikeStateDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  unlike(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<CommunityPostLikeState> {
    return this.posts.unlike(request.user.sub, id);
  }

  /** Reports one currently published community post. */
  @Post(":id/reports")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "举报已发布社区动态" })
  @ApiSuccessResponse(CommunityPostReportReceiptDto, { status: 201 })
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  report(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: CreateCommunityPostReportDto,
  ): Promise<CommunityPostReportReceipt> {
    return this.posts.report(request.user.sub, id, dto);
  }

  /** Soft-deletes one post owned by the current author. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "删除自己的社区动态" })
  @ApiNoContentResponse({ description: "社区动态已删除" })
  @ApiStandardErrors(400, 401, 403, 404, 500)
  deleteOwn(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<void> {
    return this.posts.deleteOwn(request.user.sub, id);
  }
}

/** Provides published community posts without authentication or private account fields. */
@ApiTags("content")
@Controller("content/community-posts")
export class PublicCommunityPostController {
  constructor(private readonly posts: CommunityPostService) {}

  /** Returns a page of published community posts. */
  @Get()
  @ApiOperation({ summary: "获取已发布社区动态" })
  @ApiSuccessResponse(PublicCommunityPostListResponseDto)
  @ApiStandardErrors(400, 500)
  findPublished(
    @Query() query: PublicCommunityPostListQueryDto,
  ): Promise<PublicCommunityPostListResponse> {
    return this.posts.findPublished(query);
  }

  /** Returns one published post and hides every non-public lifecycle state. */
  @Get(":id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "获取已发布社区动态详情" })
  @ApiSuccessResponse(PublicCommunityPostDetailDto)
  @ApiStandardErrors(400, 404, 500)
  findPublishedById(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<PublicCommunityPostDetail> {
    return this.posts.findPublishedById(id);
  }

  /** Returns visible comments for one published post without private account fields. */
  @Get(":id/comments")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "获取已发布社区动态评论" })
  @ApiSuccessResponse(PublicCommunityPostCommentListResponseDto)
  @ApiStandardErrors(400, 404, 500)
  findPublishedComments(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query() query: PublicCommunityPostListQueryDto,
  ): Promise<PublicCommunityPostCommentListResponse> {
    return this.posts.findPublishedComments(id, query);
  }
}
