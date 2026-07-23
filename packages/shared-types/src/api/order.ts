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

/**
 * 订单列表响应
 */
export type OrderListResponse = PaginatedResponse<Order>;

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
