import type { ApiResponse } from "@petcare/shared-types";

export function unwrapApiResponse<T>(payload: unknown): T {
  if (!isApiResponse(payload) || payload.code !== "SUCCESS") {
    throw new Error("响应格式无效");
  }

  return payload.data as T;
}

export function readApiErrorMessage(error: unknown): string {
  let payload = error;

  if (typeof error === "object" && error !== null && "response" in error) {
    payload = (error as { response?: { data?: unknown } }).response?.data;
  } else if (error instanceof Error) {
    payload = undefined;
  }

  const message =
    typeof payload === "object" && payload !== null
      ? (payload as { message?: unknown }).message
      : undefined;

  return typeof message === "string" && message.trim().length > 0
    ? message
    : "请求失败，请稍后重试";
}

function isApiResponse(payload: unknown): payload is ApiResponse<unknown> {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<ApiResponse<unknown>>;

  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    "data" in candidate &&
    typeof candidate.meta?.requestId === "string" &&
    typeof candidate.meta.timestamp === "string"
  );
}
