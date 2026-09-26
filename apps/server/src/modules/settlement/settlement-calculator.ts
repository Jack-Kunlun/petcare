export interface SettlementCalculationInput {
  /** Only completed orders may release provider earnings. */
  orderStatus: string;
  /** The provider captured on the order; owner-only or unassigned orders are invalid. */
  providerId: string | null;
  /** Simulated payments never represent collected funds. */
  paymentStatus: string | null;
  /** Frozen provider amount from the order fee snapshot, in integer cents. */
  providerSettlementCents: number;
}

export interface ProviderSettlementCalculation {
  providerId: string;
  amountCents: number;
  currency: "CNY";
  source: "completed_order";
}

export class SettlementEligibilityError extends Error {
  constructor(
    readonly code:
      "ORDER_NOT_COMPLETED" | "PAYMENT_NOT_COLLECTED" | "PROVIDER_REQUIRED" | "AMOUNT_INVALID",
  ) {
    super(code);
    this.name = "SettlementEligibilityError";
  }
}

/**
 * Calculates the only amount Cycle 10 may release from a completed order.
 * This function has no persistence or payout side effects; callers must add an
 * immutable ledger transaction before exposing any withdrawal operation.
 */
export function calculateProviderSettlement(
  input: SettlementCalculationInput,
): ProviderSettlementCalculation {
  if (input.orderStatus !== "completed") {
    throw new SettlementEligibilityError("ORDER_NOT_COMPLETED");
  }

  if (input.paymentStatus !== "succeeded") {
    throw new SettlementEligibilityError("PAYMENT_NOT_COLLECTED");
  }

  if (!input.providerId) {
    throw new SettlementEligibilityError("PROVIDER_REQUIRED");
  }

  if (!Number.isSafeInteger(input.providerSettlementCents) || input.providerSettlementCents <= 0) {
    throw new SettlementEligibilityError("AMOUNT_INVALID");
  }

  return {
    providerId: input.providerId,
    amountCents: input.providerSettlementCents,
    currency: "CNY",
    source: "completed_order",
  };
}
