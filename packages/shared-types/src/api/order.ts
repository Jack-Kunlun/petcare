// packages/shared-types/src/api/order.ts

import { OrderType, OrderStatus, ServiceType } from "../enums";
import type { PaginatedResponse } from "./response";

/**
 * 订单基本信息
 */
export interface Order {
  id: string;
  orderType: OrderType;
  serviceType: ServiceType;
  ownerId: string;
  providerId?: string;
  petId: string;
  serviceTime: string;
  address: string;
  amount: number;
  status: OrderStatus;
  remark?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Public owner identity shown with a discoverable reward order. */
export interface PublicOrderOwner {
  /** Display nickname. */
  nickname: string;
  /** Public avatar URL, or null when no avatar is available. */
  avatar: string | null;
}

/** Public pet summary shown with a discoverable reward order. */
export interface PublicOrderPet {
  /** Pet display name. */
  name: string;
  /** Pet breed label. */
  breed: string;
  /** First public pet photo, or null when no photo is available. */
  coverImage: string | null;
}

/** Anonymous-safe projection of a discoverable reward order. */
export interface PublicOrder {
  /** Order identifier used to open the public detail page. */
  id: string;
  /** Order business model. */
  orderType: OrderType;
  /** Requested service category. */
  serviceType: ServiceType;
  /** ISO 8601 service time. */
  serviceTime: string;
  /** Order amount in minor currency units. */
  amount: number;
  /** Current order state. */
  status: OrderStatus;
  /** Anonymous-safe owner display identity. */
  owner: PublicOrderOwner;
  /** Anonymous-safe pet display summary. */
  pet: PublicOrderPet;
}

/**
 * 创建悬赏订单请求
 */
export interface CreateRewardOrderRequest {
  serviceType: ServiceType;
  petId: string;
  serviceTime: string;
  rewardAmount: number;
  address: string;
  remark?: string;
}

/**
 * 创建悬赏订单响应
 */
export interface CreateRewardOrderResponse {
  order: Order;
}

/**
 * 创建平台订单请求
 */
export interface CreatePlatformOrderRequest {
  serviceType: ServiceType;
  petId: string;
  serviceTime: string;
  address: string;
  remark?: string;
}

/**
 * 订单列表查询参数
 */
export interface OrderListQuery {
  page: number;
  pageSize: number;
  status?: OrderStatus;
  orderType?: OrderType;
  startDate?: string;
  endDate?: string;
}

/** Paginated anonymous-safe reward-order list. */
export type PublicOrderListResponse = PaginatedResponse<PublicOrder>;

/** @deprecated Use PublicOrderListResponse. */
export type OrderListResponse = PublicOrderListResponse;

/**
 * 接单意向
 */
export interface OrderIntent {
  id: string;
  rewardOrderId: string;
  providerId: string;
  status: "pending" | "confirmed" | "rejected";
  createdAt: string;
}

/**
 * 提交接单意向请求
 */
export interface SubmitIntentRequest {
  rewardOrderId: string;
}

/**
 * SOP执行记录
 */
export interface SopRecord {
  id: string;
  orderId: string;
  stepNumber: number; // 1-5
  stepName: string;
  photos: string[];
  videos: string[];
  note?: string;
  completedAt: string;
}

/**
 * 上传SOP记录请求
 */
export interface UploadSopRecordRequest {
  orderId: string;
  stepNumber: number;
  stepName: string;
  photos: string[];
  videos?: string[];
  note?: string;
}
