// packages/shared-types/src/api/response.ts

/**
 * 统一API响应格式
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

/**
 * 成功响应快捷方法
 */
export function successResponse<T>(data: T, message = "success"): ApiResponse<T> {
  return {
    code: 200,
    message,
    data,
  };
}

/**
 * 错误响应快捷方法
 */
export function errorResponse(message: string, code = 400): ApiResponse {
  return {
    code,
    message,
  };
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
