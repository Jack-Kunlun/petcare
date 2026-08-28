import { ApiProperty } from "@nestjs/swagger";
import {
  PET_GENDER,
  PET_PROFILE_LIMITS,
  PET_SPECIES,
  type CreatePetRequest,
  type MyPetDetail,
  type MyPetListItem,
  type PetGender,
  type PetPhotoAsset,
  type PetSpecies,
  type UpdatePetRequest,
} from "@petcare/shared-types";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

function trimText(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

/** Complete validated fields for creating an owner-controlled pet profile. */
export class CreatePetDto implements CreatePetRequest {
  @ApiProperty({ minLength: 1, maxLength: PET_PROFILE_LIMITS.NAME_MAX_LENGTH })
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(PET_PROFILE_LIMITS.NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({ enum: Object.values(PET_SPECIES) })
  @IsIn(Object.values(PET_SPECIES))
  species: PetSpecies;

  @ApiProperty({ minLength: 1, maxLength: PET_PROFILE_LIMITS.BREED_MAX_LENGTH })
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(PET_PROFILE_LIMITS.BREED_MAX_LENGTH)
  breed: string;

  @ApiProperty({ enum: Object.values(PET_GENDER) })
  @IsIn(Object.values(PET_GENDER))
  gender: PetGender;

  @ApiProperty({ format: "date", nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(calendarDatePattern)
  birthDate: string | null;

  @ApiProperty({
    minimum: PET_PROFILE_LIMITS.WEIGHT_MIN_KG,
    maximum: PET_PROFILE_LIMITS.WEIGHT_MAX_KG,
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== null)
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 })
  @Min(PET_PROFILE_LIMITS.WEIGHT_MIN_KG)
  @Max(PET_PROFILE_LIMITS.WEIGHT_MAX_KG)
  weightKg: number | null;

  @ApiProperty()
  @IsBoolean()
  sterilized: boolean;

  @ApiProperty({ maxLength: PET_PROFILE_LIMITS.CARE_TEXT_MAX_LENGTH, nullable: true })
  @Transform(({ value }) => trimText(value))
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(PET_PROFILE_LIMITS.CARE_TEXT_MAX_LENGTH)
  notes: string | null;
}

/** Complete validated replacement fields for an owner-controlled pet profile. */
export class UpdatePetDto extends CreatePetDto implements UpdatePetRequest {}

/** Compact owner-only pet profile returned by list routes. */
export class MyPetListItemDto implements MyPetListItem {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: Object.values(PET_SPECIES) })
  species: PetSpecies;

  @ApiProperty()
  breed: string;

  @ApiProperty({ enum: Object.values(PET_GENDER) })
  gender: PetGender;

  @ApiProperty({ format: "date", nullable: true })
  birthDate: string | null;

  @ApiProperty({ format: "uri", nullable: true })
  coverImage: string | null;
}

/** Owner-visible metadata for one validated and managed pet photo. */
export class PetPhotoAssetDto implements PetPhotoAsset {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uri" })
  url: string;

  @ApiProperty({ enum: ["image/jpeg", "image/png", "image/webp"] })
  mimeType: PetPhotoAsset["mimeType"];

  @ApiProperty({
    minimum: PET_PROFILE_LIMITS.PHOTO_MIN_DIMENSION_PX,
    maximum: PET_PROFILE_LIMITS.PHOTO_MAX_DIMENSION_PX,
  })
  width: number;

  @ApiProperty({
    minimum: PET_PROFILE_LIMITS.PHOTO_MIN_DIMENSION_PX,
    maximum: PET_PROFILE_LIMITS.PHOTO_MAX_DIMENSION_PX,
  })
  height: number;

  @ApiProperty({ minimum: 1, maximum: PET_PROFILE_LIMITS.PHOTO_MAX_BYTES })
  sizeBytes: number;
}

/** Full private pet profile returned only to its authenticated owner. */
export class MyPetDetailDto extends MyPetListItemDto implements MyPetDetail {
  @ApiProperty({ nullable: true })
  weightKg: number | null;

  @ApiProperty()
  sterilized: boolean;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty({ type: [String], format: "uri" })
  photoUrls: string[];

  @ApiProperty({ type: [PetPhotoAssetDto] })
  photoAssets: PetPhotoAsset[];

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}
