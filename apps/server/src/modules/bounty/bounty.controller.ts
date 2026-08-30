import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpStatus,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import {
  BOUNTY_ERROR_CODE,
  BOUNTY_LIMITS,
  BOUNTY_SERVICE_TYPE,
  type BountyListQuery,
  type BountyServiceType,
  type CreateBountyRequest,
  type MyBounty,
  type MyBountyListResponse,
  type MyBountyPet,
  type PublicBounty,
  type PublicBountyListResponse,
  type PublicBountyOwner,
  type PublicBountyPet,
} from "@petcare/shared-types";
import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import { ApiException } from "../../common/http/api-exception";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { ConfigService } from "../../config/config.service";
import { BountyService } from "./bounty.service";

type AuthRequest = Request & { user: AccessTokenPayload };

function trimText(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

/** Hides all Cycle 5 bounty routes unless the environment explicitly enables them. */
@Injectable()
export class BountyFeatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.config.commercialServicesEnabled) {
      throw new ApiException(
        BOUNTY_ERROR_CODE.FEATURE_DISABLED,
        "悬赏服务未开放",
        HttpStatus.NOT_FOUND,
      );
    }

    return true;
  }
}

/** Validated owner input for one exact-price bounty. */
export class CreateBountyDto implements CreateBountyRequest {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  petId: string;

  @ApiProperty({ enum: Object.values(BOUNTY_SERVICE_TYPE) })
  @IsIn(Object.values(BOUNTY_SERVICE_TYPE))
  serviceType: BountyServiceType;

  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true, strictSeparator: true })
  serviceTime: string;

  @ApiProperty({
    minimum: BOUNTY_LIMITS.AMOUNT_MIN_CENTS,
    maximum: BOUNTY_LIMITS.AMOUNT_MAX_CENTS,
  })
  @IsInt()
  @Min(BOUNTY_LIMITS.AMOUNT_MIN_CENTS)
  @Max(BOUNTY_LIMITS.AMOUNT_MAX_CENTS)
  amountCents: number;

  @ApiProperty({ minLength: 1, maxLength: BOUNTY_LIMITS.ADDRESS_MAX_LENGTH })
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(BOUNTY_LIMITS.ADDRESS_MAX_LENGTH)
  @Matches(/^[^\p{Cc}]+$/u)
  address: string;

  @ApiPropertyOptional({ maxLength: BOUNTY_LIMITS.REMARK_MAX_LENGTH, nullable: true })
  @Transform(({ value }) => trimText(value))
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(BOUNTY_LIMITS.REMARK_MAX_LENGTH)
  @Matches(/^[^\p{Cc}]*$/u)
  remark?: string | null;
}

/** Validated one-based bounty pagination. */
export class BountyListQueryDto implements BountyListQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: BOUNTY_LIMITS.PAGE_SIZE_MAX, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOUNTY_LIMITS.PAGE_SIZE_MAX)
  pageSize = 20;
}

class PublicBountyOwnerDto implements PublicBountyOwner {
  @ApiProperty()
  nickname: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;
}

class PublicBountyPetDto implements PublicBountyPet {
  @ApiProperty()
  name: string;

  @ApiProperty()
  breed: string;

  @ApiProperty({ nullable: true })
  coverImage: string | null;
}

class MyBountyPetDto extends PublicBountyPetDto implements MyBountyPet {
  @ApiProperty({ format: "uuid" })
  id: string;
}

class PublicBountyDto implements PublicBounty {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ enum: Object.values(BOUNTY_SERVICE_TYPE) })
  serviceType: BountyServiceType;

  @ApiProperty({ format: "date-time" })
  serviceTime: string;

  @ApiProperty()
  amountCents: number;

  @ApiProperty({ enum: ["pending_confirm"] })
  status: "pending_confirm";

  @ApiProperty({ format: "date-time" })
  expiresAt: string;

  @ApiProperty({ type: PublicBountyOwnerDto })
  owner: PublicBountyOwner;

  @ApiProperty({ type: PublicBountyPetDto })
  pet: PublicBountyPet;
}

class MyBountyDto implements MyBounty {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ enum: Object.values(BOUNTY_SERVICE_TYPE) })
  serviceType: BountyServiceType;

  @ApiProperty({ format: "date-time" })
  serviceTime: string;

  @ApiProperty()
  amountCents: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  address: string;

  @ApiProperty({ nullable: true })
  remark: string | null;

  @ApiProperty({ format: "date-time" })
  expiresAt: string;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ type: MyBountyPetDto })
  pet: MyBountyPet;
}

class PublicBountyListResponseDto implements PublicBountyListResponse {
  @ApiProperty({ type: [PublicBountyDto] })
  list: PublicBounty[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

class MyBountyListResponseDto implements MyBountyListResponse {
  @ApiProperty({ type: [MyBountyDto] })
  list: MyBounty[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

/** Exposes default-closed Cycle 5 bounty creation and privacy-scoped reads. */
@ApiTags("bounties")
@UseGuards(BountyFeatureGuard)
@Controller("bounties")
export class BountyController {
  constructor(private readonly bounties: BountyService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, ProfileCompleteGuard)
  @ApiOperation({ summary: "发布本人宠物悬赏" })
  @ApiSuccessResponse(MyBountyDto, { status: 201 })
  @ApiStandardErrors(400, 401, 403, 404, 500)
  create(@Req() request: AuthRequest, @Body() dto: CreateBountyDto): Promise<MyBounty> {
    return this.bounties.create(request.user.sub, dto);
  }

  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: "分页获取我的悬赏" })
  @ApiSuccessResponse(MyBountyListResponseDto)
  @ApiStandardErrors(400, 401, 404, 500)
  findMine(
    @Req() request: AuthRequest,
    @Query() query: BountyListQueryDto,
  ): Promise<MyBountyListResponse> {
    return this.bounties.findMine(request.user.sub, query);
  }

  @Get()
  @ApiOperation({ summary: "分页获取公开悬赏" })
  @ApiSuccessResponse(PublicBountyListResponseDto)
  @ApiStandardErrors(400, 404, 500)
  findPublic(@Query() query: BountyListQueryDto): Promise<PublicBountyListResponse> {
    return this.bounties.findPublic(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "获取公开悬赏详情" })
  @ApiSuccessResponse(PublicBountyDto)
  @ApiStandardErrors(400, 404, 500)
  findPublicById(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<PublicBounty> {
    return this.bounties.findPublicById(id);
  }
}
