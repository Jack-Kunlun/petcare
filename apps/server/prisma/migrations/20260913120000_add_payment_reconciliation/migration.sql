-- CreateEnum
CREATE TYPE "PaymentReconciliationIssue" AS ENUM ('query_failed', 'result_invalid', 'payment_pending_too_long', 'refund_pending_too_long', 'refund_abnormal', 'refund_closed', 'external_refund', 'cancelled_payment');

-- AlterTable
ALTER TABLE "order_payments" ADD COLUMN     "reconcile_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reconcile_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reconcile_issue" "PaymentReconciliationIssue",
ADD COLUMN     "reconcile_lease_token" TEXT,
ADD COLUMN     "reconcile_lease_until" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "order_payments_reconcile_after_idx" ON "order_payments"("reconcile_after");

-- CreateIndex
CREATE INDEX "order_payments_reconcile_issue_reconcile_after_idx" ON "order_payments"("reconcile_issue", "reconcile_after");
