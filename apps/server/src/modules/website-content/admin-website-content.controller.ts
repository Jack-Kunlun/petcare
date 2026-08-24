import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import type {
  PublishWebsiteContentResponse,
  WebsiteContentDiffResponse,
  WebsiteContentDraftResponse,
  WebsiteContentHistoryResponse,
  WebsiteContentKey,
  WebsiteContentOverviewResponse,
  WebsiteMediaListResponse,
  WebsiteMediaAsset,
} from "@petcare/shared-types";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { type AccessTokenPayload } from "../../auth/auth.types";
import { RequirePermissions } from "../../auth/permissions.decorator";
import type { RequestWithId } from "../../common/http/api-response.types";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import {
  CreateWebsitePreviewDto,
  CreateWebsitePreviewResponseDto,
  PublishWebsiteContentDto,
  PublishWebsiteContentResponseDto,
  RestoreWebsiteContentDto,
  SaveWebsiteContentDraftDto,
  WebsiteContentDiffItemDto,
  WebsiteContentHistoryQueryDto,
  WebsiteContentHistoryResponseDto,
  WebsiteContentOverviewItemDto,
  WebsiteContentVersionResponseDto,
} from "./dto/admin-website-content.dto";
import {
  WebsiteMediaAssetResponseDto,
  WebsiteMediaListQueryDto,
  WebsiteMediaListResponseDto,
} from "./dto/website-media.dto";
import { validateWebsiteMediaFile } from "./media/website-media-file";
import { WebsiteContentDiffService } from "./website-content-diff.service";
import { WebsiteContentDraftService } from "./website-content-draft.service";
import { WebsiteContentHistoryService } from "./website-content-history.service";
import { WebsiteContentPermissionGuard } from "./website-content-permission.guard";
import { WebsiteContentPublishingService } from "./website-content-publishing.service";
import { WebsiteContentRepository } from "./website-content.repository";
import { WebsiteMediaService } from "./website-media.service";
import { WebsitePreviewService } from "./website-preview.service";

type AuthRequest = RequestWithId & Request & { user?: AccessTokenPayload };
type MultipartFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

/** Provides the fixed, permission-separated Admin Website Content management API. */
@ApiTags("Admin Website Content")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, WebsiteContentPermissionGuard)
@Controller("admin/website-content")
export class AdminWebsiteContentController {
  constructor(
    private readonly repository: WebsiteContentRepository,
    private readonly drafts: WebsiteContentDraftService,
    private readonly diffs: WebsiteContentDiffService,
    private readonly history: WebsiteContentHistoryService,
    private readonly publishing: WebsiteContentPublishingService,
    private readonly previews: WebsitePreviewService,
    private readonly media: WebsiteMediaService,
  ) {}

  /** Lists the fixed Website Content units and their independent publication state. */
  @Get()
  @RequirePermissions("website.read")
  @ApiOperation({ summary: "List Website Content overview" })
  @ApiSuccessResponse(WebsiteContentOverviewItemDto, { isArray: true })
  @ApiStandardErrors(401, 403, 500)
  getOverview(): Promise<WebsiteContentOverviewResponse> {
    return this.repository.getOverview();
  }

  /** Reads the current immutable draft for one fixed content unit. */
  @Get(":contentKey/draft")
  @RequirePermissions("website.read")
  @ApiParam({ name: "contentKey" })
  @ApiOperation({ summary: "Read Website Content draft" })
  @ApiSuccessResponse(WebsiteContentVersionResponseDto)
  @ApiStandardErrors(401, 403, 404, 500)
  getDraft(
    @Param("contentKey") contentKey: WebsiteContentKey,
  ): Promise<WebsiteContentDraftResponse> {
    return this.drafts.getDraft(contentKey);
  }

