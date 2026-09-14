import type {
  CreatePaymentBillRunRequest,
  CreatePaymentBillReviewRequest,
  PaymentBillRunSummary,
  PaymentBillRunPage,
  PaymentBillRunDetail,
  PaymentBillReviewEntry,
  PaymentBillReviewHistory,
  PaymentReconciliationPage,
  PaymentOperationsPageQuery,
} from "@petcare/shared-types";
import { apiClient } from "./auth";

/** Reads current merchant exceptions without changing financial or review state. */
export async function fetchPaymentIssues(
  query: PaymentOperationsPageQuery,
): Promise<PaymentReconciliationPage> {
  return (
    await apiClient.get<PaymentReconciliationPage>("/admin/payments/reconciliation/queue", {
      params: query,
    })
  ).data;
}

/** Pages through every recorded bill run, including failures and interrupted runs. */
export async function fetchPaymentBills(
  query: PaymentOperationsPageQuery,
): Promise<PaymentBillRunPage> {
  return (
    await apiClient.get<PaymentBillRunPage>("/admin/payments/bills/history", { params: query })
  ).data;
}

/** Explicitly creates a bill comparison, preserving the request key on uncertain retries. */
export async function createPaymentBill(
  input: CreatePaymentBillRunRequest,
): Promise<PaymentBillRunSummary> {
  return (await apiClient.post<PaymentBillRunSummary>("/admin/payments/bills", input)).data;
}

/** Reads one immutable comparison and a page of its differences. */
export async function fetchPaymentBill(id: string, after: number): Promise<PaymentBillRunDetail> {
  return (
    await apiClient.get<PaymentBillRunDetail>(`/admin/payments/bills/${encodeURIComponent(id)}`, {
      params: { after },
    })
  ).data;
}

/** Reads append-only review history and its current version. */
export async function fetchBillReviews(
  id: string,
  ordinal: number,
  after: number,
): Promise<PaymentBillReviewHistory> {
  return (
    await apiClient.get<PaymentBillReviewHistory>(
      `/admin/payments/bills/${encodeURIComponent(id)}/differences/${ordinal}/reviews`,
      { params: { after } },
    )
  ).data;
}

/** Adds one human review event; never changes the bill result or financial records. */
export async function createBillReview(
  id: string,
  ordinal: number,
  input: CreatePaymentBillReviewRequest,
): Promise<PaymentBillReviewEntry> {
  return (
    await apiClient.post<PaymentBillReviewEntry>(
      `/admin/payments/bills/${encodeURIComponent(id)}/differences/${ordinal}/reviews`,
      input,
    )
  ).data;
}
