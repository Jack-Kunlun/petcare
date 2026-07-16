// packages/api-client/src/endpoints/user.ts

import {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  GetUserResponse,
  UpdateUserRequest,
  RealNameVerifyRequest,
  ApiResponse,
} from "@petcare/shared-types";
import type { AxiosInstance } from "axios";

export class UserAPI {
  constructor(private http: AxiosInstance) {}

  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await this.http.post<ApiResponse<RegisterResponse>>("/users/register", data);

    return response.data.data!;
  }

  /**
   * 用户登录
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.http.post<ApiResponse<LoginResponse>>("/users/login", data);

    return response.data.data!;
  }

  /**
   * 获取用户详情
   */
  async getUserDetail(userId: string): Promise<GetUserResponse> {
    const response = await this.http.get<ApiResponse<GetUserResponse>>(`/users/${userId}`);

    return response.data.data!;
  }

  /**
   * 更新用户资料
   */
  async updateUser(userId: string, data: UpdateUserRequest): Promise<void> {
    await this.http.put(`/users/${userId}`, data);
  }

  /**
   * 实名认证
   */
  async verifyRealName(userId: string, data: RealNameVerifyRequest): Promise<void> {
    await this.http.post(`/users/${userId}/realname-verify`, data);
  }
}
