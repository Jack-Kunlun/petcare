import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  RbacRoleListQueryDto,
  ReplaceRbacRolePermissionsDto,
  ReplaceRbacRoleUsersDto,
} from "./rbac.dto";

describe("RBAC request DTOs", () => {
  it("preserves false when transforming the active-role query filter", async () => {
    const query = plainToInstance(RbacRoleListQueryDto, { isActive: "false" });

    expect(query.isActive).toBe(false);
    await expect(validate(query)).resolves.toHaveLength(0);
  });

  it("accepts stable catalog permission codes and leaves catalog semantics to the service", async () => {
    const dto = plainToInstance(ReplaceRbacRolePermissionsDto, {
      permissionCodes: ["system.view", "rbac.role.create"],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("requires UUID v4 user IDs for role-user replacement", async () => {
    const valid = plainToInstance(ReplaceRbacRoleUsersDto, {
      userIds: ["123e4567-e89b-42d3-a456-426614174000"],
    });
    const invalid = plainToInstance(ReplaceRbacRoleUsersDto, {
      userIds: ["not-a-uuid"],
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
