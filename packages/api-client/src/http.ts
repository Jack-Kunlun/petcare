// packages/api-client/src/http.ts

import { ApiResponse } from "@petcare/shared-types";
import axios from "axios";
import type { AxiosInstance } from "axios";

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

  private setupInterceptors() {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("token");

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response) => {
        const data = response.data as ApiResponse;

        if (data.code !== 200) {
          return Promise.reject(new Error(data.message));
        }

        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Token过期，跳转登录
          localStorage.removeItem("token");
          window.location.href = "/login";
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
