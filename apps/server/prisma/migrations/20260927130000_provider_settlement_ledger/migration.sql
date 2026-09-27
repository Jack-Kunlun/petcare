-- CreateTable
CREATE TABLE "provider_ledger_entries" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "payment_status" TEXT NOT NULL,
    "withdrawable" BOOLEAN NOT NULL DEFAULT false,
    "entry_type" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_withdrawals" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "fee_cents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'blocked',
    "simulation" BOOLEAN NOT NULL DEFAULT true,
    "idempotency_key" TEXT NOT NULL,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_ledger_entries_order_id_key" ON "provider_ledger_entries"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_ledger_entries_idempotency_key_key" ON "provider_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "provider_ledger_entries_provider_id_created_at_idx" ON "provider_ledger_entries"("provider_id", "created_at");

-- CreateIndex
CREATE INDEX "provider_ledger_entries_provider_id_withdrawable_created_at_idx" ON "provider_ledger_entries"("provider_id", "withdrawable", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "provider_withdrawals_idempotency_key_key" ON "provider_withdrawals"("idempotency_key");

-- CreateIndex
CREATE INDEX "provider_withdrawals_provider_id_created_at_idx" ON "provider_withdrawals"("provider_id", "created_at");

-- CreateIndex
CREATE INDEX "provider_withdrawals_provider_id_status_created_at_idx" ON "provider_withdrawals"("provider_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "provider_ledger_entries" ADD CONSTRAINT "provider_ledger_entries_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_ledger_entries" ADD CONSTRAINT "provider_ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_withdrawals" ADD CONSTRAINT "provider_withdrawals_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
