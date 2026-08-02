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
  return new ApiException(
    SYSTEM_CONFIG_ERROR_CODE.NOT_FOUND,
    "系统配置不存在",
    HttpStatus.NOT_FOUND,
  );
}

/** 创建系统配置领域校验失败异常。 */
export function systemConfigValidationFailed(message: string): ApiException {
  return new ApiException(
    SYSTEM_CONFIG_ERROR_CODE.VALIDATION_FAILED,
    message,
    HttpStatus.BAD_REQUEST,
  );
}

/** 创建不泄漏底层数据库细节的系统配置持久化异常。 */
export function systemConfigPersistenceFailed(): ApiException {
  return new ApiException(
    SYSTEM_CONFIG_ERROR_CODE.PERSISTENCE_FAILED,
    "系统配置持久化失败",
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
