import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
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
import type {
  AdminUserListItem,
  RbacCatalogResponse,
  RbacRoleDetail,
  RbacRoleListResponse,
} from "@petcare/shared-types";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { AdminUserListItemDto } from "../user/dto/user-response.dto";
import {
  CreateRbacRoleDto,
  RbacCatalogResponseDto,
  RbacRoleDetailDto,
  RbacRoleListQueryDto,
  RbacRoleListResponseDto,
  ReplaceRbacRolePermissionsDto,
  ReplaceRbacRoleUsersDto,
  UpdateRbacRoleDto,
} from "./dto/rbac.dto";
import { RbacService } from "./rbac.service";
import { RoleService } from "./role.service";

type AuthenticatedRequest = Request & { user?: AccessTokenPayload };

/** Exposes protected administrative role, permission, and role-user management endpoints. */
@ApiTags("admin-rbac")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, PermissionGuard)
@Controller("admin/rbac")
export class AdminRbacController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly roleService: RoleService,
  ) {}

  /** Returns the immutable, code-defined permission catalog. */
  @Get("catalog")
  @RequirePermissions("rbac.view")
  @ApiOperation({ summary: "获取 RBAC 权限目录" })
  @ApiSuccessResponse(RbacCatalogResponseDto)
  @ApiStandardErrors(401, 403, 500)
  getCatalog(): RbacCatalogResponse {
    return this.rbacService.getCatalog();
  }

  /** Returns a fixed-shape, paginated role list. */
  @Get("roles")
  @RequirePermissions("rbac.view")
  @ApiOperation({ summary: "分页查询角色" })
  @ApiSuccessResponse(RbacRoleListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  listRoles(@Query() query: RbacRoleListQueryDto): Promise<RbacRoleListResponse> {
    return this.roleService.list(query);
  }

  /** Returns role details including effective permissions and user IDs. */
  @Get("roles/:id")
  @RequirePermissions("rbac.view")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "获取角色详情" })
  @ApiSuccessResponse(RbacRoleDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 500)
  getRole(@Param("id", ParseUUIDPipe) id: string): Promise<RbacRoleDetail> {
    return this.roleService.get(id);
  }

  /** Creates a normal role and records the requesting administrator as operator. */
  @Post("roles")
  @RequirePermissions("rbac.role.create")
  @ApiOperation({ summary: "创建角色" })
  @ApiSuccessResponse(RbacRoleDetailDto, { status: HttpStatus.CREATED })
  @ApiStandardErrors(400, 401, 403, 409, 500)
  createRole(
    @Body() dto: CreateRbacRoleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RbacRoleDetail> {
    return this.roleService.create(dto, this.actorFrom(request));
  }

  /** Updates a normal role and writes an audit record. */
  @Patch("roles/:id")
  @RequirePermissions("rbac.role.update")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "更新角色" })
  @ApiSuccessResponse(RbacRoleDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  updateRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRbacRoleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RbacRoleDetail> {
    return this.roleService.update(id, dto, this.actorFrom(request));
  }

  /** Deletes an unassigned normal role. */
  @Delete("roles/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("rbac.role.delete")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "删除角色" })
  @ApiNoContentResponse({ description: "角色删除成功" })
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  async deleteRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.roleService.delete(id, this.actorFrom(request));
  }

  /** Replaces editable UI permission codes and their implicit API closure atomically. */
  @Put("roles/:id/permissions")
  @RequirePermissions("rbac.role.update")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "替换角色权限" })
  @ApiSuccessResponse(RbacRoleDetailDto)
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  replacePermissions(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReplaceRbacRolePermissionsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RbacRoleDetail> {
    return this.roleService.replacePermissions(id, dto, this.actorFrom(request));
  }

  /** Lists the complete administrator records currently assigned to a role. */
  @Get("roles/:id/users")
  @RequirePermissions("rbac.assign_role")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "获取角色关联用户" })
  @ApiSuccessResponse(AdminUserListItemDto, { isArray: true })
  @ApiStandardErrors(400, 401, 403, 404, 500)
  getRoleUsers(@Param("id", ParseUUIDPipe) id: string): Promise<AdminUserListItem[]> {
    return this.roleService.getUsers(id);
  }

  /** Replaces all users assigned to a normal role in one transaction. */
  @Put("roles/:id/users")
  @RequirePermissions("rbac.assign_role")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOperation({ summary: "替换角色关联用户" })
  @ApiSuccessResponse(AdminUserListItemDto, { isArray: true })
  @ApiStandardErrors(400, 401, 403, 404, 409, 500)
  replaceRoleUsers(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReplaceRbacRoleUsersDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminUserListItem[]> {
    return this.roleService.replaceUsers(id, dto, this.actorFrom(request));
  }

  private actorFrom(request: AuthenticatedRequest) {
    return { operatorId: request.user?.sub ?? "", ip: request.ip };
  }
}
