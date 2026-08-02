import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  RBAC_PERMISSION_CATALOG,
  RBAC_PERMISSION_TYPES,
  type RbacPermissionDefinition,
} from "@petcare/shared-types";
import {
  rbacApiPermissionNotAssignable,
  rbacDuplicatePermissionCode,
  rbacInvalidImpliedApiCode,
  rbacInvalidPermissionParent,
  rbacUnknownPermission,
} from "./rbac.errors";

/** Validates and queries the code-defined RBAC permission catalog. */
@Injectable()
export class PermissionCatalogService {
  private readonly catalog: readonly RbacPermissionDefinition[];
  private readonly catalogByCode: ReadonlyMap<string, RbacPermissionDefinition>;
  private readonly version: string;

  constructor(catalog: readonly RbacPermissionDefinition[] = RBAC_PERMISSION_CATALOG) {
    const catalogByCode = new Map(catalog.map((permission) => [permission.code, permission]));

    if (catalogByCode.size !== catalog.length) {
      const duplicate = catalog.find(
        (permission, index) => catalog.findIndex(({ code }) => code === permission.code) !== index,
      );

      throw rbacDuplicatePermissionCode(duplicate?.code ?? "unknown");
    }

    for (const permission of catalog) {
      if (permission.parentCode !== null) {
        const parent = catalogByCode.get(permission.parentCode);

        if (!parent || parent.type !== RBAC_PERMISSION_TYPES.MENU) {
          throw rbacInvalidPermissionParent(permission.code);
        }
      }

      for (const impliedApiCode of permission.impliedApiCodes) {
        if (catalogByCode.get(impliedApiCode)?.type !== RBAC_PERMISSION_TYPES.API) {
          throw rbacInvalidImpliedApiCode(impliedApiCode);
        }
      }
    }

    this.catalog = catalog;
    this.catalogByCode = catalogByCode;
    this.version = createHash("sha256")
      .update(
        JSON.stringify([...catalog].sort((left, right) => left.code.localeCompare(right.code))),
      )
      .digest("hex");
  }

  /** Returns a stable content hash for the active catalog. */
  getVersion(): string {
    return this.version;
  }

  /** Returns all catalog definitions in their code-defined display order. */
  getAll(): readonly RbacPermissionDefinition[] {
    return this.catalog;
  }

  /** Looks up an active catalog definition by code. */
  getByCode(code: string): RbacPermissionDefinition {
    const permission = this.catalogByCode.get(code);

    if (!permission) {
      throw rbacUnknownPermission(code);
    }

    return permission;
  }

  /** Returns whether a code is present in the active catalog. */
  isActiveCode(code: string): boolean {
    return this.catalogByCode.has(code);
  }

  /** Returns de-duplicated database codes that have no current catalog definition. */
  getOrphanedCodes(databaseCodes: readonly string[]): string[] {
    return [...new Set(databaseCodes.filter((code) => !this.isActiveCode(code)))].sort();
  }

  /** Validates role-editor input, which may contain only menu and button permissions. */
  validateUiPermissionCodes(codes: readonly string[]): void {
    for (const code of codes) {
      const permission = this.getByCode(code);

      if (permission.type === RBAC_PERMISSION_TYPES.API) {
        throw rbacApiPermissionNotAssignable(code);
      }
    }
  }

  /** Adds implied API permissions and returns a sorted, de-duplicated effective set. */
  expandToEffectiveCodes(uiCodes: readonly string[]): string[] {
    this.validateUiPermissionCodes(uiCodes);

    return [
      ...new Set(
        uiCodes.flatMap((code) => {
          const permission = this.getByCode(code);

          return [permission.code, ...permission.impliedApiCodes];
        }),
      ),
    ].sort();
  }
}
