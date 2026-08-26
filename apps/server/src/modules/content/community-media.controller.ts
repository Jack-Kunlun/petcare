import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import type { CommunityMediaAsset } from "@petcare/shared-types";
import type { Request } from "express";
import { memoryStorage } from "multer";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { communityMediaInvalid } from "./community-media.errors";
import { CommunityMediaService } from "./community-media.service";
import { CommunityMediaAssetDto } from "./dto/community-post.dto";

type AuthRequest = Request & { user: AccessTokenPayload };

/** Accepts authenticated, profile-complete community image uploads. */
@ApiTags("community")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, ProfileCompleteGuard)
@Controller("community/media-assets")
export class CommunityMediaController {
  constructor(private readonly media: CommunityMediaService) {}

  /** Validates and registers one managed community image. */
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({ summary: "上传待绑定的社区图片" })
  @ApiSuccessResponse(CommunityMediaAssetDto, { status: 201 })
  @ApiStandardErrors(400, 401, 403, 413, 503)
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthRequest,
  ): Promise<CommunityMediaAsset> {
    if (!file) {
      throw communityMediaInvalid("请选择要上传的社区图片");
    }

    return this.media.upload(request.user.sub, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  /** Invalidates one unbound upload removed from the local draft. */
  @Post(":assetId/discard")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: "assetId", format: "uuid" })
  @ApiOperation({ summary: "删除待提交社区图片" })
  @ApiNoContentResponse({ description: "待提交社区图片已删除" })
  @ApiStandardErrors(400, 401, 403, 409, 500)
  discard(
    @Param("assetId", new ParseUUIDPipe({ version: "4" })) assetId: string,
    @Req() request: AuthRequest,
  ): Promise<void> {
    return this.media.discard(request.user.sub, assetId);
  }
}
