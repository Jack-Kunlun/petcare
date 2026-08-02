import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import {
  ADMIN_SERVICE_TYPE,
  AdminServiceType,
  FeeConfig,
  RatingThresholdConfig,
  SopConfig,
  SystemConfigDomain,
} from "@petcare/shared-types";
import { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { AccessTokenPayload } from "../../auth/auth.types";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import {
  FeeConfigDraftResponseDto,
  FeeConfigHistoryResponseDto,
  FeeConfigVersionResponseDto,
  PublishSystemConfigDto,
  RatingThresholdDraftResponseDto,
  RatingThresholdHistoryResponseDto,
  RatingThresholdVersionResponseDto,
  RestoreSystemConfigDto,
  SaveFeeConfigDraftDto,
  SaveRatingThresholdDraftDto,
  SaveSopConfigDraftDto,
  SopConfigDraftResponseDto,
  SopConfigHistoryResponseDto,
  SopConfigVersionResponseDto,
  SystemConfigDiffDto,
  SystemConfigHistoryQueryDto,
  SystemSettingsOverviewResponseDto,
} from "./dto/system-settings.dto";
import { ConfigPublishingService } from "./publishing/config-publishing.service";
import { SystemSettingsOverviewService, sopConfigKey } from "./system-settings-overview.service";
import { systemConfigNotFound } from "./system-settings.errors";

type AuthRequest = Request & { user?: AccessTokenPayload };

/** 提供后台系统设置三个领域的完整草稿、发布、差异和历史接口。 */
@ApiTags("Admin System Settings")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller("admin/system-settings")
export class AdminSystemSettingsController {
  /** 创建系统设置管理控制器。 */
  constructor(
    private readonly publishing: ConfigPublishingService,
    private readonly overview: SystemSettingsOverviewService,
  ) {}

  /** 获取系统设置控制台概览。 */
  @Get("overview")
  @RequirePermissions("system.view")
  @ApiOperation({ summary: "获取系统设置概览" })
  @ApiSuccessResponse(SystemSettingsOverviewResponseDto)
  @ApiStandardErrors(401, 403, 500)
  getOverview() {
    return this.overview.getOverview();
  }

  /** 获取指定服务类型当前生效的 SOP。 */
  @Get("sop/:serviceType/current")
  @RequirePermissions("system.view")
  @ApiParam({ name: "serviceType", enum: ADMIN_SERVICE_TYPE })
  @ApiOperation({ summary: "获取当前 SOP 配置" })
  @ApiSuccessResponse(SopConfigVersionResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  getSopCurrent(
    @Param("serviceType", new ParseEnumPipe(ADMIN_SERVICE_TYPE)) serviceType: AdminServiceType,
  ) {
    return this.current<SopConfig>(sopConfigKey(serviceType));
  }

  /** 获取指定服务类型当前 SOP 草稿。 */
  @Get("sop/:serviceType/draft")
  @RequirePermissions("system.view")
  @ApiParam({ name: "serviceType", enum: ADMIN_SERVICE_TYPE })
  @ApiOperation({ summary: "获取 SOP 草稿" })
  @ApiSuccessResponse(SopConfigDraftResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  getSopDraft(
    @Param("serviceType", new ParseEnumPipe(ADMIN_SERVICE_TYPE)) serviceType: AdminServiceType,
  ) {
    return this.draft<SopConfig>(sopConfigKey(serviceType));
  }

  /** 获取指定服务类型 SOP 草稿与当前版本差异。 */
  @Get("sop/:serviceType/diff")
  @RequirePermissions("system.view")
  @ApiParam({ name: "serviceType", enum: ADMIN_SERVICE_TYPE })
  @ApiOperation({ summary: "获取 SOP 配置差异" })
  @ApiSuccessResponse(SystemConfigDiffDto, { isArray: true })
  @ApiStandardErrors(400, 401, 403, 404, 500)
  getSopDiff(
    @Param("serviceType", new ParseEnumPipe(ADMIN_SERVICE_TYPE)) serviceType: AdminServiceType,
  ) {
    return this.publishing.getDiff(sopConfigKey(serviceType));
  }

  /** 分页查询指定服务类型 SOP 发布历史。 */
  @Get("sop/:serviceType/history")
  @RequirePermissions("system.view")
  @ApiParam({ name: "serviceType", enum: ADMIN_SERVICE_TYPE })
  @ApiOperation({ summary: "分页查询 SOP 历史" })
  @ApiSuccessResponse(SopConfigHistoryResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  getSopHistory(
    @Param("serviceType", new ParseEnumPipe(ADMIN_SERVICE_TYPE)) serviceType: AdminServiceType,
    @Query() query: SystemConfigHistoryQueryDto,
  ) {
    return this.publishing.listHistory<SopConfig>(
      sopConfigKey(serviceType),
      query.page,
      query.pageSize,
    );
  }

  /** 获取指定服务类型的单个 SOP 历史版本。 */
  @Get("sop/:serviceType/history/:versionId")
  @RequirePermissions("system.view")
  @ApiParam({ name: "serviceType", enum: ADMIN_SERVICE_TYPE })
  @ApiParam({ name: "versionId", type: String })
  @ApiOperation({ summary: "获取单个 SOP 历史版本" })
  @ApiSuccessResponse(SopConfigVersionResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  getSopVersion(
    @Param("serviceType", new ParseEnumPipe(ADMIN_SERVICE_TYPE)) serviceType: AdminServiceType,
    @Param("versionId") versionId: string,
  ) {
    return this.publishing.getVersion<SopConfig>(sopConfigKey(serviceType), versionId);
  }

  /** 保存指定服务类型 SOP 草稿。 */
  @Put("sop/:serviceType/draft")
  @RequirePermissions("system.sop_config")
  @ApiParam({ name: "serviceType", enum: ADMIN_SERVICE_TYPE })
  @ApiOperation({ summary: "保存 SOP 草稿" })
  @ApiSuccessResponse(SopConfigDraftResponseDto)
  @ApiStandardErrors(400, 401, 403, 409, 500)
  saveSopDraft(
    @Param("serviceType", new ParseEnumPipe(ADMIN_SERVICE_TYPE)) serviceType: AdminServiceType,
    @Body() dto: SaveSopConfigDraftDto,
    @Req() request: AuthRequest,
  ) {
    return this.publishing.saveDraft(sopConfigKey(serviceType), dto, request.user!.sub);
  }

  /** 发布指定服务类型 SOP 草稿。 */
  @Post("sop/:serviceType/publish")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("system.sop_config", "system.publish")
  @ApiParam({ name: "serviceType", enum: ADMIN_SERVICE_TYPE })
  @ApiOperation({ summary: "发布 SOP 草稿" })
  @ApiSuccessResponse(SopConfigVersionResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  publishSopDraft(
    @Param("serviceType", new ParseEnumPipe(ADMIN_SERVICE_TYPE)) serviceType: AdminServiceType,
    @Body() dto: PublishSystemConfigDto,
    @Req() request: AuthRequest,
  ) {
    return this.publishing.publish(sopConfigKey(serviceType), {
      ...dto,
      actorId: request.user!.sub,
    });
  }

  /** 将指定服务类型 SOP 历史版本恢复为新草稿。 */
  @Post("sop/:serviceType/restore")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("system.sop_config", "system.publish")
  @ApiParam({ name: "serviceType", enum: ADMIN_SERVICE_TYPE })
  @ApiOperation({ summary: "恢复 SOP 历史版本" })
  @ApiSuccessResponse(SopConfigDraftResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  restoreSopDraft(
    @Param("serviceType", new ParseEnumPipe(ADMIN_SERVICE_TYPE)) serviceType: AdminServiceType,
    @Body() dto: RestoreSystemConfigDto,
    @Req() request: AuthRequest,
  ) {
    return this.publishing.restoreAsDraft(sopConfigKey(serviceType), dto, request.user!.sub);
  }

  /** 获取当前生效的评分阈值。 */
  @Get("rating-threshold/current")
  @RequirePermissions("system.view")
  @ApiOperation({ summary: "获取当前评分阈值" })
  @ApiSuccessResponse(RatingThresholdVersionResponseDto)
  @ApiStandardErrors(401, 403, 404, 500)
  getRatingThresholdCurrent() {
    return this.current<RatingThresholdConfig>("rating_threshold");
  }

  /** 获取当前评分阈值草稿。 */
  @Get("rating-threshold/draft")
  @RequirePermissions("system.view")
  @ApiOperation({ summary: "获取评分阈值草稿" })
  @ApiSuccessResponse(RatingThresholdDraftResponseDto)
  @ApiStandardErrors(401, 403, 404, 500)
  getRatingThresholdDraft() {
    return this.draft<RatingThresholdConfig>("rating_threshold");
  }

  /** 获取评分阈值草稿与当前版本差异。 */
  @Get("rating-threshold/diff")
  @RequirePermissions("system.view")
  @ApiOperation({ summary: "获取评分阈值差异" })
  @ApiSuccessResponse(SystemConfigDiffDto, { isArray: true })
  @ApiStandardErrors(401, 403, 404, 500)
  getRatingThresholdDiff() {
    return this.publishing.getDiff("rating_threshold");
  }

  /** 分页查询评分阈值发布历史。 */
  @Get("rating-threshold/history")
  @RequirePermissions("system.view")
  @ApiOperation({ summary: "分页查询评分阈值历史" })
  @ApiSuccessResponse(RatingThresholdHistoryResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  getRatingThresholdHistory(@Query() query: SystemConfigHistoryQueryDto) {
    return this.publishing.listHistory<RatingThresholdConfig>(
      "rating_threshold",
      query.page,
      query.pageSize,
    );
  }

  /** 获取单个评分阈值历史版本。 */
  @Get("rating-threshold/history/:versionId")
  @RequirePermissions("system.view")
  @ApiParam({ name: "versionId", type: String })
  @ApiOperation({ summary: "获取单个评分阈值历史版本" })
  @ApiSuccessResponse(RatingThresholdVersionResponseDto)
  @ApiStandardErrors(401, 403, 404, 500)
  getRatingThresholdVersion(@Param("versionId") versionId: string) {
    return this.publishing.getVersion<RatingThresholdConfig>("rating_threshold", versionId);
  }

  /** 保存评分阈值草稿。 */
  @Put("rating-threshold/draft")
  @RequirePermissions("system.threshold_config")
  @ApiOperation({ summary: "保存评分阈值草稿" })
  @ApiSuccessResponse(RatingThresholdDraftResponseDto)
  @ApiStandardErrors(400, 401, 403, 409, 500)
  saveRatingThresholdDraft(@Body() dto: SaveRatingThresholdDraftDto, @Req() request: AuthRequest) {
    return this.publishing.saveDraft("rating_threshold", dto, request.user!.sub);
  }

  /** 发布评分阈值草稿。 */
  @Post("rating-threshold/publish")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("system.threshold_config", "system.publish")
  @ApiOperation({ summary: "发布评分阈值草稿" })
  @ApiSuccessResponse(RatingThresholdVersionResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  publishRatingThresholdDraft(@Body() dto: PublishSystemConfigDto, @Req() request: AuthRequest) {
    return this.publishing.publish("rating_threshold", { ...dto, actorId: request.user!.sub });
  }

  /** 将评分阈值历史版本恢复为新草稿。 */
  @Post("rating-threshold/restore")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("system.threshold_config", "system.publish")
  @ApiOperation({ summary: "恢复评分阈值历史版本" })
  @ApiSuccessResponse(RatingThresholdDraftResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  restoreRatingThresholdDraft(@Body() dto: RestoreSystemConfigDto, @Req() request: AuthRequest) {
    return this.publishing.restoreAsDraft("rating_threshold", dto, request.user!.sub);
  }

  /** 获取当前生效的费用配置。 */
  @Get("fee/current")
  @RequirePermissions("system.view")
  @ApiOperation({ summary: "获取当前费用配置" })
  @ApiSuccessResponse(FeeConfigVersionResponseDto)
  @ApiStandardErrors(401, 403, 404, 500)
  getFeeCurrent() {
    return this.current<FeeConfig>("fee");
  }

  /** 获取当前费用草稿。 */
  @Get("fee/draft")
  @RequirePermissions("system.view")
  @ApiOperation({ summary: "获取费用草稿" })
  @ApiSuccessResponse(FeeConfigDraftResponseDto)
  @ApiStandardErrors(401, 403, 404, 500)
  getFeeDraft() {
    return this.draft<FeeConfig>("fee");
  }

  /** 获取费用草稿与当前版本差异。 */
  @Get("fee/diff")
  @RequirePermissions("system.view")
  @ApiOperation({ summary: "获取费用配置差异" })
  @ApiSuccessResponse(SystemConfigDiffDto, { isArray: true })
  @ApiStandardErrors(401, 403, 404, 500)
  getFeeDiff() {
    return this.publishing.getDiff("fee");
  }

  /** 分页查询费用配置发布历史。 */
  @Get("fee/history")
  @RequirePermissions("system.view")
  @ApiOperation({ summary: "分页查询费用配置历史" })
  @ApiSuccessResponse(FeeConfigHistoryResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  getFeeHistory(@Query() query: SystemConfigHistoryQueryDto) {
    return this.publishing.listHistory<FeeConfig>("fee", query.page, query.pageSize);
  }

  /** 获取单个平台费率历史版本。 */
  @Get("fee/history/:versionId")
  @RequirePermissions("system.view")
  @ApiParam({ name: "versionId", type: String })
  @ApiOperation({ summary: "获取单个平台费率历史版本" })
  @ApiSuccessResponse(FeeConfigVersionResponseDto)
  @ApiStandardErrors(401, 403, 404, 500)
  getFeeVersion(@Param("versionId") versionId: string) {
    return this.publishing.getVersion<FeeConfig>("fee", versionId);
  }

  /** 保存费用草稿。 */
  @Put("fee/draft")
  @RequirePermissions("system.fee_config")
  @ApiOperation({ summary: "保存费用草稿" })
  @ApiSuccessResponse(FeeConfigDraftResponseDto)
  @ApiStandardErrors(400, 401, 403, 409, 500)
  saveFeeDraft(@Body() dto: SaveFeeConfigDraftDto, @Req() request: AuthRequest) {
    return this.publishing.saveDraft("fee", dto, request.user!.sub);
  }

  /** 发布费用草稿。 */
  @Post("fee/publish")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("system.fee_config", "system.publish")
  @ApiOperation({ summary: "发布费用草稿" })
  @ApiSuccessResponse(FeeConfigVersionResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  publishFeeDraft(@Body() dto: PublishSystemConfigDto, @Req() request: AuthRequest) {
    return this.publishing.publish("fee", { ...dto, actorId: request.user!.sub });
  }

  /** 将费用历史版本恢复为新草稿。 */
  @Post("fee/restore")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("system.fee_config", "system.publish")
  @ApiOperation({ summary: "恢复费用历史版本" })
  @ApiSuccessResponse(FeeConfigDraftResponseDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  restoreFeeDraft(@Body() dto: RestoreSystemConfigDto, @Req() request: AuthRequest) {
    return this.publishing.restoreAsDraft("fee", dto, request.user!.sub);
  }

  private async current<TConfig>(domain: SystemConfigDomain) {
    const current = await this.overview.getCurrent<TConfig>(domain);

    if (!current) {
      throw systemConfigNotFound();
    }

    return current;
  }

  private async draft<TConfig>(domain: SystemConfigDomain) {
    const draft = await this.publishing.getDraft<TConfig>(domain);

    if (!draft) {
      throw systemConfigNotFound();
    }

    return draft;
  }
}
