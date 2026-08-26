import { HttpStatus } from "@nestjs/common";
import { COMMUNITY_MEDIA_ERROR_CODE } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";

/** Creates a stable error for invalid, missing, expired, or duplicate community media. */
export function communityMediaInvalid(message = "社区图片不可用"): ApiException {
  return new ApiException(
    COMMUNITY_MEDIA_ERROR_CODE.INVALID_MEDIA,
    message,
    HttpStatus.BAD_REQUEST,
  );
}

/** Creates a stable error when a user references media owned by another account. */
export function communityMediaForbidden(): ApiException {
  return new ApiException(
    COMMUNITY_MEDIA_ERROR_CODE.MEDIA_FORBIDDEN,
    "无权使用该社区图片",
    HttpStatus.FORBIDDEN,
  );
}

/** Creates a stable conflict when media was bound by another request. */
export function communityMediaConflict(): ApiException {
  return new ApiException(
    COMMUNITY_MEDIA_ERROR_CODE.MEDIA_CONFLICT,
    "社区图片已被其他动态使用",
    HttpStatus.CONFLICT,
  );
}

/** Creates a retryable error for an unavailable community object-store operation. */
export function communityMediaStorageUnavailable(): ApiException {
  return new ApiException(
    COMMUNITY_MEDIA_ERROR_CODE.STORAGE_UNAVAILABLE,
    "社区图片存储暂时不可用，请稍后重试",
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
