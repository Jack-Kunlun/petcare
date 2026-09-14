-- CreateEnum
CREATE TYPE "PaymentBillRunStatus" AS ENUM ('running', 'matched', 'differences', 'failed');

-- CreateTable
CREATE TABLE "payment_bill_runs" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "bill_date" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "status" "PaymentBillRunStatus" NOT NULL DEFAULT 'running',
    "file_sha256" TEXT,
    "row_count" INTEGER,
    "local_count" INTEGER,
    "difference_count" INTEGER NOT NULL DEFAULT 0,
    "snapshot_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "payment_bill_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_bill_differences" (
    "run_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "fields" TEXT[],
    "local" JSONB,
    "provider" JSONB,

    CONSTRAINT "payment_bill_differences_pkey" PRIMARY KEY ("run_id","ordinal")
);

-- CreateIndex
CREATE INDEX "payment_bill_runs_merchant_id_created_at_idx" ON "payment_bill_runs"("merchant_id", "created_at");

-- AddForeignKey
ALTER TABLE "payment_bill_runs" ADD CONSTRAINT "payment_bill_runs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_bill_differences" ADD CONSTRAINT "payment_bill_differences_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payment_bill_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
