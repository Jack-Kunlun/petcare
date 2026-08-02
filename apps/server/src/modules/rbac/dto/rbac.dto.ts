import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  CreateRbacRoleRequest,
  RbacCatalogResponse,
  RbacPermissionDefinition,
  RbacRoleDetail,
  RbacRoleListItem,
  RbacRoleListQuery,
  RbacRoleListResponse,
  ReplaceRbacRolePermissionsRequest,
  ReplaceRbacRoleUsersRequest,
  UpdateRbacRoleRequest,
} from "@petcare/shared-types";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/** Swagger representation of a code-defined permission catalog entry. */
export class RbacPermissionDefinitionDto implements RbacPermissionDefinition {
  @ApiProperty() code: string;
  @ApiProperty({ enum: ["menu", "button", "api"] }) type: RbacPermissionDefinition["type"];
  @ApiProperty() label: string;
  @ApiProperty() module: string;
  @ApiProperty({ nullable: true }) path: string | null;
  @ApiProperty({ nullable: true }) parentCode: string | null;
  @ApiProperty() order: number;
  @ApiProperty({ nullable: true }) icon: string | null;
  @ApiProperty({ type: [String] }) impliedApiCodes: readonly string[];
}

/** Response containing the active RBAC catalog and its cache version. */
export class RbacCatalogResponseDto implements RbacCatalogResponse {
  @ApiProperty() version: string;
  @ApiProperty({ type: [RbacPermissionDefinitionDto] }) permissions: RbacPermissionDefinitionDto[];
}

/** Common public fields returned for a role. */
export class RbacRoleListItemDto implements RbacRoleListItem {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty() roleName: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() isSystem: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty() permissionCount: number;
  @ApiProperty() userCount: number;
  @ApiProperty({ format: "date-time" }) updatedAt: string;
}

/** Full role response including its effective permissions and assigned users. */
export class RbacRoleDetailDto extends RbacRoleListItemDto implements RbacRoleDetail {
  @ApiProperty({ type: [String] }) permissionCodes: string[];
  @ApiProperty({ type: [String], format: "uuid" }) userIds: string[];
}

/** Fixed pagination response used by the role list endpoint. */
export class RbacRoleListResponseDto implements RbacRoleListResponse {
  @ApiProperty({ type: [RbacRoleListItemDto] }) list: RbacRoleListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
}

/** Validates the paginated role-list query. */
export class RbacRoleListQueryDto implements RbacRoleListQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ minLength: 1, maxLength: 50 })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/\S/u)
  roleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) {
      return true;
    }

    if (value === "false" || value === false) {
      return false;
    }

    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

/** Validates creation of a normal, non-system role. */
export class CreateRbacRoleDto implements CreateRbacRoleRequest {
  @ApiProperty({ minLength: 1, maxLength: 50 })
  @IsString()
  @Length(1, 50)
  @Matches(/\S/u)
  roleName: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

/** Validates mutable fields of a normal role. */
export class UpdateRbacRoleDto implements UpdateRbacRoleRequest {
  @ApiPropertyOptional({ minLength: 1, maxLength: 50 })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @Matches(/\S/u)
  roleName?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Validates menu and button permission codes selected by a role editor. */
export class ReplaceRbacRolePermissionsDto implements ReplaceRbacRolePermissionsRequest {
  @ApiProperty({ type: [String], maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  permissionCodes: string[];
}

/** Validates the complete set of users assigned to a role. */
export class ReplaceRbacRoleUsersDto implements ReplaceRbacRoleUsersRequest {
  @ApiProperty({ type: [String], format: "uuid", maxItems: 500 })
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @IsUUID("4", { each: true })
  @Length(1, 100, { each: true })
  userIds: string[];
}
