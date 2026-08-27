import { HttpStatus } from "@nestjs/common";
import { WEBSITE_CONTENT_ERROR_CODE } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";

/** Creates a stable error for a stale Website Content draft revision. */
export function websiteContentRevisionConflict(): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.REVISION_CONFLICT,
    "官网内容草稿已被其他管理员更新，请刷新后重试",
    HttpStatus.CONFLICT,
  );
}

/** Creates a stable error for a Website Content schema or template violation. */
export function websiteContentValidationFailed(message = "官网内容未通过校验"): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.INVALID_CONTENT,
    message,
    HttpStatus.BAD_REQUEST,
  );
}

/** Creates a stable error for a missing independently managed Website Content unit. */
export function websiteContentNotFound(contentKey: string): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.CONTENT_NOT_FOUND,
    `官网内容不存在：${contentKey}`,
    HttpStatus.NOT_FOUND,
  );
}

/** Creates a stable error for a missing immutable Website Content version. */
export function websiteContentVersionNotFound(versionId: string): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.VERSION_NOT_FOUND,
    `官网内容版本不存在：${versionId}`,
    HttpStatus.NOT_FOUND,
  );
}

/** Creates a stable error for invalid, unavailable, or archived website media. */
export function websiteContentInvalidMedia(message = "官网素材不可用"): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.INVALID_MEDIA,
    message,
    HttpStatus.BAD_REQUEST,
  );
}

/** Creates a stable error for an invalid or revoked Website Content preview capability. */
export function websiteContentPreviewTokenInvalid(): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.PREVIEW_TOKEN_INVALID,
    "官网预览凭证无效",
    HttpStatus.UNAUTHORIZED,
  );
}

/** Creates a stable error for an expired Website Content preview capability. */
export function websiteContentPreviewTokenExpired(): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.PREVIEW_TOKEN_EXPIRED,
    "官网预览凭证已过期",
    HttpStatus.UNAUTHORIZED,
  );
}

/** Creates a stable error for a failed Website Content persistence operation. */
export function websiteContentPersistenceFailed(): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.PERSISTENCE_FAILED,
    "官网内容持久化失败",
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

/** Creates a stable error for an unavailable website-media storage operation. */
export function websiteContentStorageUnavailable(): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.STORAGE_UNAVAILABLE,
    "官网素材存储暂时不可用",
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

/** Creates a stable error for an operator without the required Website Content permission. */
export function websiteContentPermissionDenied(): ApiException {
  return new ApiException(
    WEBSITE_CONTENT_ERROR_CODE.PERMISSION_DENIED,
    "无权执行官网内容操作",
    HttpStatus.FORBIDDEN,
  );
}
