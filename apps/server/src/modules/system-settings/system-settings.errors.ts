import { HttpStatus } from "@nestjs/common";
import { SYSTEM_CONFIG_ERROR_CODE } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";

/** 创建系统配置版本冲突异常。 */
export function systemConfigVersionConflict(): ApiException {
  return new ApiException(
    SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT,
    "配置已被其他管理员修改，请刷新后重试",
    HttpStatus.CONFLICT,
  );
}

/** 创建系统配置记录不存在异常。 */
export function systemConfigNotFound(): ApiException {
  return new ApiException("RESOURCE_NOT_FOUND", "系统配置不存在", HttpStatus.NOT_FOUND);
}
