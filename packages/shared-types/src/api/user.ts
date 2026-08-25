// packages/shared-types/src/api/user.ts

import { UserRole, UserStatus } from "../enums";

/**
 * 用户基本信息
 */
export interface User {
  id: string;
  nickname: string;
  avatar?: string;
  /** Verified phone number, or null for a Miniapp account that has not completed its profile. */
  phone: string | null;
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

/** Public profile fields that never disclose a stored address. */
export interface PublicUserProfile {
  /** Coarse public region; null until a trusted region source exists. */
  region: string | null;
  /** Optional user-entered public biography. */
  bio: string | null;
}

/** Public user detail returned without private account metadata. */
export interface PublicUser {
  /** User identifier. */
  id: string;
  /** Public display name. */
  nickname: string;
  /** Public avatar URL, or null when the default avatar should be used. */
  avatar: string | null;
  /** Public business identity. */
  userType: string;
  /** Public details are returned only for active accounts. */
  status: "active";
  /** Optional public profile. */
  profile: PublicUserProfile | null;
}

/** @deprecated Use PublicUser. */
export type GetUserResponse = PublicUser;

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
