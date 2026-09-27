/** One provider income entry shown in the income ledger. */
export interface ProviderIncomeEntry {
  /** Immutable ledger entry identifier. */
  id: string;
  /** Source reward order identifier. */
  orderId: string;
  /** Integer amount in CNY cents. */
  amountCents: number;
  /** Payment state captured when the entry was written. */
  paymentStatus: "succeeded" | "simulated";
  /** Whether this entry may contribute to a withdrawal. */
  withdrawable: boolean;
  /** ISO 8601 ledger creation time. */
  createdAt: string;
}

/** Read-only provider income summary used by Miniapp and Admin. */
export interface ProviderIncomeSummary {
  /** Withdrawable amount in integer CNY cents. */
  availableCents: number;
  /** Simulated or otherwise blocked amount in integer CNY cents. */
  blockedCents: number;
  /** Completed real payments missing a fee snapshot and awaiting reconciliation. */
  pendingCents: number;
  /** Immutable income entries. */
  entries: ProviderIncomeEntry[];
}

/** Read-only aggregate shown to authorized PC operations users. */
export interface AdminSettlementSummary {
  /** Sum of real collected income currently eligible for withdrawal. */
  availableCents: number;
  /** Sum of simulated or blocked income. */
  blockedCents: number;
  /** Sum of completed real orders awaiting a fee snapshot. */
  pendingCents: number;
  /** Number of immutable ledger entries. */
  entryCount: number;
}

/** Idempotent withdrawal command. */
export interface CreateProviderWithdrawalRequest {
  /** Integer amount requested in CNY cents. */
  amountCents: number;
  /** Client-generated idempotency key. */
  idempotencyKey: string;
}

/** Persisted withdrawal command projection. */
export interface ProviderWithdrawalSummary {
  /** Withdrawal command identifier. */
  id: string;
  /** Requested integer amount in CNY cents. */
  amountCents: number;
  /** Current command state. */
  status: "blocked" | "pending" | "paid" | "failed";
  /** Whether this command is a simulation. */
  simulation: boolean;
  /** Optional machine-readable failure reason. */
  failureReason: string | null;
  /** ISO 8601 creation time. */
  createdAt: string;
}
