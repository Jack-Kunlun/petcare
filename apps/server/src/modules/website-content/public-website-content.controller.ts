import { Controller, Get, Headers, Param, Req, Res } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { WebsiteContentKey, WebsitePublicContent } from "@petcare/shared-types";
import type { Response } from "express";
import type { RequestWithId } from "../../common/http/api-response.types";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import {
  WebsitePreviewContentResponseDto,
  WebsitePublicContentResponseDto,
} from "./dto/public-website-content.dto";
import { toWebsitePreviewContent, WebsiteContentPublicService } from "./website-content-public.service";
import { WebsitePreviewService } from "./website-preview.service";

/** Exposes published and capability-scoped Website Content to the SSR website only. */
@ApiTags("Website Content")
@Controller("website-content")
export class PublicWebsiteContentController {
  constructor(
    private readonly published: WebsiteContentPublicService,
    private readonly previews: WebsitePreviewService,
  ) {}

  /** Reads a fixed draft snapshot only from the explicitly supplied preview-token header. */
  @Get("previews/:contentKey")
  @ApiParam({ name: "contentKey" })
  @ApiHeader({ name: "X-Website-Preview-Token", required: true, description: "Preview capability token" })
  @ApiOperation({ summary: "Read capability-scoped Website Content preview" })
  @ApiSuccessResponse(WebsitePreviewContentResponseDto)
  @ApiStandardErrors(401, 404, 500)
  async getPreview(
    @Param("contentKey") contentKey: WebsiteContentKey,
    @Headers("x-website-preview-token") token: string,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReturnType<typeof toWebsitePreviewContent>> {
    response.setHeader("Cache-Control", "private, no-store");

    return toWebsitePreviewContent(
      await this.previews.readPreview(contentKey, token, request.requestId ?? "unknown"),
    );
  }

  /** Reads the current published snapshot for one independently published content key. */
  @Get(":contentKey")
  @ApiParam({ name: "contentKey" })
  @ApiOperation({ summary: "Read published Website Content" })
  @ApiSuccessResponse(WebsitePublicContentResponseDto)
  @ApiStandardErrors(404, 500)
  getPublished(@Param("contentKey") contentKey: WebsiteContentKey): Promise<WebsitePublicContent> {
    return this.published.getPublished(contentKey);
  }
}
