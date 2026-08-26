import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";

/** Creates a stable error when an administrator requests a missing community post. */
export function communityPostNotFound(): ApiException {
  return new ApiException("CONTENT_POST_NOT_FOUND", "社区帖子不存在", HttpStatus.NOT_FOUND);
}

/** Creates a stable error when a user tries to delete another author's post. */
export function communityPostForbidden(): ApiException {
  return new ApiException("CONTENT_POST_FORBIDDEN", "无权删除该社区帖子", HttpStatus.FORBIDDEN);
}

/** Creates a stable error when an author reports their own community post. */
export function communityPostSelfReport(): ApiException {
  return new ApiException(
    "CONTENT_POST_REPORT_SELF",
    "不能举报自己的社区帖子",
    HttpStatus.FORBIDDEN,
  );
}

/** Creates a stable error when a reporter already reported the same post. */
export function communityPostDuplicateReport(): ApiException {
  return new ApiException(
    "CONTENT_POST_REPORT_DUPLICATE",
    "你已举报过该社区帖子",
    HttpStatus.CONFLICT,
  );
}

/** Creates a stable error for a command that is invalid in the current post state. */
export function communityPostStateConflict(): ApiException {
  return new ApiException(
    "CONTENT_POST_STATE_CONFLICT",
    "帖子状态已变化，请刷新后重试",
    HttpStatus.CONFLICT,
  );
}

/** Creates a stable error when an administrator submits an obsolete post version. */
export function communityPostConcurrentUpdate(): ApiException {
  return new ApiException(
    "CONTENT_POST_CONCURRENT_UPDATE",
    "帖子已被其他管理员处理，请刷新后重试",
    HttpStatus.CONFLICT,
  );
}

/** Creates a stable error when a reject or offline command omits its reason. */
export function communityPostReasonRequired(): ApiException {
  return new ApiException(
    "CONTENT_POST_REASON_REQUIRED",
    "请填写驳回或下架原因",
    HttpStatus.BAD_REQUEST,
  );
}

/** Creates a stable error when managed post images are missing or unreadable. */
export function communityPostMediaUnavailable(): ApiException {
  return new ApiException(
    "CONTENT_POST_MEDIA_UNAVAILABLE",
    "帖子图片缺失或暂时不可用，不能通过审核",
    HttpStatus.CONFLICT,
  );
}

/** Creates a stable error when a community comment is missing from its post context. */
export function communityPostCommentNotFound(): ApiException {
  return new ApiException("CONTENT_COMMENT_NOT_FOUND", "社区评论不存在", HttpStatus.NOT_FOUND);
}

/** Creates a stable error when a user tries to delete another commenter's comment. */
export function communityPostCommentForbidden(): ApiException {
  return new ApiException("CONTENT_COMMENT_FORBIDDEN", "无权删除该社区评论", HttpStatus.FORBIDDEN);
}

/** Creates a stable error when a comment transition cannot preserve its visible count. */
export function communityPostCommentStateConflict(): ApiException {
  return new ApiException(
    "CONTENT_COMMENT_STATE_CONFLICT",
    "评论状态已变化，请刷新后重试",
    HttpStatus.CONFLICT,
  );
}
