import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  AdminSettlementSummary,
  CreateProviderWithdrawalRequest,
  ProviderIncomeEntry,
  ProviderIncomeSummary,
  ProviderWithdrawalSummary,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const featureDisabled = () =>
  new ApiException("SETTLEMENT_FEATURE_DISABLED", "结算服务未开放", HttpStatus.NOT_FOUND);

/** Builds an immutable read model for provider income and blocked withdrawal commands. */
@Injectable()
export class SettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getProviderIncome(providerId: string): Promise<ProviderIncomeSummary> {
    this.assertEnabled();
    const pendingCents = await this.materializeCompletedOrders(providerId);
    const entries = await this.prisma.providerLedgerEntry.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" },
    });

    return {
      availableCents: entries
        .filter((entry) => entry.withdrawable)
        .reduce((total, entry) => total + entry.amountCents, 0),
      blockedCents: entries
        .filter((entry) => !entry.withdrawable)
        .reduce((total, entry) => total + entry.amountCents, 0),
      pendingCents,
      entries: entries.map((entry) => this.toIncomeEntry(entry)),
    };
  }

  async getAdminSummary(): Promise<AdminSettlementSummary> {
    this.assertEnabled();
    const providers = await this.prisma.order.findMany({
      where: { orderType: "reward", status: "completed", providerId: { not: null } },
      distinct: ["providerId"],
      select: { providerId: true },
    });

    await Promise.all(
      providers
        .filter((provider): provider is { providerId: string } => provider.providerId !== null)
        .map((provider) => this.materializeCompletedOrders(provider.providerId)),
    );

    const entries = await this.prisma.providerLedgerEntry.findMany({
      select: { amountCents: true, withdrawable: true },
    });
    const pendingOrders = await this.prisma.order.findMany({
      where: {
        orderType: "reward",
        status: "completed",
        providerId: { not: null },
        payment: { status: "succeeded" },
        feeSnapshot: null,
      },
      select: { amount: true },
    });

    return {
      availableCents: entries
        .filter((entry) => entry.withdrawable)
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      blockedCents: entries
        .filter((entry) => !entry.withdrawable)
        .reduce((sum, entry) => sum + entry.amountCents, 0),
      pendingCents: pendingOrders.reduce((sum, order) => sum + order.amount, 0),
      entryCount: entries.length,
    };
  }

  async createWithdrawal(
    providerId: string,
    input: CreateProviderWithdrawalRequest,
  ): Promise<ProviderWithdrawalSummary> {
    this.assertEnabled();

    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      throw new ApiException("WITHDRAWAL_AMOUNT_INVALID", "提现金额无效", HttpStatus.BAD_REQUEST);
    }

    if (!/^[0-9a-f-]{16,64}$/iu.test(input.idempotencyKey)) {
      throw new ApiException(
        "WITHDRAWAL_IDEMPOTENCY_INVALID",
        "提现请求标识无效",
        HttpStatus.BAD_REQUEST,
      );
    }

    const income = await this.getProviderIncome(providerId);
    const existing = await this.prisma.providerWithdrawal.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existing) {
      if (existing.providerId !== providerId || existing.amountCents !== input.amountCents) {
        throw new ApiException(
          "WITHDRAWAL_IDEMPOTENCY_CONFLICT",
          "提现请求标识已被使用",
          HttpStatus.CONFLICT,
        );
      }

      return this.toWithdrawalSummary(existing);
    }

    const failureReason =
      income.availableCents < input.amountCents
        ? "INSUFFICIENT_WITHDRAWABLE_BALANCE"
        : "PAYOUT_ENTITY_UNCONFIGURED";
    const withdrawal = await this.prisma.providerWithdrawal.create({
      data: {
        providerId,
        amountCents: input.amountCents,
        status: "blocked",
        simulation: true,
        failureReason,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return this.toWithdrawalSummary(withdrawal);
  }

  private assertEnabled(): void {
    if (!this.config.commercialServicesEnabled) {
      throw featureDisabled();
    }
  }

  private async materializeCompletedOrders(providerId: string): Promise<number> {
    const orders = await this.prisma.order.findMany({
      where: {
        providerId,
        orderType: "reward",
        status: "completed",
        payment: { status: { in: ["succeeded", "simulated"] } },
      },
      select: {
        id: true,
        amount: true,
        payment: { select: { status: true } },
        feeSnapshot: { select: { providerSettlementCents: true } },
      },
    });
    let pendingCents = 0;
    const entries: Prisma.ProviderLedgerEntryCreateManyInput[] = [];

    for (const order of orders) {
      const paymentStatus = order.payment?.status;
      const simulated = paymentStatus === "simulated";
      const amountCents = simulated ? order.amount : order.feeSnapshot?.providerSettlementCents;

      if (!amountCents || amountCents <= 0) {
        pendingCents += order.amount;
        continue;
      }

      entries.push({
        providerId,
        orderId: order.id,
        amountCents,
        paymentStatus,
        withdrawable: !simulated,
        entryType: "completed_order",
        idempotencyKey: `completed_order:${order.id}`,
      });
    }

    if (entries.length > 0) {
      await this.prisma.providerLedgerEntry.createMany({ data: entries, skipDuplicates: true });
    }

    return pendingCents;
  }

  private toIncomeEntry(entry: {
    id: string;
    orderId: string;
    amountCents: number;
    paymentStatus: string;
    withdrawable: boolean;
    createdAt: Date;
  }): ProviderIncomeEntry {
    return {
      id: entry.id,
      orderId: entry.orderId,
      amountCents: entry.amountCents,
      paymentStatus: entry.paymentStatus === "succeeded" ? "succeeded" : "simulated",
      withdrawable: entry.withdrawable,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private toWithdrawalSummary(withdrawal: {
    id: string;
    amountCents: number;
    status: string;
    simulation: boolean;
    failureReason: string | null;
    createdAt: Date;
  }): ProviderWithdrawalSummary {
    return {
      id: withdrawal.id,
      amountCents: withdrawal.amountCents,
      status: ["blocked", "pending", "paid", "failed"].includes(withdrawal.status)
        ? (withdrawal.status as ProviderWithdrawalSummary["status"])
        : "blocked",
      simulation: withdrawal.simulation,
      failureReason: withdrawal.failureReason,
      createdAt: withdrawal.createdAt.toISOString(),
    };
  }
}
