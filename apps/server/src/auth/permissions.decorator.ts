import { SetMetadata } from "@nestjs/common";

/** 声明访问路由所需的全部权限代码的元数据键。 */
export const PERMISSIONS_METADATA_KEY = "required-permissions";

/** 为路由或控制器声明访问时必须同时拥有的权限代码。 */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, codes);
