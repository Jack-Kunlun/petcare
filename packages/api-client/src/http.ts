import type { ApiErrorResponse, ApiResponse } from "@petcare/shared-types";
import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function unwrapApiResponse<T>(payload: unknown): T {
  if (!isApiResponse(payload) || payload.code !== "SUCCESS") {
    throw new ApiClientError("INVALID_RESPONSE", "响应格式无效", "unknown");
  }

  return payload.data as T;
}

export function toApiClientError(payload: ApiErrorResponse, status?: number): ApiClientError {
  return new ApiClientError(payload.code, payload.message, payload.meta.requestId, status);
}

function isApiResponse(payload: unknown): payload is ApiResponse<unknown> {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const response = payload as Partial<ApiResponse<unknown>>;

  return (
    typeof response.code === "string" &&
    typeof response.message === "string" &&
    "data" in response &&
    typeof response.meta?.requestId === "string" &&
    typeof response.meta.timestamp === "string"
  );
}

function isApiErrorResponse(payload: unknown): payload is ApiErrorResponse {
  return isApiResponse(payload) && payload.code !== "SUCCESS" && payload.data === null;
}

class ApiClient {
  private instance: AxiosInstance;

  constructor(baseURL: string) {
    this.instance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.instance.interceptors.request.use(
      (config) => {
        const token = typeof localStorage === "undefined" ? null : localStorage.getItem("token");

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error: unknown) => Promise.reject(error),
    );

    this.instance.interceptors.response.use(
      (response) => {
        if (response.status !== 204) {
          response.data = unwrapApiResponse(response.data);
        }

        return response;
      },
      (error: AxiosError<ApiErrorResponse>) => {
        if (error.response?.status === 401) {
          if (typeof localStorage !== "undefined") {
            localStorage.removeItem("token");
          }

          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }

        if (isApiErrorResponse(error.response?.data)) {
          return Promise.reject(toApiClientError(error.response.data, error.response.status));
        }

        return Promise.reject(error);
      },
    );
  }

  getInstance(): AxiosInstance {
    return this.instance;
  }
}

export default ApiClient;
