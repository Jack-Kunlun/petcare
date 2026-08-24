import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";

/** Creates a stable client-safe error for invalid classroom article rich-text content. */
export function classroomArticleInvalidContent(message = "文章正文格式无效"): ApiException {
  return new ApiException("CONTENT_ARTICLE_INVALID_CONTENT", message, HttpStatus.BAD_REQUEST);
}

/** Creates a stable client-safe error for a classroom article that no longer exists. */
export function classroomArticleNotFound(): ApiException {
  return new ApiException("CONTENT_ARTICLE_NOT_FOUND", "课堂文章不存在", HttpStatus.NOT_FOUND);
}

/** Creates a stable client-safe error when the requested article state transition is invalid. */
export function classroomArticleStateConflict(): ApiException {
  return new ApiException(
    "CONTENT_ARTICLE_STATE_CONFLICT",
    "文章状态已变化，请刷新后重试",
    HttpStatus.CONFLICT,
  );
}

/** Creates a stable client-safe error for optimistic-concurrency write conflicts. */
export function classroomArticleConcurrentUpdate(): ApiException {
  return new ApiException(
    "CONTENT_ARTICLE_CONCURRENT_UPDATE",
    "文章已被其他管理员修改，请刷新后重试",
    HttpStatus.CONFLICT,
  );
}
