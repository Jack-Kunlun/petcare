import { HttpStatus } from "@nestjs/common";
import { PET_ERROR_CODE, PET_PROFILE_LIMITS } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";

/** Hides missing and cross-owner pet profiles behind the same response. */
export function petNotFound(): ApiException {
  return new ApiException(PET_ERROR_CODE.NOT_FOUND, "宠物档案不存在", HttpStatus.NOT_FOUND);
}

/** Rejects creation after the authenticated owner reaches the profile limit. */
export function petLimitReached(): ApiException {
  return new ApiException(
    PET_ERROR_CODE.LIMIT_REACHED,
    `最多只能创建 ${PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER} 个宠物档案`,
    HttpStatus.CONFLICT,
  );
}

/** Prevents deletion while an order still references the pet. */
export function petReferencedByOrder(): ApiException {
  return new ApiException(
    PET_ERROR_CODE.REFERENCED_BY_ORDER,
    "该宠物已被订单引用，不能删除",
    HttpStatus.CONFLICT,
  );
}

/** Rejects malformed pet data even when the service is called without the HTTP validation pipe. */
export function petValidationFailed(message = "宠物档案参数无效"): ApiException {
  return new ApiException("VALIDATION_FAILED", message, HttpStatus.BAD_REQUEST);
}

/** Rejects a mutation if the account becomes inactive after token validation. */
export function petAccountDisabled(): ApiException {
  return new ApiException("AUTH_ACCOUNT_DISABLED", "账户已被停用", HttpStatus.FORBIDDEN);
}
