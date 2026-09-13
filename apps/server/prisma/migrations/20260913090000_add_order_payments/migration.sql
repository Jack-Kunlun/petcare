-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('pending', 'succeeded', 'closed', 'refund_pending');

-- CreateTable
CREATE TABLE "order_payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "merchant_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "payer_open_id" TEXT NOT NULL,
    "status" "OrderPaymentStatus" NOT NULL DEFAULT 'pending',
    "transaction_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_notifications" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_order_id_key" ON "order_payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_transaction_id_key" ON "order_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "order_payments_status_created_at_idx" ON "order_payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_notifications_payment_id_idx" ON "payment_notifications"("payment_id");

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_notifications" ADD CONSTRAINT "payment_notifications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "order_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
