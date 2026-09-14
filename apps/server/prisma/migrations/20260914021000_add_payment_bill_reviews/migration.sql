-- CreateEnum
CREATE TYPE "PaymentBillReviewAction" AS ENUM ('note', 'record_outcome', 'reopen');

-- CreateEnum
CREATE TYPE "PaymentBillReviewStatus" AS ENUM ('open', 'documented');

-- CreateTable
CREATE TABLE "payment_bill_reviews" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "PaymentBillReviewAction" NOT NULL,
    "status" "PaymentBillReviewStatus" NOT NULL,
    "note" VARCHAR(1000) NOT NULL,
    "evidence_reference" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_bill_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_bill_reviews_run_id_ordinal_version_key" ON "payment_bill_reviews"("run_id", "ordinal", "version");

-- AddForeignKey
ALTER TABLE "payment_bill_reviews" ADD CONSTRAINT "payment_bill_reviews_run_id_ordinal_fkey" FOREIGN KEY ("run_id", "ordinal") REFERENCES "payment_bill_differences"("run_id", "ordinal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_bill_reviews" ADD CONSTRAINT "payment_bill_reviews_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
