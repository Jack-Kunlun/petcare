// packages/shared-types/src/api/user.ts

import { UserRole, UserStatus } from "../enums";

/**
 * 用户基本信息
 */
export interface User {
  id: string;
  nickname: string;
  avatar?: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * 注册请求
 */
export interface RegisterRequest {
  phone: string;
  code: string; // 短信验证码
  nickname: string;
  avatar?: string;
}

/**
 * 注册响应
 */
export interface RegisterResponse {
  user: User;
  token: string;
  refreshToken: string;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  phone: string;
  code: string;
}

/**
 * 登录响应（同注册响应）
 */
export type LoginResponse = RegisterResponse;

/**
 * 获取用户详情响应
 */
export interface GetUserResponse {
  user: User;
}

/**
 * 更新用户资料请求
 */
export interface UpdateUserRequest {
  nickname?: string;
  avatar?: string;
}

/**
 * 实名认证请求
 */
export interface RealNameVerifyRequest {
  realName: string;
  idCard: string;
  idCardFront: string; // 身份证正面URL
  idCardBack: string; // 身份证反面URL
}
