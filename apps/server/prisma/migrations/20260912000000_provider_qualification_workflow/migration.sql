-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "provider_qualification_applications" (
    "id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "id_card_front_key" TEXT,
    "id_card_front_mime" TEXT,
    "id_card_back_key" TEXT,
    "id_card_back_mime" TEXT,
    "training_key" TEXT,
    "training_mime" TEXT,
    "consent_version" TEXT,
    "consented_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_reason" TEXT,
    "verification_method" TEXT,
    "verification_reference" TEXT,
    "revoked_by_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" TEXT,
    "purge_after" TIMESTAMP(3),
    "purged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_qualification_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_qualification_events" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_qualification_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_qualification_applications_id_card_front_key_key" ON "provider_qualification_applications"("id_card_front_key");

-- CreateIndex
CREATE UNIQUE INDEX "provider_qualification_applications_id_card_back_key_key" ON "provider_qualification_applications"("id_card_back_key");

-- CreateIndex
CREATE UNIQUE INDEX "provider_qualification_applications_training_key_key" ON "provider_qualification_applications"("training_key");

-- CreateIndex
CREATE INDEX "provider_qualification_applications_applicant_id_status_idx" ON "provider_qualification_applications"("applicant_id", "status");

-- CreateIndex
CREATE INDEX "provider_qualification_applications_status_created_at_idx" ON "provider_qualification_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "provider_qualification_applications_purge_after_purged_at_idx" ON "provider_qualification_applications"("purge_after", "purged_at");

-- CreateIndex
CREATE UNIQUE INDEX "provider_qualification_applications_applicant_id_idempotenc_key" ON "provider_qualification_applications"("applicant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "provider_qualification_events_application_id_created_at_idx" ON "provider_qualification_events"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "provider_qualification_events_applicant_id_created_at_idx" ON "provider_qualification_events"("applicant_id", "created_at");
