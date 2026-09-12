import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpStatus,
  Injectable,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  PROVIDER_QUALIFICATION_CONSENT_VERSION,
  PROVIDER_QUALIFICATION_MATERIAL_KIND,
  PROVIDER_QUALIFICATION_STATUS,
  type ProviderQualificationMaterialKind,
  type ProviderQualificationStatus,
} from "@petcare/shared-types";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import type { Request, Response } from "express";
import { memoryStorage } from "multer";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { ProviderQualificationService } from "./provider-qualification.service";
import { QUALIFICATION_MATERIAL_MAX_BYTES } from "./qualification-storage";

type AuthRequest = Request & { user: AccessTokenPayload };

@Injectable()
export class QualificationFeatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.config.qualificationWorkflowEnabled) {
      throw new ApiException(
        "QUALIFICATION_FEATURE_DISABLED",
        "资格申请暂未开放",
        HttpStatus.NOT_FOUND,
      );
    }

    return true;
  }
}

export class CreateQualificationDraftDto {
  @IsUUID("4")
  idempotencyKey: string;
}

export class SubmitQualificationDto {
  @IsIn([PROVIDER_QUALIFICATION_CONSENT_VERSION])
  consentVersion: string;

  @IsBoolean()
  accepted: boolean;
}

export class QualificationReviewDto {
  @IsIn(["approve", "reject"])
  decision: "approve" | "reject";

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  verificationMethod?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  verificationReference?: string;
}

export class QualificationRevokeDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

@ApiTags("provider-qualifications")
@ApiBearerAuth()
@UseGuards(QualificationFeatureGuard, AccessTokenGuard)
@Controller("provider-qualifications")
export class ProviderQualificationController {
  constructor(private readonly qualifications: ProviderQualificationService) {}

  @Post()
  @UseGuards(ProfileCompleteGuard)
  @ApiOperation({ summary: "创建服务者资格申请草稿" })
  create(@Req() request: AuthRequest, @Body() input: CreateQualificationDraftDto) {
    return this.qualifications.createDraft(request.user.sub, input.idempotencyKey);
  }

  @Get("mine")
  @ApiOperation({ summary: "查看我的资格申请" })
  mine(@Req() request: AuthRequest) {
    return this.qualifications.mine(request.user.sub);
  }

  @Post(":id/materials/:kind")
  @UseGuards(ProfileCompleteGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: QUALIFICATION_MATERIAL_MAX_BYTES, files: 1 },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "上传一份受管资格材料" })
  upload(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("kind", new ParseEnumPipe(PROVIDER_QUALIFICATION_MATERIAL_KIND))
    kind: ProviderQualificationMaterialKind,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new ApiException(
        "QUALIFICATION_INVALID_MATERIAL",
        "请选择资格材料图片",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.qualifications.upload(request.user.sub, id, kind, file);
  }

  @Post(":id/submit")
  @UseGuards(ProfileCompleteGuard)
  @ApiOperation({ summary: "同意材料处理说明并提交资格申请" })
  submit(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() input: SubmitQualificationDto,
  ) {
    return this.qualifications.submit(request.user.sub, id, input.consentVersion, input.accepted);
  }
}

@ApiTags("admin-provider-qualifications")
@ApiBearerAuth()
@UseGuards(QualificationFeatureGuard, AccessTokenGuard, PermissionGuard)
@Controller("admin/provider-qualifications")
export class AdminProviderQualificationController {
  constructor(private readonly qualifications: ProviderQualificationService) {}

  @Get()
  @RequirePermissions("provider_qualification.read")
  @ApiOperation({ summary: "查询资格申请队列" })
  list(@Query("status") status?: ProviderQualificationStatus) {
    if (status && !Object.values(PROVIDER_QUALIFICATION_STATUS).includes(status)) {
      throw new ApiException(
        "QUALIFICATION_INVALID_STATUS",
        "资格状态无效",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.qualifications.listForAdmin(status);
  }

  @Get(":id")
  @RequirePermissions("provider_qualification.read")
  @ApiOperation({ summary: "读取资格审核上下文和审计事件" })
  detail(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.qualifications.detailForAdmin(id);
  }

  @Get(":id/materials/:kind")
  @RequirePermissions("provider_qualification.material_read")
  @ApiOperation({ summary: "按独立权限读取私密资格材料" })
  async material(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("kind", new ParseEnumPipe(PROVIDER_QUALIFICATION_MATERIAL_KIND))
    kind: ProviderQualificationMaterialKind,
    @Res() response: Response,
  ): Promise<void> {
    const { body, mimeType } = await this.qualifications.materialForAdmin(
      request.user.sub,
      id,
      kind,
    );

    response.set({
      "Content-Type": mimeType,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    });
    response.send(body);
  }

  @Post(":id/review")
  @RequirePermissions("provider_qualification.review_action")
  @ApiOperation({ summary: "审核资格申请并写入真实资格投影" })
  review(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() input: QualificationReviewDto,
  ) {
    return this.qualifications.review(
      request.user.sub,
      id,
      input.decision,
      input.reason,
      input.verificationMethod,
      input.verificationReference,
    );
  }

  @Post(":id/revoke")
  @RequirePermissions("provider_qualification.revoke_action")
  @ApiOperation({ summary: "撤销资格并关闭后续接单门禁" })
  revoke(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() input: QualificationRevokeDto,
  ) {
    return this.qualifications.revoke(request.user.sub, id, input.reason);
  }
}
