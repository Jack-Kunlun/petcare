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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import type { MyPetDetail, MyPetListResponse } from "@petcare/shared-types";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { CreatePetDto, MyPetDetailDto, MyPetListItemDto, UpdatePetDto } from "./dto/pet.dto";
import { PetService } from "./pet.service";

type AuthRequest = Request & { user: AccessTokenPayload };

/** Provides authenticated owners with private pet-profile CRUD routes. */
@ApiTags("pets")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("pets")
export class PetController {
  constructor(private readonly pets: PetService) {}

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
