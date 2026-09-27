import type {
  CreateProviderWithdrawalRequest,
  ProviderIncomeSummary,
  ProviderWithdrawalSummary,
} from "@petcare/shared-types";
import { authorizedRequest } from "../state/session";

/** Reads the authenticated provider's immutable income projection. */
export function getProviderIncome(): Promise<ProviderIncomeSummary> {
  return authorizedRequest("/settlement/income");
}

/** Creates an idempotent withdrawal command. */
export function createProviderWithdrawal(
  request: CreateProviderWithdrawalRequest,
): Promise<ProviderWithdrawalSummary> {
  return authorizedRequest("/settlement/withdrawals", { method: "POST", data: request });
}
