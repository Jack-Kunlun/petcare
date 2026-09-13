-- CreateEnum
CREATE TYPE "OrderRefundStatus" AS ENUM ('pending', 'processing', 'succeeded', 'abnormal', 'closed');

-- AlterEnum
ALTER TYPE "OrderPaymentStatus" ADD VALUE 'refunded';

-- CreateTable
CREATE TABLE "order_refunds" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "OrderRefundStatus" NOT NULL DEFAULT 'pending',
    "provider_refund_id" TEXT,
    "payer_refund_cents" INTEGER,
    "succeeded_at" TIMESTAMP(3),
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_refunds_payment_id_key" ON "order_refunds"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_refunds_provider_refund_id_key" ON "order_refunds"("provider_refund_id");

-- CreateIndex
CREATE INDEX "order_refunds_status_created_at_idx" ON "order_refunds"("status", "created_at");

-- AddForeignKey
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "order_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
