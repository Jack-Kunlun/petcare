import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../common/http/api-exception";

/** Creates the provider-independent public-avatar storage failure. */
export function publicAvatarStorageUnavailable(): ApiException {
  return new ApiException(
    "STORAGE_UNAVAILABLE",
    "头像存储服务暂时不可用，请稍后重试",
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
