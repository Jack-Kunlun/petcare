import type { ApiResponse } from "@petcare/shared-types";

export type RawRequestOptions = Omit<
  UniNamespace.RequestOptions,
  "url" | "success" | "fail" | "complete"
>;

export class MiniappApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MiniappApiError";
  }
}

function requestUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_MINIAPP_API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new MiniappApiError(0, "CONFIG_ERROR", "Miniapp API 地址未配置");
  }

  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function parseResponse(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const response = value as Partial<ApiResponse<unknown>>;
  const meta = response.meta;

  return (
    typeof response.code === "string" &&
    typeof response.message === "string" &&
    Object.prototype.hasOwnProperty.call(response, "data") &&
    typeof meta === "object" &&
    meta !== null &&
    typeof meta.requestId === "string" &&
    meta.requestId.trim().length > 0 &&
    typeof meta.timestamp === "string" &&
    Number.isFinite(Date.parse(meta.timestamp))
  );
}

function unwrapResponse<T>(statusCode: number, value: unknown): T {
  if (statusCode === 204) {
    return undefined as T;
  }

  const response = parseResponse(value);

  if (statusCode >= 200 && statusCode < 300 && isApiResponse(response)) {
    return response.data as T;
  }

  if (isApiResponse(response)) {
    throw new MiniappApiError(statusCode, response.code, response.message);
  }

  throw new MiniappApiError(statusCode, "INVALID_RESPONSE", "服务器响应格式无效");
}

function networkError(message: string): MiniappApiError {
  return new MiniappApiError(0, "NETWORK_ERROR", message || "网络请求失败");
}

/** Sends an unauthenticated Miniapp API request and unwraps the shared response envelope. */
export function rawRequest<T>(path: string, options: RawRequestOptions = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      ...options,
      url: requestUrl(path),
      success(response) {
        try {
          resolve(unwrapResponse<T>(response.statusCode, response.data));
        } catch (error) {
          reject(error);
        }
      },
      fail(error) {
        reject(networkError(error.errMsg));
      },
    });
  });
}

/** Uploads a local file without session handling and unwraps the shared response envelope. */
export function rawUpload<T>(
  path: string,
  filePath: string,
  fieldName: string,
  headers: Record<string, string> = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    uni.uploadFile({
      url: requestUrl(path),
      filePath,
      name: fieldName,
      header: headers,
      success(response) {
        try {
          resolve(unwrapResponse<T>(response.statusCode, response.data));
        } catch (error) {
          reject(error);
        }
      },
      fail(error) {
        reject(networkError(error.errMsg));
      },
    });
  });
}