  /** Saves a full new immutable draft snapshot. */
  @Put(":contentKey/draft")
  @RequirePermissions("website.edit_action")
  @ApiParam({ name: "contentKey" })
  @ApiOperation({ summary: "Save Website Content draft" })
  @ApiSuccessResponse(WebsiteContentVersionResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  saveDraft(
    @Param("contentKey") contentKey: WebsiteContentKey,
    @Body() dto: SaveWebsiteContentDraftDto,
    @Req() request: AuthRequest,
  ): Promise<WebsiteContentDraftResponse> {
    return this.drafts.saveDraft({
      ...dto,
      contentKey,
      operatorId: this.operatorId(request),
      requestId: this.requestId(request),
    });
  }

  /** Returns stable field-level differences between current draft and published content. */
  @Get(":contentKey/diff")
  @RequirePermissions("website.read")
  @ApiParam({ name: "contentKey" })
  @ApiOperation({ summary: "Compare Website Content draft and published snapshot" })
  @ApiSuccessResponse(WebsiteContentDiffItemDto, { isArray: true })
  @ApiStandardErrors(401, 403, 404, 500)
  getDiff(@Param("contentKey") contentKey: WebsiteContentKey): Promise<WebsiteContentDiffResponse> {
    return this.diffs.diffDraftFromPublished(contentKey);
  }

  /** Lists published immutable history for one content unit. */
  @Get(":contentKey/history")
  @RequirePermissions("website.read")
  @ApiParam({ name: "contentKey" })
  @ApiOperation({ summary: "List Website Content publish history" })
  @ApiSuccessResponse(WebsiteContentHistoryResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  getHistory(
    @Param("contentKey") contentKey: WebsiteContentKey,
    @Query() query: WebsiteContentHistoryQueryDto,
  ): Promise<WebsiteContentHistoryResponse> {
    return this.history.listHistory(contentKey, query);
  }

  /** Reads one immutable historical published snapshot. */
  @Get(":contentKey/history/:versionId")
  @RequirePermissions("website.read")
  @ApiParam({ name: "contentKey" })
  @ApiParam({ name: "versionId" })
  @ApiOperation({ summary: "Read Website Content history version" })
  @ApiSuccessResponse(WebsiteContentVersionResponseDto)
  @ApiStandardErrors(401, 403, 404, 500)
  getHistoryVersion(
    @Param("contentKey") contentKey: WebsiteContentKey,
    @Param("versionId") versionId: string,
  ): Promise<WebsiteContentDraftResponse> {
    return this.history.getHistoryVersion(contentKey, versionId);
  }

  /** Creates a short-lived capability pinned to the currently saved draft revision. */
  @Post(":contentKey/previews")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("website.edit_action")
  @ApiParam({ name: "contentKey" })
  @ApiOperation({ summary: "Create fixed-revision Website Content preview" })
  @ApiSuccessResponse(CreateWebsitePreviewResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  createPreview(
    @Param("contentKey") contentKey: WebsiteContentKey,
    @Body() dto: CreateWebsitePreviewDto,
    @Req() request: AuthRequest,
  ) {
    return this.previews.createPreview({
      contentKey,
      revision: dto.revision,
      operatorId: this.operatorId(request),
      requestId: this.requestId(request),
    });
  }

  /** Explicitly publishes one saved content unit using an idempotency key. */
  @Post(":contentKey/publish")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("website.publish_action")
  @ApiParam({ name: "contentKey" })
  @ApiOperation({ summary: "Publish Website Content draft" })
  @ApiSuccessResponse(PublishWebsiteContentResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500, 503)
  publish(
    @Param("contentKey") contentKey: WebsiteContentKey,
    @Body() dto: PublishWebsiteContentDto,
    @Req() request: AuthRequest,
  ): Promise<PublishWebsiteContentResponse> {
    return this.publishing.publish({
      ...dto,
      contentKey,
      operatorId: this.operatorId(request),
      requestId: this.requestId(request),
    });
  }

  /** Copies a selected history version into a new draft without publishing it. */
  @Post(":contentKey/restore")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("website.publish_action")
  @ApiParam({ name: "contentKey" })
  @ApiOperation({ summary: "Restore Website Content history as a draft" })
  @ApiSuccessResponse(WebsiteContentVersionResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  restore(
    @Param("contentKey") contentKey: WebsiteContentKey,
    @Body() dto: RestoreWebsiteContentDto,
    @Req() request: AuthRequest,
  ): Promise<WebsiteContentDraftResponse> {
    return this.history.restoreAsDraft({
      ...dto,
      contentKey,
      operatorId: this.operatorId(request),
      requestId: this.requestId(request),
    });
  }

  /** Lists managed website media without exposing storage credentials or keys. */
  @Get("media-assets")
  @RequirePermissions("website.read")
  @ApiOperation({ summary: "List Website Content media assets" })
  @ApiSuccessResponse(WebsiteMediaListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  listMedia(@Query() query: WebsiteMediaListQueryDto): Promise<WebsiteMediaListResponse> {
    return this.media.list(query);
  }

  /** Validates, uploads, and registers one managed image from the fixed multipart field. */
  @Post("media-assets")
  @RequirePermissions("website.edit_action")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({ summary: "Upload Website Content media asset" })
  @ApiSuccessResponse(WebsiteMediaAssetResponseDto)
  @ApiStandardErrors(400, 401, 403, 503)
  async uploadMedia(
    @UploadedFile() file: MultipartFile,
    @Req() request: AuthRequest,
  ): Promise<WebsiteMediaAsset> {
    const valid = await validateWebsiteMediaFile(file.buffer, file.originalname, file.mimetype);

    return this.media.upload(
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        operatorId: this.operatorId(request),
      },
      valid,
    );
  }

  /** Archives an unreferenced managed media asset. */
  @Post("media-assets/:assetId/archive")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("website.edit_action")
  @ApiParam({ name: "assetId" })
  @ApiOperation({ summary: "Archive Website Content media asset" })
  @ApiSuccessResponse(WebsiteMediaAssetResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  archiveMedia(
    @Param("assetId") assetId: string,
    @Req() request: AuthRequest,
  ): Promise<WebsiteMediaAsset> {
    return this.media.archive(assetId, this.operatorId(request), this.requestId(request));
  }

  private operatorId(request: AuthRequest): string {
    return request.user?.sub ?? "unknown";
  }

  private requestId(request: AuthRequest): string {
    return request.requestId ?? "unknown";
  }
}
