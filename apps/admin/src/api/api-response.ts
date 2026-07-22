import type { ApiResponse } from "@petcare/shared-types";

export function unwrapApiResponse<T>(payload: unknown): T {
  if (!isApiResponse(payload) || payload.code !== "SUCCESS") {
    throw new Error("响应格式无效");
  }

  return payload.data as T;
}

export function readApiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "请求失败";
  }

  const message = (payload as { message?: unknown }).message;

  return typeof message === "string" && message.length > 0 ? message : "请求失败";
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
