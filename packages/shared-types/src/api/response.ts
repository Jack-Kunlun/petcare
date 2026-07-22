/** 统一 API 响应元数据。 */
export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
}

/** 统一 API 响应格式。 */
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
  meta: ApiResponseMeta;
}

export type ApiErrorResponse = ApiResponse<null>;

export function successResponse<T>(
  data: T,
  meta: ApiResponseMeta,
  message = "操作成功",
): ApiResponse<T> {
  return {
    code: "SUCCESS",
    message,
    data,
    meta,
  };
}

export function errorResponse(
  code: string,
  message: string,
  meta: ApiResponseMeta,
): ApiErrorResponse {
  return {
    code,
    message,
    data: null,
    meta,
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
