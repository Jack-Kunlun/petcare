import type { OrderPaymentSummary, OrderPrepayResponse } from "@petcare/shared-types";
import { authorizedRequest } from "../state/session";

/** Reads the authenticated owner's persisted payment state. */
export function getOrderPayment(orderId: string): Promise<OrderPaymentSummary> {
  return authorizedRequest(`/payments/orders/${encodeURIComponent(orderId)}`);
}

/** Creates or reuses the order payment and returns server-generated WeChat parameters. */
export function prepayOrder(orderId: string): Promise<OrderPrepayResponse> {
  return authorizedRequest(`/payments/orders/${encodeURIComponent(orderId)}/prepay`, {
    method: "POST",
  });
}

/** Reconciles an uncertain client result through the persisted merchant number. */
export function refreshOrderPayment(orderId: string): Promise<OrderPaymentSummary> {
  return authorizedRequest(`/payments/orders/${encodeURIComponent(orderId)}/refresh`, {
    method: "POST",
  });
}
