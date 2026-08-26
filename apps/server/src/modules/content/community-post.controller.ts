import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { MyCommunityPostListItem, MyCommunityPostListResponse } from "@petcare/shared-types";
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
  CreateCommunityPostDto,
  MyCommunityPostListItemDto,
  MyCommunityPostListQueryDto,
  MyCommunityPostListResponseDto,
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
  @ApiStandardErrors(400, 401, 403, 500)
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
}
