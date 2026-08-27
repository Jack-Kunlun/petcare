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
import {
  PET_PROFILE_LIMITS,
  type MyPetDetail,
  type MyPetListResponse,
  type PetPhotoAsset,
} from "@petcare/shared-types";
import type { Request } from "express";
import { memoryStorage } from "multer";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import {
  CreatePetDto,
  MyPetDetailDto,
  MyPetListItemDto,
  PetPhotoAssetDto,
  UpdatePetDto,
} from "./dto/pet.dto";
import { PetMediaService } from "./pet-media.service";
import { petPhotoInvalid } from "./pet.errors";
import { PetService } from "./pet.service";

type AuthRequest = Request & { user: AccessTokenPayload };

/** Provides authenticated owners with private pet-profile CRUD routes. */
@ApiTags("pets")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("pets")
export class PetController {
  constructor(
    private readonly pets: PetService,
    private readonly media: PetMediaService,
  ) {}

  /** Lists only pets owned by the authenticated account. */
  @Get()
  @ApiOperation({ summary: "获取我的宠物档案" })
  @ApiSuccessResponse(MyPetListItemDto, { isArray: true })
  @ApiStandardErrors(401, 500)
  findMine(@Req() request: AuthRequest): Promise<MyPetListResponse> {
    return this.pets.findMine(request.user.sub);
  }

  /** Creates one pet owned exclusively by the authenticated account. */
  @Post()
  @ApiOperation({ summary: "创建宠物档案" })
  @ApiSuccessResponse(MyPetDetailDto, { status: 201 })
  @ApiStandardErrors(400, 401, 403, 409, 500)
  create(@Req() request: AuthRequest, @Body() dto: CreatePetDto): Promise<MyPetDetail> {
    return this.pets.create(request.user.sub, dto);
  }

  /** Validates and binds one managed image to an owned pet. */
  @Post(":id/media-assets")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: PET_PROFILE_LIMITS.PHOTO_MAX_BYTES, files: 1 },
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
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "上传我的宠物图片" })
  @ApiSuccessResponse(PetPhotoAssetDto, { status: 201 })
  @ApiStandardErrors(400, 401, 403, 404, 409, 413, 503)
  uploadPhoto(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PetPhotoAsset> {
    if (!file) {
      throw petPhotoInvalid("请选择要上传的宠物图片");
    }

    return this.media.upload(request.user.sub, id, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  /** Unbinds and schedules cleanup for one owned managed pet photo. */
  @Delete(":id/media-assets/:assetId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: "id", format: "uuid" })
  @ApiParam({ name: "assetId", format: "uuid" })
  @ApiOperation({ summary: "删除我的宠物图片" })
  @ApiNoContentResponse({ description: "宠物图片已删除" })
  @ApiStandardErrors(400, 401, 403, 404, 500)
  deletePhoto(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("assetId", new ParseUUIDPipe({ version: "4" })) assetId: string,
  ): Promise<void> {
    return this.media.remove(request.user.sub, id, assetId);
  }

  /** Returns one private pet profile owned by the authenticated account. */
  @Get(":id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "获取我的宠物详情" })
  @ApiSuccessResponse(MyPetDetailDto)
  @ApiStandardErrors(400, 401, 404, 500)
  findMineById(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<MyPetDetail> {
    return this.pets.findMineById(request.user.sub, id);
  }

  /** Fully replaces editable fields on one owned pet profile. */
  @Put(":id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "更新我的宠物档案" })
  @ApiSuccessResponse(MyPetDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  update(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePetDto,
  ): Promise<MyPetDetail> {
    return this.pets.update(request.user.sub, id, dto);
  }

  /** Deletes one owned pet that has no restrictive order reference. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "删除我的宠物档案" })
  @ApiNoContentResponse({ description: "宠物档案已删除" })
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  delete(
    @Req() request: AuthRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<void> {
    return this.pets.delete(request.user.sub, id);
  }
}
