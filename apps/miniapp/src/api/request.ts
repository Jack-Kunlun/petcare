import { ApiResponse } from "@petcare/shared-types";
import Taro from "@tarojs/taro";

export type ApiRequestOptions = Omit<
  Taro.request.Option<unknown>,
  "url" | "success" | "fail" | "complete"
>;

const API_BASE_URL =
  process.env.TARO_APP_API_BASE_URL?.replace(/\/+$/, "") || "http://localhost:3000";

export class MiniappApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId = "unknown",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MiniappApiError";
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response: Taro.request.SuccessCallbackResult<TaroGeneral.IAnyObject>;

  try {
    response = await Taro.request<TaroGeneral.IAnyObject>({
      ...options,
      url: `${API_BASE_URL}/${path.replace(/^\/+/, "")}`,
      method: options.method ?? "GET",
    });
  } catch {
    throw new MiniappApiError("NETWORK_ERROR", "网络连接失败，请稍后重试");
  }

  if (response.statusCode === 204) {
    return undefined as T;
  }

  if (!isApiResponse(response.data)) {
    throw new MiniappApiError(
      "INVALID_RESPONSE",
      "服务响应异常，请稍后重试",
      "unknown",
      response.statusCode,
    );
  }

  if (response.data.code !== "SUCCESS") {
    throw new MiniappApiError(
      response.data.code,
      response.data.message,
      response.data.meta.requestId,
      response.statusCode,
    );
  }

  return response.data.data as T;
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Partial<ApiResponse<unknown>>;

  return (
    typeof response.code === "string" &&
    typeof response.message === "string" &&
    "data" in response &&
    typeof response.meta?.requestId === "string" &&
    typeof response.meta.timestamp === "string"
  );
}
