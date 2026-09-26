import { calculateProviderSettlement, SettlementEligibilityError } from "./settlement-calculator";

describe("calculateProviderSettlement", () => {
  const input = {
    orderStatus: "completed",
    providerId: "provider-1",
    paymentStatus: "succeeded",
    providerSettlementCents: 1200,
  };

  it("returns the frozen provider amount for a collected completed order", () => {
    expect(calculateProviderSettlement(input)).toEqual({
      providerId: "provider-1",
      amountCents: 1200,
      currency: "CNY",
      source: "completed_order",
    });
  });

  it("rejects simulated payment as non-collected funds", () => {
    expect(() => calculateProviderSettlement({ ...input, paymentStatus: "simulated" })).toThrow(
      new SettlementEligibilityError("PAYMENT_NOT_COLLECTED"),
    );
  });

  it.each([
    ["confirmed", "ORDER_NOT_COMPLETED"],
    ["in_progress", "ORDER_NOT_COMPLETED"],
  ] as const)("rejects order status %s", (orderStatus, code) => {
    expect(() => calculateProviderSettlement({ ...input, orderStatus })).toThrow(
      new SettlementEligibilityError(code),
    );
  });

  it("rejects missing providers and invalid frozen amounts", () => {
    expect(() => calculateProviderSettlement({ ...input, providerId: null })).toThrow(
      new SettlementEligibilityError("PROVIDER_REQUIRED"),
    );
    expect(() => calculateProviderSettlement({ ...input, providerSettlementCents: 0 })).toThrow(
      new SettlementEligibilityError("AMOUNT_INVALID"),
    );
  });
});
