// packages/api-client/src/endpoints/order.ts

import {
  Order,
  CreateRewardOrderRequest,
  CreateRewardOrderResponse,
  CreatePlatformOrderRequest,
  OrderListQuery,
  OrderListResponse,
  SubmitIntentRequest,
  UploadSopRecordRequest,
  ApiResponse,
} from "@petcare/shared-types";
import type { AxiosInstance } from "axios";

export class OrderAPI {
  constructor(private http: AxiosInstance) {}

  /**
   * 创建悬赏订单
   */
  async createRewardOrder(data: CreateRewardOrderRequest): Promise<CreateRewardOrderResponse> {
    const response = await this.http.post<ApiResponse<CreateRewardOrderResponse>>(
      "/orders/reward",
      data,
    );

    return response.data.data!;
  }

  /**
   * 创建平台订单
   */
  async createPlatformOrder(data: CreatePlatformOrderRequest): Promise<Order> {
    const response = await this.http.post<ApiResponse<Order>>("/orders/platform", data);

    return response.data.data!;
  }

  /**
   * 获取订单列表
   */
  async getOrderList(query: OrderListQuery): Promise<OrderListResponse> {
    const response = await this.http.get<ApiResponse<OrderListResponse>>("/orders", {
      params: query,
    });

    return response.data.data!;
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderId: string): Promise<Order> {
    const response = await this.http.get<ApiResponse<Order>>(`/orders/${orderId}`);

    return response.data.data!;
  }

  /**
   * 提交接单意向
   */
  async submitIntent(data: SubmitIntentRequest): Promise<void> {
    await this.http.post("/orders/intent", data);
  }

  /**
   * 上传SOP记录
   */
  async uploadSopRecord(data: UploadSopRecordRequest): Promise<void> {
    await this.http.post("/orders/sop-record", data);
  }

  /**
   * 确认订单完成
   */
  async completeOrder(orderId: string): Promise<void> {
    await this.http.post(`/orders/${orderId}/complete`);
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    await this.http.post(`/orders/${orderId}/cancel`, { reason });
  }
}
